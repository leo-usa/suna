import html
import json
import mimetypes
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from core.publish.artifacts import (
    IMAGE_EXTS,
    VIDEO_EXTS,
    classify_rel_paths,
    pick_entry_html,
    public_storage_url,
    should_skip_rel_path,
)
from core.publish.language import detect_language_from_fields
from core.publish.slug import slugify_title
from core.sandbox.resolver import resolve_sandbox
from core.services.supabase import DBConnection
from core.threads.repo import get_first_user_message_content
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter(tags=["publish"])
db = DBConnection()

SHARE_BUCKET = "share"
MAX_FILES = 150
MAX_FILE_BYTES = 15 * 1024 * 1024
DAYTONA_HOST_RE = re.compile(r"(preview\.|daytona|trycloudflare|ngrok)", re.I)


class PublishRequest(BaseModel):
    project_id: str
    thread_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class CommunityLikeRequest(BaseModel):
    post_id: str


def _storage_base() -> str:
    return (config.SUPABASE_URL or "").rstrip("/")


def _html_url(html_path: str) -> str:
    return public_storage_url(_storage_base(), SHARE_BUCKET, html_path)


def _work_path(row: dict) -> str:
    return f"/works/{row.get('slug') or row.get('id')}"


def _serialize_post(row: dict) -> dict:
    html_path = row.get("html_path") or ""
    thumbnail = row.get("thumbnail_path") or ""
    if thumbnail and not thumbnail.startswith("http"):
        thumbnail = _html_url(thumbnail)
    return {
        "id": row["id"],
        "title": row.get("title") or "",
        "user_name": row.get("user_name") or "",
        "like_count": row.get("like_count") or 0,
        "description": row.get("description") or "",
        "thumbnail_path": thumbnail,
        "created_at": row.get("created_at"),
        "html_url": _html_url(html_path) if html_path else "",
        "html_path": html_path,
        "artifact_type": row.get("artifact_type") or "site",
        "language": row.get("language") or "en",
        "slug": row.get("slug"),
        "url": _work_path(row),
        "thread_id": row.get("thread_id"),
        "files": row.get("files") or [],
    }


async def _fetch_post(client, key: str) -> dict | None:
    if not key:
        return None
    by_slug = await client.table("community_posts").select("*").eq("slug", key).limit(1).execute()
    if by_slug.data:
        return by_slug.data[0]
    by_id = await client.table("community_posts").select("*").eq("id", key).limit(1).execute()
    if by_id.data:
        return by_id.data[0]
    return None


async def _unique_slug(client, title: str) -> str:
    base = slugify_title(title)
    slug = base
    suffix = 2
    while True:
        existing = await client.table("community_posts").select("id").eq("slug", slug).limit(1).execute()
        if not existing.data:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1
        if suffix > 50:
            return f"{base}-{uuid.uuid4().hex[:6]}"


def _extract_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, dict):
        return str(content.get("content") or content.get("text") or "")
    if isinstance(content, str):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return str(parsed.get("content") or parsed.get("text") or content)
        except Exception:
            return content
    return str(content)


async def _list_workspace_files(sandbox) -> list[tuple[str, str]]:
    files: list[tuple[str, str]] = []
    stack = ["/workspace"]
    while stack:
        current = stack.pop()
        try:
            entries = await sandbox.fs.list_files(current)
        except Exception as e:
            logger.warning(f"[PUBLISH] list_files failed for {current}: {e}")
            continue
        for entry in entries:
            name = getattr(entry, "name", "")
            if not name:
                continue
            full_path = f"{current.rstrip('/')}/{name}"
            rel_path = full_path[len("/workspace/"):] if full_path.startswith("/workspace/") else full_path
            if should_skip_rel_path(rel_path):
                continue
            if getattr(entry, "is_dir", False):
                stack.append(full_path)
            else:
                files.append((full_path, rel_path.replace("\\", "/")))
            if len(files) >= MAX_FILES:
                return files
    return files


def _inject_base_href(html_content: str, base_href: str) -> str:
    base_tag = f'<base href="{html.escape(base_href, quote=True)}">'
    if re.search(r"<base\s[^>]*>", html_content, re.I):
        html_content = re.sub(r"<base\s[^>]*>", base_tag, html_content, count=1, flags=re.I)
    elif re.search(r"<head[^>]*>", html_content, re.I):
        html_content = re.sub(r"(<head[^>]*>)", r"\1" + base_tag, html_content, count=1, flags=re.I)
    else:
        html_content = f"<!DOCTYPE html><html><head>{base_tag}</head><body>{html_content}</body></html>"
    referrer_meta = '<meta name="referrer" content="no-referrer">'
    if not re.search(r'<meta[^>]+name=["\']referrer["\']', html_content, re.I):
        html_content = re.sub(r"(<head[^>]*>)", r"\1" + referrer_meta, html_content, count=1, flags=re.I)
    return html_content


def _asset_folder(post_id: str, files: list | None, html_path: str | None = None) -> str:
    rels = []
    for item in files or []:
        if isinstance(item, dict) and item.get("path"):
            rels.append(item["path"])
        elif isinstance(item, str):
            rels.append(item)
    entry = pick_entry_html(rels)
    prefix = f"community/{post_id}"
    if entry:
        folder = os.path.dirname(entry.replace("\\", "/")).strip("/")
        return f"{prefix}/{folder}" if folder else prefix
    if html_path and "/" in html_path:
        return html_path.rsplit("/", 1)[0]
    return prefix


def _rewrite_preview_urls(html_content: str, rel_to_url: dict[str, str]) -> str:
    def repl(match: re.Match) -> str:
        attr, value = match.group(1), match.group(2)
        if not DAYTONA_HOST_RE.search(value):
            return match.group(0)
        parsed = urlparse(value)
        rel = parsed.path.lstrip("/")
        if rel.startswith("workspace/"):
            rel = rel[len("workspace/"):]
        if rel in rel_to_url:
            return f'{attr}="{rel_to_url[rel]}"'
        return match.group(0)

    return re.sub(r'(src|href)=["\']([^"\']+)["\']', repl, html_content)


def _generated_index(title: str, files: list[dict], artifact_type: str) -> str:
    safe_title = html.escape(title or "Published work")
    items = []
    for item in files:
        url = html.escape(item.get("url") or "", quote=True)
        name = html.escape(item.get("path") or "file")
        ext = os.path.splitext((item.get("path") or "").lower())[1]
        if ext in IMAGE_EXTS:
            items.append(f'<figure><img src="{url}" alt="{name}"/><figcaption>{name}</figcaption></figure>')
        elif ext in VIDEO_EXTS:
            items.append(f'<figure><video src="{url}" controls></video><figcaption>{name}</figcaption></figure>')
        elif ext == ".pdf":
            items.append(f'<p><a href="{url}" target="_blank" rel="noopener">{name}</a></p><iframe src="{url}" style="width:100%;height:70vh;border:0"></iframe>')
        else:
            items.append(f'<p><a href="{url}" target="_blank" rel="noopener">{name}</a></p>')
    body = "\n".join(items) or "<p>No files in this publish.</p>"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{safe_title}</title>
<style>
body{{font-family:system-ui,sans-serif;margin:24px;color:#111;background:#fafafa}}
h1{{font-size:1.4rem}}
figure{{margin:0 0 1.5rem}}
img,video{{max-width:100%;height:auto;border-radius:8px}}
a{{color:#111}}
</style></head>
<body><h1>{safe_title}</h1>
<p style="color:#666;font-size:13px">{html.escape(artifact_type)}</p>
{body}
</body></html>"""


async def _user_display_name(user_id: str) -> str:
    try:
        client = await db.client
        auth_user = await client.auth.admin.get_user_by_id(user_id)
        meta = getattr(auth_user.user, "user_metadata", None) or {}
        name = meta.get("name") or meta.get("full_name")
        if name:
            return name
        email = getattr(auth_user.user, "email", None)
        if email:
            return email.split("@")[0]
    except Exception as e:
        logger.warning(f"[PUBLISH] Could not load user name: {e}")
    return "Anonymous"


@router.get("/community")
async def list_community_posts(
    lang: str = Query("en"),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    language = "zh" if lang.lower().startswith("zh") else "en"
    sort_field = sort_by if sort_by in ("created_at", "like_count") else "created_at"
    descending = order != "asc"
    client = await db.client
    query = client.table("community_posts").select("*").eq("approved", True)
    count_query = client.table("community_posts").select("id", count="exact").eq("approved", True)
    if language == "zh":
        query = query.eq("language", "zh")
        count_query = count_query.eq("language", "zh")
    else:
        query = query.eq("language", "en")
        count_query = count_query.eq("language", "en")
    posts = await query.order(sort_field, desc=descending).range(offset, offset + limit - 1).execute()
    count_result = await count_query.execute()
    total = getattr(count_result, "count", None) or 0
    return {"posts": [_serialize_post(p) for p in (posts.data or [])], "total": total}


@router.get("/community/post/{post_id:path}")
async def get_community_post(post_id: str):
    client = await db.client
    row = await _fetch_post(client, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize_post(row)


@router.post("/community/like")
async def like_community_post(
    body: CommunityLikeRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    client = await db.client
    try:
        result = await client.rpc("increment_like_count", {"post_id": body.post_id}).execute()
        like_count = result.data if isinstance(result.data, int) else None
        if like_count is None:
            post = await client.table("community_posts").select("like_count").eq("id", body.post_id).maybe_single().execute()
            if not post or not post.data:
                raise HTTPException(status_code=404, detail="Post not found")
            like_count = post.data["like_count"]
        return {"success": True, "post_id": body.post_id, "like_count": like_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to like post: {e}")


@router.get("/public-html/{post_id:path}")
async def serve_public_html(post_id: str):
    client = await db.client
    post_data = await _fetch_post(client, post_id)
    if not post_data:
        raise HTTPException(status_code=404, detail="Post not found")
    html_path = post_data.get("html_path")
    if not html_path:
        raise HTTPException(status_code=404, detail="HTML file not found")

    storage_url = _html_url(html_path)
    async with httpx.AsyncClient(timeout=30) as http:
        response = await http.get(storage_url)
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="HTML file not found in storage")
        html_content = response.content.decode("utf-8", errors="replace")

    folder = _asset_folder(str(post_data.get("id") or post_id), post_data.get("files"), html_path)
    base_href = public_storage_url(_storage_base(), SHARE_BUCKET, folder) + "/"
    html_content = _inject_base_href(html_content, base_href)

    og_title = html.escape(post_data.get("title") or "Work")
    og_description = html.escape((post_data.get("description") or og_title)[:240])
    thumbnail = post_data.get("thumbnail_path") or ""
    if thumbnail and not thumbnail.startswith("http"):
        thumbnail = _html_url(thumbnail) if "/" in thumbnail else thumbnail
    og_image = html.escape(thumbnail or "https://dobby.now/dobby-logo.svg", quote=True)
    post_url = f"https://dobby.now{_work_path(post_data)}"
    meta_tags = f"""
        <meta property="og:title" content="{og_title}" />
        <meta property="og:description" content="{og_description}" />
        <meta property="og:image" content="{og_image}" />
        <meta property="og:url" content="{post_url}" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Dobby" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{og_title}" />
        <meta name="twitter:description" content="{og_description}" />
        <meta name="twitter:image" content="{og_image}" />
        <link rel="canonical" href="{post_url}" />
    """
    if re.search(r"<head[^>]*>", html_content, re.I):
        html_content = re.sub(r"(<head[^>]*>)", r"\1" + meta_tags, html_content, count=1, flags=re.I)
    else:
        html_content = f"<!DOCTYPE html><html><head>{meta_tags}</head><body>{html_content}</body></html>"

    return Response(content=html_content.encode("utf-8"), media_type="text/html")


@router.post("/publish")
async def publish_work(
    body: PublishRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    client = await db.client
    project = (
        await client.table("projects")
        .select("project_id, account_id, name")
        .eq("project_id", body.project_id)
        .maybe_single()
        .execute()
    )
    if not project or not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    account_id = str(project.data.get("account_id") or user_id)
    if account_id != user_id:
        member = (
            await client.schema("basejump")
            .table("account_user")
            .select("user_id")
            .eq("account_id", account_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not member.data:
            raise HTTPException(status_code=403, detail="Not authorized to publish this project")

    sandbox_info = await resolve_sandbox(
        project_id=body.project_id,
        account_id=account_id,
        db_client=client,
        require_started=True,
    )
    if not sandbox_info:
        raise HTTPException(
            status_code=409,
            detail="Sandbox is not available. Start the project computer and try Publish again.",
        )

    workspace_files = await _list_workspace_files(sandbox_info.sandbox)
    if not workspace_files:
        raise HTTPException(status_code=400, detail="No files found in the project workspace to publish.")

    title = (body.title or project.data.get("name") or "Untitled").strip()
    description = (body.description or "").strip()
    if not description and body.thread_id:
        first_msg = await get_first_user_message_content(body.thread_id)
        description = _extract_text(first_msg).strip() or "Published from Dobby"
    if not description:
        description = "Published from Dobby"

    post_id = str(uuid.uuid4())
    rel_to_url: dict[str, str] = {}
    uploaded: list[dict] = []
    image_urls: list[str] = []
    text_sample_parts: list[str] = [title, description]

    for full_path, rel_path in workspace_files:
        try:
            file_bytes = await sandbox_info.sandbox.fs.download_file(full_path)
        except Exception as e:
            logger.warning(f"[PUBLISH] skip {rel_path}: {e}")
            continue
        if not file_bytes or len(file_bytes) > MAX_FILE_BYTES:
            continue
        content_type, _ = mimetypes.guess_type(rel_path)
        storage_path = f"community/{post_id}/{rel_path}"
        try:
            await client.storage.from_(SHARE_BUCKET).upload(
                storage_path,
                file_bytes,
                {"content-type": content_type or "application/octet-stream", "upsert": "true"},
            )
        except Exception as e:
            logger.warning(f"[PUBLISH] upload failed {rel_path}: {e}")
            continue
        url = public_storage_url(_storage_base(), SHARE_BUCKET, storage_path)
        rel_to_url[rel_path] = url
        uploaded.append({"path": rel_path, "url": url})
        ext = os.path.splitext(rel_path.lower())[1]
        if ext in IMAGE_EXTS:
            image_urls.append(url)
        if ext in {".html", ".htm", ".md", ".txt"} and len(text_sample_parts) < 4:
            try:
                text_sample_parts.append(file_bytes.decode("utf-8", errors="ignore")[:2000])
            except Exception:
                pass

    if not uploaded:
        raise HTTPException(status_code=400, detail="Could not upload any workspace files.")

    artifact_type = classify_rel_paths([item["path"] for item in uploaded])
    language = detect_language_from_fields(*text_sample_parts)
    entry_html = pick_entry_html([item["path"] for item in uploaded])
    html_path = f"community/{post_id}/index.html"
    folder_base = public_storage_url(
        _storage_base(),
        SHARE_BUCKET,
        _asset_folder(post_id, uploaded, html_path),
    ) + "/"

    if entry_html:
        try:
            raw = await sandbox_info.sandbox.fs.download_file(f"/workspace/{entry_html}")
            html_content = raw.decode("utf-8", errors="replace")
        except Exception:
            html_content = _generated_index(title, uploaded, artifact_type)
        html_content = _rewrite_preview_urls(html_content, rel_to_url)
        html_content = _inject_base_href(html_content, folder_base)
    else:
        html_content = _generated_index(title, uploaded, artifact_type)

    await client.storage.from_(SHARE_BUCKET).upload(
        html_path,
        html_content.encode("utf-8"),
        {"content-type": "text/html", "upsert": "true"},
    )

    thumbnail_path = image_urls[0] if image_urls else ""
    user_name = await _user_display_name(user_id)
    slug = await _unique_slug(client, title)
    thread_id = None
    if body.thread_id:
        try:
            thread_id = str(uuid.UUID(body.thread_id))
        except Exception:
            thread_id = None

    try:
        await client.table("community_posts").insert({
            "id": post_id,
            "user_id": user_id,
            "user_name": user_name,
            "title": title,
            "html_path": html_path,
            "description": description,
            "thumbnail_path": thumbnail_path,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "like_count": 0,
            "approved": True,
            "artifact_type": artifact_type,
            "slug": slug,
            "thread_id": thread_id,
            "language": language,
            "files": uploaded,
        }).execute()
    except Exception as e:
        logger.error(f"[PUBLISH] insert failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save the published work.")

    return {
        "success": True,
        "id": post_id,
        "post_id": post_id,
        "url": _work_path({"slug": slug, "id": post_id}),
        "artifact_type": artifact_type,
        "language": language,
        "html_url": _html_url(html_path),
    }
