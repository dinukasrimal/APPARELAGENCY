# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript app code.
  - `components/` (PascalCase UI), `pages/` (route views), `hooks/` (prefixed `use*`), `services/` (domain logic, e.g., `odoo.service.ts`), `utils/` (helpers), `types/` (TS models).
- `public/` static assets, `assets/` design/media.
- `scripts/` Node helpers and SQL for integration and data setup.
- `supabase/` project resources; `android/` Capacitor wrapper; `dist/` build output.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server.
- `npm run build`: Production build to `dist/`.
- `npm run preview`: Preview built app locally.
- `npm run lint`: Lint TypeScript/JS with ESLint.
- Integration utilities (see `scripts/`):
  - `npm run test:external`, `npm run test:integration`, `npm run test:final`: Validate external connections and end‑to‑end flows.
  - `npm run check:agencies`, `npm run add:agencies`, `npm run debug:nexus`: Operational checks and debugging.

## Coding Style & Naming Conventions
- Language: TypeScript, React, Vite, Tailwind, shadcn-ui.
- Indentation: 2 spaces; semicolons optional per file style; single quotes or double consistently.
- Components: PascalCase (`OdooInvoiceSync.tsx`), hooks: `useX.ts/tsx`, services: `*.service.ts`, utils: camelCase, types: nouns in singular (`product.ts`).
- Use ESLint defaults in `eslint.config.js`; keep `no-unused-vars` noise low by removing dead code.

## Testing Guidelines
- No Jest/Vitest; rely on script-based checks and manual QA via `npm run dev`.
- Keep changes small; add validation in `scripts/` when touching integrations.
- Prefer pure functions in `utils/` with unit-friendly design; colocate quick ad-hoc checks under `scripts/` when needed.

## Commit & Pull Request Guidelines
- Use Conventional Commits style: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`.
- PRs: include a concise description, linked issue, and screenshots/GIFs for UI changes.
- Require: `npm run lint` clean and `npm run build` passing before request review.
- Update related docs when modifying `scripts/` or SQL.

## Security & Configuration Tips
- Copy `env.example` to `.env`; never commit secrets.
- Supabase, Odoo, and Google APIs are used—ensure keys are set before running integration scripts.
- Android (Capacitor): rebuild mobile shell after config changes.
