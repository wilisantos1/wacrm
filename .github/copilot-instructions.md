# Copilot instructions for wacrm

## Project shape

- This is a self-hostable WhatsApp CRM built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase (Postgres, Auth, Storage, and RLS).
- `src/app/` contains App Router pages and API route handlers. Authenticated dashboard pages are grouped under `(dashboard)`; external integrations and the public REST API are implemented as route handlers under `api/`.
- `src/components/` contains feature UI, while `src/lib/` holds domain logic and integrations (WhatsApp, automations, flows, AI, webhooks, and API helpers). Keep reusable business logic in `src/lib/` rather than duplicating it in routes or components.
- `supabase/migrations/` is the ordered database schema and policy history. Add schema, indexes, functions, and RLS changes as a new numbered migration; update application code to match.
- The standalone `mcp-server/` package is a thin MCP adapter over the app's `/api/v1` REST API; its own development and build commands are in `mcp-server/README.md`.
- The root layout loads translations through `next-intl`; locale catalogs are in `messages/`. Keep user-facing text consistent with that setup.

## Data access and authorization

- `@/*` aliases to `src/*`.
- Use `src/lib/supabase/server.ts` for server-side requests and `src/lib/supabase/client.ts` for browser code. The server client reads request cookies; do not import it, or modules depending on it, into client components.
- Dashboard APIs should resolve the signed-in user's account with `getCurrentAccount()` or enforce the minimum role with `requireRole()` from `src/lib/auth/account.ts`. Follow the existing typed error/response handling there.
- Public `/api/v1` routes authenticate with `requireApiKey(request, scope)` from `src/lib/auth/api-context.ts`. This uses a service-role client that bypasses RLS, so every domain query must explicitly scope records to `ctx.accountId`.
- Tenant ownership is based on `account_id` and account membership/role policies, not just the original user ownership model. Preserve account scoping and RLS when changing queries or migrations.
- Keep Meta/WhatsApp credentials and privileged Supabase access on the server. Follow existing helpers for encryption, webhook verification, API-key scopes, rate limiting, and response envelopes rather than implementing parallel mechanisms.

## Build, test, and lint

Use Node.js 20 or newer and npm.

| Purpose | Command |
| --- | --- |
| Development server | `npm run dev` |
| Production build | `npm run build` |
| Run production server | `npm start` |
| Lint | `npm run lint` |
| TypeScript check | `npm run typecheck` |
| All tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Format check | `npm run format:check` |
| Apply formatting | `npm run format` |

Tests use Vitest, run in Node, and are included from `src/**/*.test.ts` and `src/**/*.test.tsx`. Run one file with `npm test -- src/lib/whatsapp/encryption.test.ts`; select tests by name with `npm test -- src/lib/whatsapp/encryption.test.ts -t "test name"`.

The CI build and tests provide dummy values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, and `META_APP_SECRET`; local build/test commands may need corresponding environment variables. Do not use production credentials for tests.

## Framework guidance

This repository uses Next.js 16. Before changing Next.js APIs or conventions, read the relevant guide under `node_modules/next/dist/docs/` and heed its deprecation notices. This is also required by the repository's `AGENTS.md` and `CLAUDE.md`.

For project setup, Supabase, WhatsApp, deployment, and API behavior, use the docs linked from `README.md` and the relevant files under `docs/`.
