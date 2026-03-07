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
- `cd frontend && npm ci && npm run dev`: run frontend locally.
- `cd frontend && npm run lint`: run frontend lint checks.
- `cd frontend && npm run build`: production build check.
- `curl http://localhost:8000/api/health`: quick backend health check.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, type hints, `snake_case` module/function names.
- Keep DDD boundaries strict: `domain` should not depend on `infrastructure`.
- TypeScript: keep `strict`-safe code and explicit types at API boundaries.
- React components use `PascalCase` file names (for example `ServiceForm.tsx`).
- Hooks/stores use `camelCase` with `use` prefix (for example `useServices.ts`, `useAuthStore.ts`).

## Testing Guidelines
Automated tests are not fully wired yet; treat lint/build and manual API checks as the minimum gate.

- Add backend tests under `backend/tests/<layer>/test_*.py`.
- Prefer `pytest` + async test patterns for FastAPI/SQLAlchemy behavior.
- For frontend changes, run `npm run lint` and verify affected dashboard/login flows manually.

## Commit & Pull Request Guidelines
- Follow the existing history style: concise, scope-first summaries (often Korean), one topic per commit.
- Preferred format: `<영역>: <변경 요약>` (example: `서비스: 도메인 라우팅 검증 추가`).
- PRs should include purpose, key changes, verification steps, and related issue/doc links.
- Include screenshots or short recordings for UI-impacting changes.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and replace all placeholder secrets before running.
- Never commit `.env`, tokens, or generated credentials.
- Validate changes touching `traefik-config/dynamic` and Authentik integration with non-production credentials first.
