from app.core.smoke_rotation_log import read_smoke_rotation_log_tail


def test_read_smoke_rotation_log_tail_limits_and_sanitizes(tmp_path) -> None:
    log_path = tmp_path / "rotation.log"
    log_path.write_text(
        "\n".join([f"line-{index}" for index in range(15)] + ["\x1b[31mfailure\x1b[0m"]),
        encoding="utf-8",
    )

    lines, updated_at = read_smoke_rotation_log_tail(str(log_path), max_lines=3)

    assert lines == ["line-13", "line-14", "failure"]
    assert updated_at is not None


def test_read_smoke_rotation_log_tail_handles_missing_file(tmp_path) -> None:
    lines, updated_at = read_smoke_rotation_log_tail(str(tmp_path / "missing.log"))

    assert lines == []
    assert updated_at is None
