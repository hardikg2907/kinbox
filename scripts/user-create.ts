import "./load-env";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import { closeDb } from "@/db/client";
import { createAuth } from "@/lib/auth-config";
import { env } from "@/lib/env";

const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});

async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (hidden) {
    // Keep the password off the screen and out of terminal scrollback.
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) write.call(rl, question);
    };
  }
  const answer = await rl.question(question);
  if (hidden) stdout.write("\n");
  rl.close();
  return answer;
}

async function main(): Promise<void> {
  // Names the target (host and database only, never credentials) so an account is
  // never created in the local database by mistake when production was meant.
  const target = new URL(env().DATABASE_URL);
  stdout.write(`Creating the account in database "${target.pathname.slice(1)}" on ${target.hostname}.\n`);
  // Env vars allow non-interactive runs; they are never echoed.
  const parsed = input.safeParse({
    name: process.env.OWNER_NAME ?? (await ask("Name: ")),
    email: process.env.OWNER_EMAIL ?? (await ask("Email: ")),
    password: process.env.OWNER_PASSWORD ?? (await ask("Password (12+ characters): ", true)),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Check these values and try again: ${fields}`);
  }
  const { name, email, password } = parsed.data;

  // Sign-up is closed, which also blocks auth.api.signUpEmail on the server, so
  // this mirrors what that endpoint does through Better Auth's own adapter and hasher.
  const ctx = await createAuth().$context;
  const normalizedEmail = email.toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(normalizedEmail);
  if (existing?.user) throw new Error("An account with this email already exists.");

  const hash = await ctx.password.hash(password);
  const created = await ctx.internalAdapter.createUser(
    { email: normalizedEmail, name, emailVerified: true },
    { method: "email-password" },
  );
  if (!created) throw new Error("Could not create the account.");
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  });
  stdout.write("Account created. Sign in with that email and password.\n");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Something went wrong."}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
