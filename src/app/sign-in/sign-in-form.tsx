"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function messageFor(status: number | undefined): string {
  if (status === 401 || status === 400) return "That email and password don't match. Check them and try again.";
  if (status === 429) return "Too many tries. Wait a minute, then try again.";
  return "Couldn't sign in. Check your connection and try again.";
}

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailField = useRef<HTMLInputElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({ email, password, rememberMe: true });
      if (signInError) {
        setError(messageFor(signInError.status));
        // The submit button was disabled while the request ran, so focus would otherwise be lost.
        emailField.current?.focus();
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form id="sign-in-form" onSubmit={onSubmit} className="glass mt-10 border flex flex-col gap-5 rounded-3xl p-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="pl-1">
          Email
        </Label>
        <Input
          ref={emailField}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-in-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="pl-1">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-in-error" : undefined}
        />
      </div>
      <p id="sign-in-error" role="alert" className="min-h-5 px-1 text-sm text-destructive">
        {error}
      </p>
      <Button id="sign-in-submit" type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
