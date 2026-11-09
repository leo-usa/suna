from core.publish.branding import BADGE_MARKER, inject_dobby_badge, strip_dobby_badge


def test_inject_badge_before_body_close():
    html = "<html><body><h1>Hi</h1></body></html>"
    out = inject_dobby_badge(html)
    assert BADGE_MARKER in out
    assert "utm_source=published_site" in out
    assert out.index(BADGE_MARKER) < out.lower().rindex("</body>")


def test_inject_is_idempotent():
    html = inject_dobby_badge("<html><body>x</body></html>")
    again = inject_dobby_badge(html)
    assert again.count('id="dobby-publish-badge-style"') == 1
    assert again.count("Made with Dobby") == 1


def test_strip_badge():
    html = inject_dobby_badge("<html><body>x</body></html>")
    clean = strip_dobby_badge(html)
    assert BADGE_MARKER not in clean
