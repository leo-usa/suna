"""
Trigger execution service - executes agents when triggers fire.

This is a thin wrapper that reuses existing agent_runs infrastructure.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from core.services.supabase import DBConnection
from core.services import redis
from core.utils.logger import logger, structlog
from core.utils.config import config, EnvMode
from .trigger_service import TriggerEvent, TriggerResult


class ExecutionService:
    """Executes agents when triggers fire, reusing core agent_runs infrastructure."""

    def __init__(self, db_connection: DBConnection):
        self._db = db_connection
    
    async def execute_trigger_result(
        self,
        agent_id: str,
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent
    ) -> Dict[str, Any]:
        """
        Execute an agent based on trigger result.
        
        Reuses the core agent start infrastructure from agent_runs.py.
        """
        if not config.ACTIVATE_MCPS_TRIG:
            logger.warning("Trigger execution blocked: ACTIVATE_MCPS_TRIG is disabled")
            return {"success": False, "error": "Trigger functionality is disabled"}

        try:
            client = await self._db.client
            agent_result = await client.table('agents').select('account_id').eq('agent_id', agent_id).single().execute()
            if not agent_result.data:
                return {
                    "success": False,
                    "error": f"Agent {agent_id} not found",
                    "message": "Failed to execute trigger"
                }
            account_id = agent_result.data['account_id']
            
            if config.ENV_MODE != EnvMode.LOCAL:
                from core.utils.limits_checker import check_project_count_limit, check_thread_limit
                
                project_limit = await check_project_count_limit(account_id)
                if not project_limit['can_create']:
                    logger.warning(f"Trigger execution blocked: project limit reached for account {account_id} ({project_limit['current_count']}/{project_limit['limit']})")
                    return {    
                        "success": False,
                        "error": f"Project limit reached ({project_limit['current_count']}/{project_limit['limit']}). Upgrade your plan to run more triggers.",
                        "message": "Failed to execute trigger - project limit exceeded"
                    }
                
                thread_limit = await check_thread_limit(account_id)
                if not thread_limit['can_create']:
                    logger.warning(f"Trigger execution blocked: thread limit reached for account {account_id} ({thread_limit['current_count']}/{thread_limit['limit']})")
                    return {
                        "success": False,
                        "error": f"Thread limit reached ({thread_limit['current_count']}/{thread_limit['limit']}). Upgrade your plan to run more triggers.",
                        "message": "Failed to execute trigger - thread limit exceeded"
                    }
            
            rendered_prompt = self._render_prompt(
                trigger_result.agent_prompt,
                trigger_result.execution_variables,
                trigger_event
            )
            
            from core.agents.api import start_agent_run
            from .trigger_service import get_trigger_service
            
            model_name = trigger_result.model if hasattr(trigger_result, 'model') and trigger_result.model else "dobby/basic"

            master_thread_id = None
            trigger_name = None
            try:
                trigger = await get_trigger_service(self._db).get_trigger(trigger_event.trigger_id)
                if trigger:
                    trigger_name = trigger.name
                    cfg = trigger.config or {}
                    master_thread_id = cfg.get("master_thread_id") or None
                    if not model_name or model_name == "dobby/basic":
                        model_name = cfg.get("model") or model_name
            except Exception as e:
                logger.debug(f"Could not load trigger {trigger_event.trigger_id} for master link: {e}")

            metadata = {
                "trigger_execution": True,
                "trigger_id": trigger_event.trigger_id,
                "trigger_variables": trigger_result.execution_variables,
            }
            if master_thread_id:
                metadata["source"] = "master_assistant"
                metadata["master_thread_id"] = str(master_thread_id)
            
            result = await start_agent_run(
                account_id=account_id,
                prompt=rendered_prompt,
                agent_id=agent_id,
                model_name=model_name,
                metadata=metadata,
                skip_limits_check=True
            )

            if master_thread_id and result.get("thread_id") and result.get("agent_run_id"):
                try:
                    from core.master_assistant.service import register_trigger_child_run

                    await register_trigger_child_run(
                        account_id=account_id,
                        master_thread_id=str(master_thread_id),
                        child_thread_id=str(result["thread_id"]),
                        child_project_id=str(result.get("project_id") or "") or None,
                        agent_run_id=str(result["agent_run_id"]),
                        title=trigger_name or "Scheduled task",
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to register trigger run with master assistant: {e}",
                        exc_info=True,
                    )
            
            return {
                "success": True,
                "thread_id": result.get("thread_id"),
                "agent_run_id": result.get("agent_run_id"),
                "message": "Worker execution started successfully"
            }
                
        except Exception as e:
            logger.error(f"Failed to execute trigger result: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to execute trigger"
            }
    
    def _render_prompt(
        self,
        prompt: str,
        trigger_variables: Optional[Dict[str, Any]],
        trigger_event: TriggerEvent
    ) -> str:
        """Render trigger variables into the prompt template."""
        rendered = prompt
        
        try:
            # Get context from trigger event
            ctx = {}
            if hasattr(trigger_event, "context") and isinstance(trigger_event.context, dict):
                ctx = trigger_event.context
            
            # Merge with execution variables
            if trigger_variables:
                ctx.update(trigger_variables)
            
            payload = ctx.get("payload")
            trigger_slug = ctx.get("trigger_slug")
            webhook_id = ctx.get("webhook_id")
            
            def _to_json(obj: Any) -> str:
                try:
                    return json.dumps(obj, ensure_ascii=False, indent=2)
                except Exception:
                    return str(obj)
            
            # Replace template variables
            if "{{payload}}" in rendered:
                rendered = rendered.replace("{{payload}}", _to_json(payload))
            if "{{trigger_slug}}" in rendered:
                rendered = rendered.replace("{{trigger_slug}}", str(trigger_slug or ""))
            if "{{webhook_id}}" in rendered:
                rendered = rendered.replace("{{webhook_id}}", str(webhook_id or ""))
            
            # Append full context for reference
            if ctx:
                context_json = _to_json(ctx)
                rendered = f"""{rendered}\n\n---\nContext: 
                
                **Important Trigger task execution Reminder:** \n
                For those tasks whose instructions given by the user aren't clear enough, and you decide to use ask() tool to further clarify any question/aspect before proceeding, send those questions in plain text via email to the personal gmail of the user.
                
                \n \n\n{context_json}"""
                
        except Exception as e:  
            logger.warning(f"Failed to render prompt variables: {e}")
            # Return original prompt on error
            
        return rendered


def get_execution_service(db_connection: DBConnection) -> ExecutionService:
    """Factory function for ExecutionService."""
    return ExecutionService(db_connection)
