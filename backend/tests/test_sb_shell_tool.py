from core.tools.sb_shell_tool import executed_exit_code, shell_command_with_done_marker


def test_marker_is_armed_before_multiline_command():
    command = 'cd /workspace && timeout 60 python3 -c "\nprint(1)\n"'
    wrapped = shell_command_with_done_marker(command, "MARKER")
    assert wrapped.startswith("PROMPT_COMMAND='echo MARKER $?'; set +e; ")
    assert wrapped.endswith('print(1)\n"\n')


def test_heredoc_keeps_delimiter_on_its_own_line():
    wrapped = shell_command_with_done_marker("cat << 'EOF'\nhello\nEOF", "MARKER")
    assert wrapped.startswith("PROMPT_COMMAND='echo MARKER $?'\nset +e\n")
    assert wrapped.index("\nEOF\n") > wrapped.index("set +e\n")


def test_prompt_hook_counts_once_after_printed_output():
    typed = "PROMPT_COMMAND='echo MARKER $?'; set +e; python3 -c \"\nprint(1)\n\"\n"
    finished = (
        typed
        + "Anthropic Model Restriction -> 1\n"
        + "Hong Kong Customers. -> 1\n"
        + "Note – Hong Kong -> 0\n"
        + "MARKER 0\n"
    )
    assert executed_exit_code(typed, "MARKER") is None
    assert executed_exit_code(finished, "MARKER") == 0


def test_exit_code_reads_failure_and_ignores_carriage_returns():
    output = "PROMPT_COMMAND='echo MARKER $?'\r\nValueError: not found\r\nMARKER 1\r\n"
    assert executed_exit_code(output, "MARKER") == 1
