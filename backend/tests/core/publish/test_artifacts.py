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


def test_pick_entry_prefers_newest_report_over_stale_index():
    """Dedicated workspace: today's report.html must beat yesterday's athenaion/index.html."""
    paths = [
        "athenaion/index.html",
        "athenaion.html",
        "anthropic-s1-report/index.html",
        "reports/huang/report.html",
        "video/scene.html",
    ]
    mtimes = {
        "athenaion/index.html": "2026-11-06 03:35:40 +0000 UTC",
        "athenaion.html": "2026-11-06 03:39:01 +0000 UTC",
        "anthropic-s1-report/index.html": "2026-10-29 19:52:37 +0000 UTC",
        "reports/huang/report.html": "2026-11-09 05:44:41.990502936 +0000 UTC",
        "video/scene.html": "2026-10-02 04:54:20 +0000 UTC",
    }
    assert pick_entry_html(paths, mtimes=mtimes) == "reports/huang/report.html"


def test_pick_entry_project_name_beats_newer_unrelated():
    paths = [
        "reports/huang/report.html",
        "athenaion/index.html",
    ]
    mtimes = {
        "reports/huang/report.html": "100",
        "athenaion/index.html": "999",
    }
    assert (
        pick_entry_html(paths, mtimes=mtimes, project_name="Huang GTC report")
        == "reports/huang/report.html"
    )


def test_site_root_nested_report_folder():
    assert site_root_for_entry("reports/huang/report.html") == "reports/huang"


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


def test_filter_nested_report_excludes_sibling_projects():
    paths = [
        "reports/huang/report.html",
        "reports/huang/cover.png",
        "reports/other/index.html",
        "athenaion/index.html",
        "athenaion/model.glb",
    ]
    entry = "reports/huang/report.html"
    assert filter_files_for_entry(paths, entry) == [
        "reports/huang/report.html",
        "reports/huang/cover.png",
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
