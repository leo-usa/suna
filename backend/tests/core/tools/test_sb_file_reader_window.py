"""Unit tests for read_file line window + model-aware size budget."""

from core.tools.sb_file_reader_tool import apply_line_window, max_output_chars_for_model


def test_apply_line_window_offset_and_limit():
    content = "a\nb\nc\nd\ne\n"
    text, meta = apply_line_window(content, offset=2, limit=2)
    assert text == "b\nc\n"
    assert meta["start_line"] == 2
    assert meta["end_line"] == 3
    assert meta["lines_returned"] == 2
    assert meta["total_lines"] == 5


def test_apply_line_window_shortens_long_lines():
    content = "short\n" + ("x" * 5000) + "\n"
    text, meta = apply_line_window(content, offset=1, limit=2, max_line_chars=20)
    assert "short\n" in text
    assert "line truncated at 20 chars" in text
    assert meta["lines_shortened"] == 1


def test_max_output_chars_scales_with_large_context_models():
    # Unknown model falls back to a generous minimum budget.
    assert max_output_chars_for_model(None) >= 80_000
    # Fable / 1M-context models should allow a large one-shot read.
    fable_budget = max_output_chars_for_model("dobby/claude-fable-5.2")
    assert fable_budget >= 176_000  # customer paper size that previously truncated
    assert fable_budget <= 500_000
