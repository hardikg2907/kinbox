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
   - `.env.development.local`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3100`.
   - `.env.test.local`: `TEST_DATABASE_URL` (the `kinbox_test` database), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
   - `.env.local`: `TMDB_API_READ_TOKEN`. Without it, development uses the bundled TMDB fixtures. Set `TMDB_FAKE=1` to force the fixtures.

4. Create the tables, then your account. It asks for your name, email and a password of 12+ characters, and hides the password as you type:

   ```sh
   pnpm db:migrate
   pnpm user:create
   ```

   `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` can replace the prompts, but only for CI, where they come from a secret store. Never put a password on a command line: it stays in your shell history.

5. Start the app and open <http://localhost:3100> (port 3000 is taken on this Mac):

   ```sh
   pnpm dev
   ```

   To try it on your phone on the same Wi-Fi, open the `Network:` address that `pnpm dev` prints (for example `http://192.168.29.31:3100`). In development the Mac's own network addresses are trusted, so sign-in works there too.

If TMDB calls time out at home, the network's DNS is blocking themoviedb.org: set the Mac's DNS to 1.1.1.1 or 8.8.8.8. The live site is not affected.

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm test` runs the domain and TMDB unit tests and the data-layer tests against the separate `kinbox_test` database (it wipes that database, never the main one).

Git hooks run the same checks for you. `pnpm install` installs them. Before a commit they lint the staged files, typecheck, and stop code commits on `main`, `.env*` files and secret-looking values. Before a push they run lint, typecheck and the tests.

## Deploying (later)

Vercel Hobby with Neon Postgres (Vercel → Storage sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`). Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the site's `https://` URL; plain http is refused in production) and `TMDB_API_READ_TOKEN` in the Vercel project settings.

- `vercel.json` sets the Next.js preset and the build command `pnpm db:migrate:deploy && pnpm build`. Production deploys apply the database migrations first, through `DATABASE_URL_UNPOOLED`; preview deploys skip them, so a preview never changes the production schema. A failed migration fails the deploy.
- Node 22 (`engines.node`), the same as local.
- After the first production deploy, create your account against Neon: run `pnpm user:create` with `DATABASE_URL` set to the Neon URL in that shell only (for example from `vercel env pull`).

Vercel Hobby and TMDB's free tier are non-commercial. Both need paid plans once Kinbox earns money.
