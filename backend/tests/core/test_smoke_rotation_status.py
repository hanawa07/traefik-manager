import pytest

from app.core.smoke_rotation_status import classify_smoke_rotation_failure


@pytest.mark.parametrize(
    ("step", "expected"),
    [
        ("viewer 계정 갱신", "account_update"),
        ("admin 계정 갱신", "account_update"),
        ("회전 후 viewer·admin 스모크 검증", "smoke_validation"),
        ("Node.js 실행 환경 준비", "execution"),
        (None, "execution"),
    ],
)
def test_classify_smoke_rotation_failure(step, expected) -> None:
    assert classify_smoke_rotation_failure(step) == expected
