# Kinbox

A mobile-first web app where one Owner keeps the Movies and Series they want to watch, and have watched, in one place.

## Read first

- `docs/v0.1-scope.md`: what v0.1 builds. It is the spec. Build nothing outside it.
- `CONTEXT.md`: the glossary. Use its terms (Title, Entry, Status, Watch, Progress, Run, Rating, Note) in code, names and tests. Never invent synonyms.
- `docs/future-scope.md`: ideas ruled out for now. Do not build them.
- `.scratch/kinbox-v1/`: the planning map toward v1. Background only; v0.1 scope wins when they differ.

## Stack

Next.js 16.4+ (App Router, Cache Components on), React 19, TypeScript (strict), pnpm, Node 22. Tailwind CSS + shadcn/ui. Postgres on Neon via Drizzle ORM. Better Auth (email + password, sign-up closed). Vercel Hobby. TMDB API v3.

Your training data is out of date for this Next.js version. Read the guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

- `pnpm dev` (port 3100; 3000 is taken on the owner's Mac), `pnpm build`, `pnpm lint` (ESLint; `next lint` no longer exists), `pnpm typecheck`, `pnpm test`.
- The managed `nextjs-agent-rules` block at the end of this file is written by `next dev`. Never edit inside its markers; keep project rules outside them.
- Never install skills with the skills.sh CLI (`npx skills add`).
- Before you call a task done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- `pnpm db:generate` then `pnpm db:migrate` for every schema change. Never `drizzle-kit push` against a shared or production database. Commit migration files.
- `pnpm user:create` makes the Owner's account. There is no sign-up page.

## Branches and worktrees

Several sessions and agents work at once, so work never shares a checkout.

- `main` is production: a push deploys. Code never lands on `main` directly, only by merge. Docs-only commits (decisions, specs) may go straight to `main`.
- Every piece of work gets its own branch and worktree: `git worktree add ../kinbox-<slug> -b <feat|fix|design>/<slug> <base>`, then `pnpm install --frozen-lockfile`. Never work in a worktree another session or agent is using; make a new one. The owner's `post-checkout` hook copies the env files into a new worktree; never copy or print `.env*` files yourself.
- Large work uses an integration branch (for example `design/dock`). Its parts branch off it and merge back into it, so parts that touch different files run in parallel.
- Each worktree runs its dev server on its own port: `BETTER_AUTH_URL=http://localhost:<port> pnpm next dev -p <port>`. The main checkout uses 3100; take the next free port from 3101.
- Tests share one test database, so only one test run happens at a time across worktrees. Take the lock first: `L="$(git rev-parse --git-common-dir)/test.lock"; until mkdir "$L" 2>/dev/null; do sleep 5; done; pnpm test; rmdir "$L"`. Remove a stale lock only when no test run is going.
- Before a merge: rebase onto the target branch, then `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Merging into `main` and pushing need the owner's approval. Show the owner the reviewed and checked result first: code review done, quality checks passed, and how to try it.
- After a merge, delete the branch and its worktree.
- Git hooks guard every worktree (installed by `pnpm install` through `simple-git-hooks`, next to the owner's own `post-checkout`). **pre-commit** refuses code commits on `main`, staged `.env*` files and secret-looking values, then runs `lint-staged` (ESLint `--fix` on the staged files, and a typecheck when TypeScript is staged). The hooks need Node 22.22.1 or later. **pre-push** runs lint, typecheck and the tests under the test lock. Fix what they report; never skip them with `--no-verify` or `SKIP_SIMPLE_GIT_HOOKS=1`. Only the owner may skip a hook.

## Layout

```
src/
  app/            routes; pages and layouts stay thin
  components/     UI; components/ui is shadcn
  domain/         pure Kinbox rules (Status/Watch agreement, Progress, "Next", caught up). No I/O.
  data/           data access layer: server-only, session + ownership checks, returns small DTOs
  db/             Drizzle schema and client
  lib/tmdb/       TMDB client (server-only)
  lib/env.ts      the only place that reads process.env; validates with Zod at startup
  lib/auth.ts     Better Auth config
```

## Next.js rules

- Default to Server Components. Add `'use client'` only for state, effects or browser APIs; keep client components small and pass them narrow props, never DB rows.
- Always `await params`, `searchParams`, `cookies()`, `headers()`.
- Use `proxy.ts` (export `proxy`), never `middleware.ts`.
- Cache Components is on. TMDB reads are cached with `"use cache"` + `cacheLife` in `src/lib/tmdb/cached.ts`. Per-Owner database reads are never cached: they run per request inside `<Suspense>` with a skeleton fallback, so the static shell paints at once.
- After a mutation, a Server Action calls `refresh()` from `next/cache` so the current screen re-renders with fresh data. Screens apply the change optimistically first. Never call `revalidateTag` with one argument.
- Fetch independent data in parallel (`Promise.all`). Use `React.cache` for reads repeated within one request. No waterfalls.
- Import from exact module paths; no barrel files. Lazy-load heavy client code.
- Do not turn on experimental features (taint, etc.) unless the task says so.

## Data and security rules

- Every Server Action and route handler is a public endpoint. Inside each one: get the Owner with `requireOwner()` / `getOwner()` from `src/data/session.ts` (Better Auth's `auth().api.getSession`), validate input with a Zod `.strict()` schema, then call one `data/` function.
- Every `data/` file starts with `import 'server-only'`. Write functions take the `Owner` from `requireOwner()` as their first argument (actions get it through `runAction` in `src/actions/run.ts`); the readers that pages call (`getLibrary`, `getEntry`, `getSeason`, `searchTitles`) call `requireOwner()` themselves. Every query is scoped by `owner.id`. Never trust an id from the client without that ownership check.
- Only `src/db` and `src/data` import the Drizzle client. Use the query builder; never build SQL from strings.
- Return only the fields the UI needs. Errors to the client are generic; log details on the server without tokens, passwords or emails.
- The cookie check in `proxy.ts` is only a fast redirect. Real checks happen on the server.
- Better Auth: `emailAndPassword: { enabled: true, disableSignUp: true }`; `nextCookies()` is the last plugin; the handler lives at `src/app/api/auth/[...all]/route.ts`; the Drizzle adapter comes from `@better-auth/drizzle-adapter`. Confirm Better Auth's rate limit is on for sign-in. Check whether `disableSignUp` also blocks the `user:create` script; if it does, create the user through Better Auth's internal adapter, never by hand-hashing.
- Secrets live in `.env.local` and Vercel env vars, never in code. No secret ever has the `NEXT_PUBLIC_` prefix. Keep `.env.example` up to date with names only.
- Set security headers in `next.config.ts`: CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`. Allow images from `image.tmdb.org` in the CSP.
- Commit `pnpm-lock.yaml`. Add a dependency only when the task needs it.

## Database

- One driver everywhere: `pg` (node-postgres) with `drizzle-orm/node-postgres`, in `src/db/client.ts`. It talks to the local podman Postgres and to Neon alike, and supports interactive transactions. Status/Watch changes that touch two tables must run in one `db().transaction`.
- `DATABASE_URL` is Neon's pooled URL for the app; `DATABASE_URL_UNPOOLED` (the direct URL) is used by drizzle-kit for migrations when set.
- Local development: Postgres 17 in podman (`kinbox-pg`, `127.0.0.1:54329`). Local values live in `.env.development.local`. Tests load `.env.test.local` (Vitest sets `NODE_ENV=test`), whose `TEST_DATABASE_URL` points at the separate `kinbox_test` database that the tests wipe. Scripts and drizzle-kit load env files through `@next/env`, like `next dev`.
- Names in the schema follow `CONTEXT.md`: `entries`, `watches`, `episode_progress`, and so on.

## TMDB

- Call TMDB only from `src/lib/tmdb/` (`server-only`), with `TMDB_API_READ_TOKEN` as a Bearer token. Fixed base URL `https://api.themoviedb.org/3`; never build a URL from user text except as encoded query values; validate TMDB ids as positive integers.
- Treat TMDB responses as untrusted: parse with Zod, and expect nulls (`air_date`, `runtime`, `poster_path`, unnamed upcoming episodes).
- On the owner's home network, `www.themoviedb.org` and `api.themoviedb.org` resolve to `49.44.79.236` and do not connect (probably an ISP DNS block); `image.tmdb.org` works. Local `pnpm dev` calls to TMDB fail there unless the Mac uses a public DNS. Vercel is not affected. If TMDB calls time out locally, say so; do not "fix" the client.
- Specials are season 0. Finished means `status` is `Ended` or `Canceled`.
- Posters: load TMDB's sized images (`https://image.tmdb.org/t/p/w342/...`) with `unoptimized` or a plain `<img>`. Vercel Hobby image optimization has a small monthly limit.
- Show the TMDB logo and the line "This product uses the TMDB API but is not endorsed or certified by TMDB." on the About page.
- Store only the Title snapshot `docs/v0.1-scope.md` lists; refresh it when older than 6 months at most. Do not store episode lists.

## Domain rules

- The rules in `docs/v0.1-scope.md` ("Statuses and Watches", "Series progress") live in `src/domain/` as pure functions, with Vitest tests for every rule and edge case (gaps, Specials, unaired Episodes, finished vs ongoing, unticking).
- Pages and actions call these functions; they never re-implement a rule.

## UI rules

- Mobile-first. Design and check at 375 px width first; desktop is a bigger view of the same screens.
- Screen words must make sense in 2 seconds. Glossary terms (Entry, Watch, Status, Progress) are for code, not screen copy. Use labels like "To watch", "Watched it", "Next: S2 E4".
- Capture is the core: saving a Title or marking an Episode watched takes one tap. Never add a required step to those paths.
- Use shadcn components (`pnpm dlx shadcn@latest add <name>`) before writing your own. Every interactive element is keyboard-reachable and labelled.

## Code style

- Comments explain why, never what. No plan, ticket, session or agent references in code or commit messages.
- Error messages a user sees are plain sentences, never raw field names.
- Delete or update any comment your change makes wrong.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
