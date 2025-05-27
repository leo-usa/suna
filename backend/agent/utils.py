import uuid
from utils.logger import logger
from sandbox.sandbox import create_sandbox, get_or_start_sandbox
import os
import re
from typing import List

async def get_or_create_project_sandbox(client, project_id: str):
    """Get or create a sandbox for a project."""
    project = await client.table('projects').select('*').eq('project_id', project_id).execute()
    if not project.data:
        raise ValueError(f"Project {project_id} not found")
    project_data = project.data[0]

    if project_data.get('sandbox', {}).get('id'):
        sandbox_id = project_data['sandbox']['id']
        sandbox_pass = project_data['sandbox']['pass']
        logger.info(f"Project {project_id} already has sandbox {sandbox_id}, retrieving it")
        try:
            sandbox = await get_or_start_sandbox(sandbox_id)
            return sandbox, sandbox_id, sandbox_pass
        except Exception as e:
            logger.error(f"Failed to retrieve existing sandbox {sandbox_id}: {str(e)}. Creating a new one.")

    logger.info(f"Creating new sandbox for project {project_id}")
    sandbox_pass = str(uuid.uuid4())
    sandbox = create_sandbox(sandbox_pass, project_id)
    sandbox_id = sandbox.id
    logger.info(f"Created new sandbox {sandbox_id}")

    vnc_link = sandbox.get_preview_link(6080)
    website_link = sandbox.get_preview_link(8080)
    vnc_url = vnc_link.url if hasattr(vnc_link, 'url') else str(vnc_link).split("url='")[1].split("'")[0]
    website_url = website_link.url if hasattr(website_link, 'url') else str(website_link).split("url='")[1].split("'")[0]
    token = None
    if hasattr(vnc_link, 'token'):
        token = vnc_link.token
    elif "token='" in str(vnc_link):
        token = str(vnc_link).split("token='")[1].split("'")[0]

    update_result = await client.table('projects').update({
        'sandbox': {
            'id': sandbox_id, 'pass': sandbox_pass, 'vnc_preview': vnc_url,
            'sandbox_url': website_url, 'token': token
        }
    }).eq('project_id', project_id).execute()

    if not update_result.data:
        logger.error(f"Failed to update project {project_id} with new sandbox {sandbox_id}")
        raise Exception("Database update failed")

    return sandbox, sandbox_id, sandbox_pass

# --- Web Share Helpers ---
def find_html_reports(workspace_dir: str) -> List[str]:
    """Find all HTML report files in the workspace directory."""
    html_files = []
    for root, _, files in os.walk(workspace_dir):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))
    return html_files

def extract_image_paths_from_html(html_content: str) -> List[str]:
    """Extract all image src paths from HTML content."""
    # Match <img src="..."> and <img src='...'>
    img_srcs = re.findall(r'<img[^>]+src=["\\\']([^"\\\']+)["\\\']', html_content)
    return img_srcs 