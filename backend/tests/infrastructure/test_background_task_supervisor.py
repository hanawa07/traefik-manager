import asyncio
from contextlib import suppress

import pytest

from app.background_task_supervisor import (
    is_manager_slot_active,
    supervise_background_tasks,
)


def test_manager_slot_activation_follows_route_upstream(tmp_path):
    route_path = tmp_path / "traefik-manager-self.yml"
    route_path.write_text(
        'servers:\n  - url: "http://traefik-manager-frontend-blue:3000"\n',
        encoding="utf-8",
    )

    assert is_manager_slot_active("single", route_path) is False
    assert is_manager_slot_active("blue", route_path) is True
    assert is_manager_slot_active("green", route_path) is False
    assert is_manager_slot_active("unknown", route_path) is False

    route_path.write_text(
        'servers:\n  - url: "http://traefik-manager-frontend:3000"\n',
        encoding="utf-8",
    )
    assert is_manager_slot_active("single", route_path) is True


@pytest.mark.asyncio
async def test_background_leader_hands_over_when_active_slot_changes(tmp_path):
    route_path = tmp_path / "traefik-manager-self.yml"
    lease_path = tmp_path / "background-tasks.lock"
    route_path.write_text(
        'servers:\n  - url: "http://traefik-manager-frontend-blue:3000"\n',
        encoding="utf-8",
    )
    blue_started = asyncio.Event()
    blue_stopped = asyncio.Event()
    green_started = asyncio.Event()

    async def run_blue():
        blue_started.set()
        try:
            await asyncio.Event().wait()
        finally:
            blue_stopped.set()

    async def run_green():
        green_started.set()
        await asyncio.Event().wait()

    blue_task = asyncio.create_task(
        supervise_background_tasks(
            enabled=True,
            slot="blue",
            route_path=route_path,
            lease_path=lease_path,
            run_active=run_blue,
            poll_seconds=0.01,
        )
    )
    green_task = asyncio.create_task(
        supervise_background_tasks(
            enabled=True,
            slot="green",
            route_path=route_path,
            lease_path=lease_path,
            run_active=run_green,
            poll_seconds=0.01,
        )
    )
    await asyncio.wait_for(blue_started.wait(), timeout=1)
    assert green_started.is_set() is False

    route_path.write_text(
        'servers:\n  - url: "http://traefik-manager-frontend-green:3000"\n',
        encoding="utf-8",
    )
    await asyncio.wait_for(blue_stopped.wait(), timeout=1)
    await asyncio.wait_for(green_started.wait(), timeout=1)

    blue_task.cancel()
    green_task.cancel()
    with suppress(asyncio.CancelledError):
        await blue_task
    with suppress(asyncio.CancelledError):
        await green_task
