from core.tools.sb_shell_tool import executed_exit_code, shell_command_with_done_marker


def test_failed_command_still_prints_marker():
    wrapped = shell_command_with_done_marker("python3 edit_v32.py", "MARKER")
    assert wrapped.startswith("set +e; ")
    assert wrapped.endswith("; __ec=$?; echo 'MARKER' $__ec\n")


def test_heredoc_keeps_delimiter_on_its_own_line():
    wrapped = shell_command_with_done_marker("cat << 'EOF'\nhello\nEOF", "MARKER")
    assert wrapped.startswith("set +e\n")
    eof_at = wrapped.index("\nEOF\n")
    marker_at = wrapped.index("echo 'MARKER'")
    assert eof_at < marker_at


def test_exit_code_ignores_typed_marker_and_carriage_returns():
    typed = "set +e; python3 -c \"print(1)\"; __ec=$?; echo 'MARKER' $__ec\r\n"
    finished = typed + "\rfont name Calibri size None\r\nMARKER 0\r\n"
    assert executed_exit_code(typed, "MARKER") is None
    assert executed_exit_code(finished, "MARKER") == 0


def test_exit_code_reads_failure_after_traceback():
    typed = "set +e; python3 edit_v32.py; __ec=$?; echo 'MARKER' $__ec\n"
    finished = typed + "ValueError: not found\nMARKER 1\n"
    assert executed_exit_code(finished, "MARKER") == 1


def test_double_input_echo_is_not_completion():
    typed = "echo 'MARKER' $__ec\n"
    assert executed_exit_code(typed + typed, "MARKER") is None
