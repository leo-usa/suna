# Agent Sandbox

This directory contains the agent sandbox implementation - a Docker-based virtual environment that agents use as their own computer to execute tasks, access the web, and manipulate files.

## Overview

The sandbox provides a complete containerized Linux environment with:
- Chrome browser for web interactions
- VNC server for accessing the Web User
- Web server for serving content (port 8080) -> loading html files from the /workspace directory
- Full file system access
- Full sudo access

## Customizing the Sandbox

You can modify the sandbox environment for development or to add new capabilities:

1. Edit files in the `docker/` directory
2. Build a custom image:
   ```
   cd backend/sandbox/docker
   docker compose build
   docker push kortix/suna:0.1.3.30
   ```
3. Test your changes locally using docker-compose

## Using a Custom Snapshot

To use your custom sandbox snapshot:

1. Change the `image` parameter in `docker-compose.yml` (that defines the image name `kortix/suna:___`)
2. Build and create a snapshot in Daytona with the same name
3. Update the snapshot name in `backend/sandbox/sandbox.py` in the `create_sandbox` function
4. If using Daytona for deployment, update the snapshot reference there as well

## Local Daytona Setup Troubleshooting

If the UI shows `Created File failed` and the computer panel stays on `Computer not running`, first verify that Daytona can create the configured sandbox snapshot. In this branch, the backend expects:

```
kortix/suna:0.1.3.30
```

The snapshot name is configured in `backend/core/utils/config.py` as `SANDBOX_SNAPSHOT_NAME`, and `backend/core/sandbox/sandbox.py` passes that value to Daytona when creating a sandbox.

### Symptoms

- The agent can answer with text but file tools fail.
- Tool results contain `Failed to resolve sandbox for project ...`.
- The project has no `sandbox_resource_id`.
- Daytona creation fails with `Snapshot kortix/suna:0.1.3.30 not found`.

### Fix

Build and push the sandbox image to Daytona with the exact snapshot name expected by the backend:

```bash
cd backend/core/sandbox/docker
docker compose build

daytona snapshot push kortix/suna:0.1.3.30 \
  --name kortix/suna:0.1.3.30 \
  --entrypoint "/usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf" \
  --region us
```

Then verify the snapshot is active:

```bash
daytona snapshot list
```

The `kortix/suna:0.1.3.30` snapshot must be `Active`. Inactive or missing snapshots cannot create sandboxes.

### Verify From The Backend

From `backend/`, run:

```bash
uv run python - <<'PY'
import asyncio
from core.sandbox.sandbox import daytona

async def main():
    snapshot = await daytona.snapshot.get("kortix/suna:0.1.3.30")
    print(snapshot.name, snapshot.image_name, snapshot.state)

asyncio.run(main())
PY
```

After the snapshot is active, restart the backend and start a new agent run. Existing failed projects can also recover once `resolve_sandbox` successfully creates and links a sandbox resource.

## Publishing New Versions

When publishing a new version of the sandbox:

1. Update the version number in `docker-compose.yml` (e.g., from `0.1.2` to `0.1.3`)
2. Build the new image: `docker compose build`
3. Push the new version: `docker push kortix/suna:0.1.3`
4. Create a new snapshot in Daytona with the same name
5. Update all references to the snapshot version in:
   - `backend/utils/config.py`
   - Daytona snapshots
   - Any other services using this snapshot