import { createAuthClient } from "better-auth/client";

// Sign-in goes through the /api/auth route, where Better Auth applies its
// rate limit; direct server calls to auth.api would skip it.
export const authClient = createAuthClient();
