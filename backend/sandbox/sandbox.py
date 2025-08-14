import time
import asyncio
from daytona_sdk import AsyncDaytona, DaytonaConfig, CreateSandboxFromImageParams, AsyncSandbox, SessionExecuteRequest, Resources, SandboxState
from dotenv import load_dotenv
from utils.logger import logger
from utils.config import config
from utils.config import Configuration

load_dotenv()

logger.debug("Initializing Daytona sandbox configuration")
daytona_config = DaytonaConfig(
    api_key=config.DAYTONA_API_KEY,
    api_url=config.DAYTONA_SERVER_URL,  # Use api_url instead of server_url (deprecated)
    target=config.DAYTONA_TARGET,
)

if daytona_config.api_key:
    logger.debug("Daytona API key configured successfully")
else:
    logger.warning("No Daytona API key found in environment variables")

if daytona_config.api_url:
    logger.debug(f"Daytona API URL set to: {daytona_config.api_url}")
else:
    logger.warning("No Daytona API URL found in environment variables")

if daytona_config.target:
    logger.debug(f"Daytona target set to: {daytona_config.target}")
else:
    logger.warning("No Daytona target found in environment variables")

daytona = AsyncDaytona(daytona_config)

async def get_or_start_sandbox(sandbox_id: str) -> AsyncSandbox:
    """Retrieve a sandbox by ID, check its state, and start it if needed."""
    
    logger.info(f"Getting or starting sandbox with ID: {sandbox_id}")

    try:
        sandbox = await daytona.get(sandbox_id)
        
        # Check if sandbox needs to be started
        if sandbox.state == SandboxState.ARCHIVED or sandbox.state == SandboxState.STOPPED:
            logger.info(f"Sandbox is in {sandbox.state} state. Starting...")
            try:
                await daytona.start(sandbox)
                # Wait a moment for the sandbox to initialize
                # sleep(5)
                # Refresh sandbox state after starting
                sandbox = await daytona.get(sandbox_id)
                
                # Start supervisord in a session when restarting
                await start_supervisord_session(sandbox)
            except Exception as e:
                logger.error(f"Error starting sandbox: {e}")
                raise e
        
        # Update the last used timestamp on the sandbox labels for LRU policy
        try:
            labels = sandbox.labels or {}
            labels['last_used_ts'] = str(time.time())
            await sandbox.set_labels(labels)
            logger.info(f"Successfully updated labels for sandbox {sandbox_id}")
        except Exception as e:
            logger.error(f"Could not update labels for sandbox {sandbox_id}: {e}")
        
        logger.info(f"Sandbox {sandbox_id} is ready")
        return sandbox
        
    except Exception as e:
        logger.error(f"Error retrieving or starting sandbox: {str(e)}")
        raise e

async def start_supervisord_session(sandbox: AsyncSandbox):
    """Start supervisord in a session."""
    session_id = "supervisord-session"
    try:
        logger.info(f"Creating session {session_id} for supervisord")
        await sandbox.process.create_session(session_id)
        
        # Execute supervisord command
        await sandbox.process.execute_session_command(session_id, SessionExecuteRequest(
            command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
            var_async=True
        ))
        logger.info(f"Supervisord started in session {session_id}")
    except Exception as e:
        logger.error(f"Error starting supervisord session: {str(e)}")
        raise e

async def create_sandbox(password: str, project_id: str = None) -> AsyncSandbox:
    """Create a new sandbox with all required services configured and running. Handles VM limit with LRU deletion."""
    
    logger.debug("Creating new Daytona sandbox environment")
    logger.debug("Configuring sandbox with browser-use image and environment variables")
    
    # Sort by the last_used_ts label. Sandboxes without the label are treated as the oldest.
    def get_sort_key(s):
        if hasattr(s, 'labels') and s.labels and s.labels.get('last_used_ts'):
            try:
                return float(s.labels.get('last_used_ts'))
            except (ValueError, TypeError):
                # Label is malformed, treat as very old.
                return 0
        # No label, treat as very old to prioritize for deletion.
        return 0

    labels = None
    if project_id:
        logger.debug(f"Using sandbox_id as label: {project_id}")
        labels = {'id': project_id}
    
    # Add a last_used timestamp as a label for our LRU policy.
    if labels is None:
        labels = {}
    labels['last_used_ts'] = str(time.time())
        
    params = CreateSandboxFromImageParams(
        image=config.SANDBOX_IMAGE_NAME,
        public=True,
        labels=labels,
        env_vars={
            "CHROME_PERSISTENT_SESSION": "true",
            "RESOLUTION": "1024x768x24",
            "RESOLUTION_WIDTH": "1024",
            "RESOLUTION_HEIGHT": "768",
            "VNC_PASSWORD": password,
            "ANONYMIZED_TELEMETRY": "false",
            "CHROME_PATH": "",
            "CHROME_USER_DATA": "",
            "CHROME_DEBUGGING_PORT": "9222",
            "CHROME_DEBUGGING_HOST": "localhost",
            "CHROME_CDP": ""
        },
        resources=Resources(
            cpu=2,
            memory=4,
            disk=3,
        ),
        auto_stop_interval=15,
        auto_archive_interval=2 * 60,
    )
    
    try:
        # Get current sandbox count
        sandboxes = await daytona.list()
        
        # Log state distribution for debugging (but don't use for counting)
        state_counts = {}
        for s in sandboxes:
            state = s.state
            state_counts[state] = state_counts.get(state, 0) + 1
        logger.info(f"Sandbox state distribution: {state_counts}")
        
        # Count ALL sandboxes (not just active ones)
        total_sandboxes = len(sandboxes)
        logger.info(f"Found {total_sandboxes} total sandboxes. Limit is {config.DAYTONA_MAX_SANDBOXES}")

        # Check if we've reached the sandbox limit
        max_retries = 5
        retry_count = 0
        
        if total_sandboxes >= config.DAYTONA_MAX_SANDBOXES:
            logger.warning(f"Sandbox limit ({config.DAYTONA_MAX_SANDBOXES}) reached. Current count: {total_sandboxes}. Will attempt to free up space.")
        
        while total_sandboxes >= config.DAYTONA_MAX_SANDBOXES and retry_count < max_retries:
            retry_count += 1
            logger.warning(f"Attempt {retry_count}/{max_retries}: Attempting to delete oldest non-active sandboxes.")
            
            # Find deletable sandboxes (stopped or archived)
            deletable_sandboxes = [s for s in sandboxes if s.state in [SandboxState.ARCHIVED, SandboxState.STOPPED]]
            logger.info(f"Found {len(deletable_sandboxes)} deletable sandboxes (stopped/archived)")
            
            if not deletable_sandboxes:
                logger.error("No deletable sandboxes found. Cannot create new sandbox.")
                raise RuntimeError("All agents are busy. Please wait for a slot to become available.")

            # Sort by oldest first (using last_used_ts label)
            deletable_sandboxes.sort(key=get_sort_key)
            
            # Delete up to 5 oldest sandboxes
            sandboxes_to_delete = min(5, len(deletable_sandboxes))
            logger.info(f"Deleting {sandboxes_to_delete} oldest non-active sandboxes")
            
            deleted_count = 0
            failed_count = 0
            for i in range(sandboxes_to_delete):
                oldest = deletable_sandboxes[i]
                last_used = oldest.labels.get('last_used_ts', 'N/A') if hasattr(oldest, 'labels') and oldest.labels else 'N/A'
                logger.info(f"Deleting oldest non-active sandbox {i+1}/{sandboxes_to_delete}: id={getattr(oldest, 'id', 'N/A')}, state={oldest.state}, last_used={last_used}")
                try:
                    await daytona.delete(oldest)
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete sandbox {getattr(oldest, 'id', 'N/A')}: {e}")
                    failed_count += 1
                    # Continue with next sandbox instead of breaking
            
            logger.info(f"Deletion attempt completed: {deleted_count} successful, {failed_count} failed")
            
            # Re-fetch sandbox list and count
            sandboxes = await daytona.list()
            total_sandboxes = len(sandboxes)
            logger.info(f"After deletion: {total_sandboxes} total sandboxes")
            
            # If we're now under the limit, break out of the loop
            if total_sandboxes < config.DAYTONA_MAX_SANDBOXES:
                logger.info(f"Successfully freed up space. Current count: {total_sandboxes}, limit: {config.DAYTONA_MAX_SANDBOXES}")
                break
            else:
                logger.warning(f"Still over limit after deletion. Current count: {total_sandboxes}, limit: {config.DAYTONA_MAX_SANDBOXES}")
        
        # Check if we still can't create a sandbox after all retries
        if total_sandboxes >= config.DAYTONA_MAX_SANDBOXES:
            logger.error(f"Failed to free up space after {max_retries} attempts. Current count: {total_sandboxes}, limit: {config.DAYTONA_MAX_SANDBOXES}")
            raise RuntimeError("No sandbox slots available. Please wait a while and try again.")

        # Final verification that we're under the limit
        if total_sandboxes >= config.DAYTONA_MAX_SANDBOXES:
            logger.error(f"Unexpected state: count ({total_sandboxes}) still >= limit ({config.DAYTONA_MAX_SANDBOXES}) after deletion loop")
            raise RuntimeError("Failed to free up sandbox slots. Please try again later.")

        # Create the new sandbox
        logger.info(f"Proceeding to create new sandbox. Current count: {total_sandboxes}, limit: {config.DAYTONA_MAX_SANDBOXES}")
        sandbox = await daytona.create(params)
        logger.debug(f"Sandbox created with ID: {sandbox.id}")
        
        # Start supervisord in a session for new sandbox
        await start_supervisord_session(sandbox)
        
        logger.info(f"Sandbox environment successfully initialized with ID: {sandbox.id}")
        return sandbox

    except Exception as e:
        logger.error(f"An unexpected error occurred during sandbox creation: {str(e)}")
        # Re-raise the exception after logging
        raise e

async def delete_sandbox(sandbox_id: str) -> bool:
    """Delete a sandbox by its ID."""
    logger.info(f"Deleting sandbox with ID: {sandbox_id}")

    try:
        # Get the sandbox
        sandbox = await daytona.get(sandbox_id)
        
        # Delete the sandbox
        await daytona.delete(sandbox)
        
        logger.info(f"Successfully deleted sandbox {sandbox_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting sandbox {sandbox_id}: {str(e)}")
        raise e
