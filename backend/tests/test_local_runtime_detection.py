from core.local_runner.service import is_local_sandbox_id, uses_local_runtime


def test_is_local_sandbox_id():
    assert is_local_sandbox_id("local:b33edfb7-cb2a-4437-a4b0-6fd831c26c1b")
    assert not is_local_sandbox_id("734b2dff-85b5-44ef-a637-61c9108fd07b")
    assert not is_local_sandbox_id(None)
    assert not is_local_sandbox_id("")


def test_uses_local_runtime():
    assert uses_local_runtime("local")
    assert uses_local_runtime("LOCAL")
    assert uses_local_runtime("cloud", "local:abc")
    assert not uses_local_runtime("cloud", "734b2dff-85b5-44ef-a637-61c9108fd07b")
    assert not uses_local_runtime(None, None)
