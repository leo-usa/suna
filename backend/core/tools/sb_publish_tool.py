from typing import Optional

from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager
from core.sandbox.tool_base import SandboxToolsBase
from core.utils.logger import logger


@tool_metadata(
    display_name="Publish Site",
    description="Publish the project workspace as a public Dobby site on /works",
    icon="Globe",
    color="bg-emerald-100 dark:bg-emerald-800/50",
    weight=55,
    visible=True,
    usage_guide="""
### PUBLISH SITE

Publish the current project's workspace (HTML/site assets) to a public Dobby Works URL.

```python
publish_site(title="Launch tracker")
publish_site(title="Dashboard", replace_existing=True)
```

Returns the public `/works/{slug}` URL. Free plans include a Made with Dobby badge.
""",
)
class SandboxPublishTool(SandboxToolsBase):
    def __init__(self, project_id: str, thread_manager: ThreadManager, thread_id: Optional[str] = None):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self.thread_manager = thread_manager

    @openapi_schema(
        {
            "type": "function",
            "function": {
                "name": "publish_site",
                "description": "Publish this project's workspace as a public site on Dobby Works. Use after the HTML/site is ready. Set replace_existing true to update the latest site for this project.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Optional public title for the site.",
                        },
                        "description": {
                            "type": "string",
                            "description": "Optional short description for SEO and the Works page.",
                        },
                        "slug": {
                            "type": "string",
                            "description": "Optional URL slug preference (may get a suffix if taken).",
                        },
                        "replace_existing": {
                            "type": "boolean",
                            "description": "If true, update this project's latest published site instead of creating a new one.",
                        },
                        "post_id": {
                            "type": "string",
                            "description": "Optional existing published site id to republish into.",
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
        }
    )
    async def publish_site(
        self,
        title: Optional[str] = None,
        description: Optional[str] = None,
        slug: Optional[str] = None,
        replace_existing: Optional[bool] = None,
        post_id: Optional[str] = None,
    ) -> ToolResult:
        try:
            from fastapi import HTTPException
            from core.publish.api import PublishRequest, publish_work

            account_id = getattr(self.thread_manager, "account_id", None)
            if not account_id:
                return self.fail_response("Missing account context for publish.")

            body = PublishRequest(
                project_id=self.project_id,
                thread_id=self.thread_id,
                title=title,
                description=description,
                slug=slug,
                post_id=post_id,
                replace_existing=bool(replace_existing),
            )
            result = await publish_work(body=body, user_id=str(account_id))
            url = result.get("url") or ""
            vanity = result.get("vanity_url") or ""
            branded = result.get("branded")
            lines = [
                f"Published site: https://dobby.now{url}" if url.startswith("/") else f"Published site: {url}",
            ]
            if vanity:
                lines.append(f"Vanity URL: {vanity}")
            if branded:
                lines.append("Note: Free plan includes a Made with Dobby badge. Paid plans remove branding and unlock custom domains.")
            if result.get("updated"):
                lines.append("Updated the existing published site.")
            return self.success_response("\n".join(lines))
        except HTTPException as e:
            return self.fail_response(f"Publish failed: {e.detail}")
        except Exception as e:
            logger.error(f"[PUBLISH_TOOL] failed: {e}")
            return self.fail_response(f"Publish failed: {e}")
