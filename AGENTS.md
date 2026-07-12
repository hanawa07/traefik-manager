# Repository Guidelines

## Project Structure & Module Organization
This repository is split into a FastAPI backend and a Next.js frontend.

- `backend/app`: service code organized by DDD layers (`domain`, `application`, `infrastructure`, `interfaces`).
- `backend/tests`: backend test tree (currently scaffolded as `domain`, `application`, `infrastructure`).
- `frontend/src/app`: Next.js App Router pages and layouts.
- `frontend/src/features`: feature-scoped UI/API/state modules (for example `features/services`).
- `frontend/src/shared`: cross-feature components and utilities.
- `traefik-config/dynamic`: generated Traefik file-provider YAML output.
- `docs`: architecture and roadmap documentation.

## Build, Test, and Development Commands
- `docker compose up --build`: build and run full stack (frontend + backend).
- `docker compose logs -f backend`: follow backend logs.
- `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`: run backend locally.
- `cd backend && alembic upgrade head`: apply the latest DB migrations.
- `cd backend && alembic revision --autogenerate -m "add xxx column"`: generate a new migration after editing models.
- `cd frontend && npm ci && npm run dev`: run frontend locally.
- `cd frontend && npm run lint`: run frontend lint checks.
- `cd frontend && npm run build`: production build check.
- `curl https://<FRONTEND_DOMAIN>/api/health`: frontend를 통해 backend까지 확인하는 운영 health check.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, type hints, `snake_case` module/function names.
- Keep DDD boundaries strict: `domain` should not depend on `infrastructure`.
- TypeScript: keep `strict`-safe code and explicit types at API boundaries.
- React components use `PascalCase` file names (for example `ServiceForm.tsx`).
- Hooks/stores use `camelCase` with `use` prefix (for example `useServices.ts`, `useAuthStore.ts`).
- One file should own one feature or one clear responsibility.
- New or refactored files must stay under 500 lines. If a legacy file already exceeds 500 lines, do not grow it further except for urgent fixes; add a `PONYTAIL-DEBT(...)` marker and plan a split.

## Testing Guidelines
Automated tests are not fully wired yet; treat lint/build and manual API checks as the minimum gate.

- Add backend tests under `backend/tests/<layer>/test_*.py`.
- Prefer `pytest` + async test patterns for FastAPI/SQLAlchemy behavior.
- For frontend changes, run `npm run lint` and verify affected dashboard/login flows manually.

## Agent Workflow Requirements
- 기본 작업 방식은 포니테일 스킬을 우선 적용한다.
- 코딩 변경이 끝나면 반드시 관련 테스트, lint, build 또는 수동 API 검증 중 변경 범위에 맞는 검증을 수행한다.
- 테스트 후 포니테일 리뷰까지 완료하고, 결과와 남은 리스크를 사용자에게 보고한다.
- 코드 변경이 완료되면 변경 단위별로 파일을 나눠 스테이징하고, `<영역>: <변경 요약>` 형식의 한글 커밋을 만든 뒤 현재 브랜치를 GitHub에 푸시한다.
- 관련 없는 사용자 변경, 로컬 백업, `.env`, 비밀값, 생성물은 커밋에 포함하지 않는다.
- 같은 리팩토링/개선 묶음 안에서 안전하게 이어서 진행할 수 있는 작업은 사용자에게 매번 `ㄱ`를 요구하지 말고 계획, 구현, 검증, 커밋, 푸시까지 연속으로 진행한다.
- 작업이 끝나면 결과 보고 마지막 줄에 `다음 작업: ...` 형식으로 바로 진행 가능한 후보를 여러 개 제안한다.

## Commit & Pull Request Guidelines
- Follow the existing history style: concise, scope-first summaries (often Korean), one topic per commit.
- Preferred format: `<영역>: <변경 요약>` (example: `서비스: 도메인 라우팅 검증 추가`).
- PRs should include purpose, key changes, verification steps, and related issue/doc links.
- Include screenshots or short recordings for UI-impacting changes.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and replace all placeholder secrets before running.
- Never commit `.env`, tokens, or generated credentials.
- Validate changes touching `traefik-config/dynamic` and Authentik integration with non-production credentials first.

## Database Migrations
- Alembic is the source of truth for schema changes; do not add new SQLite `ALTER TABLE` patches in `database.py`.
- Workflow: update `backend/app/infrastructure/persistence/models.py`, run `cd backend && alembic revision --autogenerate -m "..."`, review the generated file, then run `cd backend && alembic upgrade head`.
- Existing production DBs created before Alembic adoption must be stamped once: `cd backend && alembic stamp head` after confirming the live schema already matches the initial migration.
