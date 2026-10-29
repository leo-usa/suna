from core.publish.artifacts import (
    filter_files_for_entry,
    pick_entry_html,
    site_root_for_entry,
)


def test_pick_entry_prefers_newest_nested_index():
    paths = [
        "video/scene.html",
        "hello.html",
        "anthropic-s1-report/index.html",
        "old-site/index.html",
    ]
    mtimes = {
        "video/scene.html": "100",
        "hello.html": "200",
        "old-site/index.html": "300",
        "anthropic-s1-report/index.html": "900",
    }
    assert pick_entry_html(paths, mtimes=mtimes) == "anthropic-s1-report/index.html"


def test_pick_entry_still_accepts_root_index():
    paths = ["index.html", "assets/a.png", "old/index.html"]
    mtimes = {"index.html": "500", "old/index.html": "100", "assets/a.png": "500"}
    assert pick_entry_html(paths, mtimes=mtimes) == "index.html"


def test_filter_nested_site_excludes_siblings():
    paths = [
        "anthropic-s1-report/index.html",
        "anthropic-s1-report/chart.png",
        "video/enc.log",
        "video/scene.html",
        "dobby_api_ad.mp4",
    ]
    entry = "anthropic-s1-report/index.html"
    assert site_root_for_entry(entry) == "anthropic-s1-report"
    assert filter_files_for_entry(paths, entry) == [
        "anthropic-s1-report/index.html",
        "anthropic-s1-report/chart.png",
    ]


def test_filter_root_entry_drops_other_sites():
    paths = [
        "index.html",
        "style.css",
        "assets/logo.png",
        "mario/index.html",
        "mario/game.js",
        "video/clip.mp4",
    ]
    kept = filter_files_for_entry(paths, "index.html")
    assert kept == ["index.html", "style.css", "assets/logo.png", "video/clip.mp4"]
