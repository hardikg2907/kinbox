# Kinbox

Your movies and series, in one place. A mobile-first web app for one Owner: save a Title in one tap, keep your place in a Series, and pick what to watch tonight.

- Spec: [`docs/v0.1-scope.md`](docs/v0.1-scope.md). Decisions: [`docs/decisions-v0.1.md`](docs/decisions-v0.1.md). Design: [`docs/design.md`](docs/design.md). Glossary: [`CONTEXT.md`](CONTEXT.md). Rules for coding agents: [`AGENTS.md`](AGENTS.md).
- Stack: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS + shadcn/ui, Postgres + Drizzle (node-postgres), Better Auth, TMDB API v3.

## Run it locally

Needs Node 22, pnpm 10 and podman.

1. Install packages:

   ```sh
   pnpm install
   ```

2. Start the database. The container `kinbox-pg` keeps its data in the podman volume `kinbox-pg-data`:

   ```sh
   podman start kinbox-pg
   ```

   To create it from scratch instead, put your own password in `.env.development.local` (see `.env.example`) and run
   `podman run -d --name kinbox-pg -p 127.0.0.1:54329:5432 -e POSTGRES_USER=kinbox -e POSTGRES_PASSWORD=<that password> -e POSTGRES_DB=kinbox -v kinbox-pg-data:/var/lib/postgresql/data docker.io/library/postgres:17-alpine`.

3. Environment files (never committed):
   - `.env.development.local`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3100`, `TEST_DATABASE_URL`.
   - `.env.local`: `TMDB_API_READ_TOKEN`. Without it, development uses the bundled TMDB fixtures. Set `TMDB_FAKE=1` to force the fixtures.

4. Create the tables, then your account (it asks for your name, email and a password of 12+ characters):

   ```sh
   pnpm db:migrate
   pnpm user:create
   ```

5. Start the app and open <http://localhost:3100> (port 3000 is taken on this Mac):

   ```sh
   pnpm dev
   ```

   To try it on your phone on the same Wi-Fi, open `http://<your Mac's IP>:3100`. Sign-in cookies need the address in `BETTER_AUTH_URL`, so set it to that address while you test from the phone.

If TMDB calls time out at home, the network's DNS is blocking themoviedb.org: set the Mac's DNS to 1.1.1.1 or 8.8.8.8. The live site is not affected.

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm test` runs the domain and TMDB unit tests and the data-layer tests against the separate `kinbox_test` database (it wipes that database, never the main one).

## Deploying (later)

Vercel Hobby with Neon Postgres (Vercel → Storage sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`). Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the site's URL) and `TMDB_API_READ_TOKEN` in the Vercel project settings, run `pnpm db:migrate` against Neon once, then `pnpm user:create` with the Neon URL.

Vercel Hobby and TMDB's free tier are non-commercial. Both need paid plans once Kinbox earns money.
