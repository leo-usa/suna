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
        logger.info(f"Found {len(sandboxes)} existing sandboxes. Limit is {config.DAYTONA_MAX_SANDBOXES}")

        # Log all sandbox states for debugging
        state_counts = {}
        for s in sandboxes:
            state = s.state
            state_counts[state] = state_counts.get(state, 0) + 1
        logger.info(f"Sandbox states: {state_counts}")

        # Count sandboxes that are not in terminal states (DESTROYED, ERROR, BUILD_FAILED)
        # These are the ones that count towards our limit
        active_states = [SandboxState.CREATING, SandboxState.RESTORING, SandboxState.STARTED, 
                        SandboxState.STOPPED, SandboxState.STARTING, SandboxState.STOPPING, 
                        SandboxState.PENDING_BUILD, SandboxState.BUILDING_SNAPSHOT, 
                        SandboxState.UNKNOWN, SandboxState.PULLING_SNAPSHOT, 
                        SandboxState.ARCHIVING, SandboxState.ARCHIVED]
        
        # Define problematic states that should NOT count toward the limit
        # These are sandboxes that are stuck and can't be deleted
        problematic_states = [SandboxState.DESTROYING, SandboxState.ERROR, SandboxState.BUILD_FAILED]
        
        # Count sandboxes that count toward limit (exclude problematic stuck states)
        count_towards_limit = [s for s in sandboxes if s.state in active_states and s.state not in problematic_states]
        
        # Log stuck sandboxes for monitoring
        stuck_sandboxes = [s for s in sandboxes if s.state in problematic_states]
        if stuck_sandboxes:
            logger.warning(f"Found {len(stuck_sandboxes)} stuck sandboxes in problematic states: {[s.state for s in stuck_sandboxes]}")
            for s in stuck_sandboxes:
                logger.warning(f"Stuck sandbox: id={getattr(s, 'id', 'N/A')}, state={s.state}")
        logger.info(f"Sandboxes counting towards limit: {len(count_towards_limit)} (out of {len(sandboxes)} total)")
        
        # Show effective limit calculation
        stuck_count = len(stuck_sandboxes)
        effective_limit = config.DAYTONA_MAX_SANDBOXES - stuck_count
        logger.info(f"Stuck sandboxes: {stuck_count}, Effective limit: {effective_limit} (original: {config.DAYTONA_MAX_SANDBOXES})")

        # Check if we've reached the effective sandbox limit
        while len(count_towards_limit) >= effective_limit:
            logger.warning(f"Effective sandbox limit ({effective_limit}) reached. Current count: {len(count_towards_limit)}. Original limit: {config.DAYTONA_MAX_SANDBOXES}. Attempting to delete oldest non-active sandboxes.")
            
            # Filter for non-active sandboxes from the FULL sandbox list (including stuck ones)
            # Then exclude stuck ones from deletion candidates
            all_non_active = [s for s in sandboxes if s.state in [SandboxState.ARCHIVED, SandboxState.STOPPED]]
            non_active = [s for s in all_non_active if s.state not in problematic_states]
            logger.info(f"Found {len(non_active)} deletable non-active sandboxes out of {len(all_non_active)} total non-active (excluding {len(all_non_active) - len(non_active)} stuck ones)")
            
            if not non_active:
                logger.error("All sandboxes are active, but limit is reached. Cannot create new sandbox.")
                raise RuntimeError("All agents are busy. Please wait for a slot to become available.")

            # Log all candidates for deletion
            for s in non_active:
                last_used = s.labels.get('last_used_ts', 'N/A') if hasattr(s, 'labels') and s.labels else 'N/A'
                logger.info(f"Non-active sandbox: id={getattr(s, 'id', 'N/A')}, state={s.state}, last_used_ts={last_used}")
            
            non_active.sort(key=get_sort_key)
            
            # Calculate how many to delete to get well under the effective limit
            # Delete enough to get to 5 below effective limit to provide buffer
            target_count = effective_limit - 5
            sandboxes_to_delete = len(count_towards_limit) - target_count
            
            # Delete multiple oldest sandboxes at once
            sandboxes_to_delete = min(sandboxes_to_delete, len(non_active))
            logger.info(f"Deleting {sandboxes_to_delete} oldest non-active sandboxes to reach target count of {target_count}")
            
            deleted_count = 0
            for i in range(sandboxes_to_delete):
                oldest = non_active[i]
                logger.info(f"Deleting oldest non-active sandbox {i+1}/{sandboxes_to_delete}: {getattr(oldest, 'id', 'N/A')}")
                await daytona.delete(oldest)
                deleted_count += 1
            
            logger.info(f"Successfully deleted {deleted_count} sandboxes")
            
            # Wait for Daytona to free up the slots and then re-fetch the list
            await asyncio.sleep(3)
            sandboxes = await daytona.list()
            count_towards_limit = [s for s in sandboxes if s.state in active_states]
            logger.info(f"Re-checked sandbox count. Found {len(count_towards_limit)} sandboxes counting towards limit.")

        # Create the new sandbox
        logger.info(f"Creating new sandbox. Current count: {len(count_towards_limit)}, effective limit: {effective_limit}, original limit: {config.DAYTONA_MAX_SANDBOXES}")
        sandbox = await daytona.create(params)
        logger.debug(f"Sandbox created with ID: {sandbox.id}")
        
        # Start supervisord in a session for new sandbox
        await start_supervisord_session(sandbox)
        
        logger.debug(f"Sandbox environment successfully initialized")
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
