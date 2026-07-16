import asyncio
import fcntl
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from pathlib import Path
from typing import TextIO

logger = logging.getLogger(__name__)
MANAGER_SLOTS = {"single", "blue", "green"}


def is_manager_slot_active(slot: str, route_path: Path) -> bool:
    normalized_slot = slot.strip().lower()
    if normalized_slot not in MANAGER_SLOTS:
        return False
    try:
        route_config = route_path.read_text(encoding="utf-8")
    except OSError:
        return False
    frontend_name = "traefik-manager-frontend"
    if normalized_slot != "single":
        frontend_name = f"{frontend_name}-{normalized_slot}"
    return f'url: "http://{frontend_name}:3000"' in route_config


async def supervise_background_tasks(
    *,
    enabled: bool,
    slot: str,
    route_path: Path,
    lease_path: Path,
    run_active: Callable[[], Awaitable[None]],
    poll_seconds: float = 2.0,
) -> None:
    if not enabled:
        logger.info("background task 실행이 비활성화되어 있습니다")
        await asyncio.Event().wait()

    waiting_reason = ""
    while True:
        if not is_manager_slot_active(slot, route_path):
            waiting_reason = _log_waiting_once(waiting_reason, "inactive", slot)
            await asyncio.sleep(poll_seconds)
            continue

        try:
            lease = _try_acquire_lease(lease_path)
        except OSError:
            logger.exception("background task lease 파일을 열지 못했습니다: %s", lease_path)
            await asyncio.sleep(poll_seconds)
            continue
        if lease is None:
            waiting_reason = _log_waiting_once(waiting_reason, "lease", slot)
            await asyncio.sleep(poll_seconds)
            continue

        waiting_reason = ""
        logger.info("background task leader 활성화: slot=%s", slot)
        active_task = asyncio.create_task(run_active())
        try:
            while is_manager_slot_active(slot, route_path):
                done, _ = await asyncio.wait({active_task}, timeout=poll_seconds)
                if done:
                    await active_task
                    break
        except Exception:
            logger.exception("background task leader 실행 실패, 재시도합니다: slot=%s", slot)
        finally:
            active_task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await active_task
            _release_lease(lease)
            logger.info("background task leader 해제: slot=%s", slot)
        await asyncio.sleep(poll_seconds)


def _log_waiting_once(previous: str, current: str, slot: str) -> str:
    if previous == current:
        return previous
    if current == "inactive":
        logger.info("background task standby: active route가 아님 (slot=%s)", slot)
    else:
        logger.info("background task standby: 다른 backend가 leader임 (slot=%s)", slot)
    return current


def _try_acquire_lease(path: Path) -> TextIO | None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        return None
    return handle


def _release_lease(handle: TextIO) -> None:
    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    handle.close()
