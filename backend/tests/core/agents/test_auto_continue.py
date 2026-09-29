import json

from core.agents.pipeline.stateless.coordinator.auto_continue import AutoContinueChecker


def _finish(reason: str, **extra) -> dict:
    return {
        "type": "status",
        "content": json.dumps({"status_type": "finish", "finish_reason": reason, **extra}),
        "metadata": {},
    }


def test_length_with_output_still_continues():
    should_continue, terminate = AutoContinueChecker.check(_finish("length"), count=0, max_continues=25)
    assert should_continue is True
    assert terminate is False


def test_empty_length_does_not_continue():
    should_continue, terminate = AutoContinueChecker.check(
        _finish("length", empty_output=True),
        count=1,
        max_continues=25,
    )
    assert should_continue is False
    assert terminate is False
