import ast
from pathlib import Path


def test_main_lifespan_runs_auth_cleanup_once_and_starts_background_loop():
    backend_root = Path(__file__).resolve().parents[2]
    source = (backend_root / "app" / "main.py").read_text(encoding="utf-8")
    module = ast.parse(source)

    lifespan = next(
        node
        for node in module.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "lifespan"
    )

    cleanup_once_calls = [
        node
        for node in ast.walk(lifespan)
        if isinstance(node, ast.Await)
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id == "_cleanup_auth_state_once"
    ]
    assert cleanup_once_calls, "lifespan must run auth cleanup once on startup"

    create_task_calls = [
        node
        for node in ast.walk(lifespan)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "asyncio"
        and node.func.attr == "create_task"
    ]
    assert create_task_calls, "lifespan must start auth cleanup background task"
