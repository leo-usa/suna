from core.publish.thumbnails import (
    extract_image_refs_from_html,
    pick_thumbnail_url,
    resolve_html_ref,
)


def test_extract_prefers_og_then_img_then_icon():
    html = """
    <html><head>
      <meta property="og:image" content="hero.png" />
      <link rel="icon" href="favicon.png" />
    </head><body>
      <img src="photo.jpg" />
    </body></html>
    """
    refs = extract_image_refs_from_html(html)
    assert refs[0] == "hero.png"
    assert "photo.jpg" in refs
    assert "favicon.png" in refs


def test_resolve_relative_and_absolute():
    rel_to_url = {"assets/hero.png": "https://cdn.example/hero.png"}
    assert resolve_html_ref("assets/hero.png", rel_to_url) == "https://cdn.example/hero.png"
    assert resolve_html_ref("https://cdn.example/x.jpg", {}) == "https://cdn.example/x.jpg"
    assert resolve_html_ref("data:image/png;base64,abc", {}) is None
    assert resolve_html_ref("logo.svg", {"logo.svg": "https://cdn.example/logo.svg"}) is None


def test_pick_thumbnail_from_html_over_workspace():
    html = '<img src="./shots/cover.webp" alt="cover" />'
    rel_to_url = {"shots/cover.webp": "https://cdn.example/cover.webp"}
    url = pick_thumbnail_url(
        html_content=html,
        rel_to_url=rel_to_url,
        workspace_image_urls=["https://cdn.example/other.png"],
    )
    assert url == "https://cdn.example/cover.webp"


def test_pick_thumbnail_skips_favicon_when_content_image_exists():
    html = """
    <link rel="icon" href="favicon.png" />
    <img src="gallery/main.jpg" />
    """
    rel_to_url = {
        "favicon.png": "https://cdn.example/favicon.png",
        "gallery/main.jpg": "https://cdn.example/main.jpg",
    }
    url = pick_thumbnail_url(html_content=html, rel_to_url=rel_to_url)
    assert url == "https://cdn.example/main.jpg"


def test_pick_thumbnail_falls_back_to_workspace_then_existing():
    assert (
        pick_thumbnail_url(workspace_image_urls=["https://cdn.example/a.png"])
        == "https://cdn.example/a.png"
    )
    assert (
        pick_thumbnail_url(existing_thumbnail="https://cdn.example/old.png")
        == "https://cdn.example/old.png"
    )
    assert pick_thumbnail_url() == ""
