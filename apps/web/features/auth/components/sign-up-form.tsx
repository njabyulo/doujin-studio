"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Film } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { signUpEmail } from "~/lib/auth-api";
import { buildAuthHref, getSafeNextPath } from "~/lib/auth-navigation";
import { ApiClientError } from "~/lib/assets-api";

const mapAuthError = (error: unknown) => {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return "An account with this email already exists.";
    }

    if (error.status === 429) {
      return "Too many attempts. Please try again shortly.";
    }
  }

  return "Could not create your account. Please try again.";
};

export const SignUpForm = ({ next }: { next?: string }) => {
  const router = useRouter();
  const nextPath = getSafeNextPath(next);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signInHref = buildAuthHref("/auth/sign-in", nextPath);

  return (
    <div className="ds-light min-h-screen">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-44 -top-44 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.7),rgba(255,221,189,0))] blur-3xl" />
        <div className="absolute -right-36 top-24 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.6),rgba(190,215,255,0))] blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
        <div className="glassPanel w-full max-w-md p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)]">
              <Film className="h-5 w-5 text-[color:var(--ds-accent-warm)]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[color:var(--ds-muted)]">
                Doujin Studio
              </p>
              <h1 className="display-font text-2xl font-semibold text-[color:var(--ds-text)]">
                Create account
              </h1>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isSubmitting) return;

              setError(null);
              setIsSubmitting(true);
              try {
                await signUpEmail({ name: name.trim(), email, password });
                router.replace(nextPath);
              } catch (caughtError) {
                setError(mapAuthError(caughtError));
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ds-text)]">
                Name
              </label>
              <Input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ds-text)]">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ds-text)]">
                Password
              </label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <Button
              type="submit"
              variant="accent"
              className="w-full rounded-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-sm text-[color:var(--ds-muted)]">
            Already have an account?{" "}
            <Link
              href={signInHref}
              className="font-semibold text-[color:var(--ds-text)]"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};
