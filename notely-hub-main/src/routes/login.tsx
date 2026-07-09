import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Music2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Rocky" },
      { name: "description", content: "Log in to Rocky to continue." },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signInWithPassword, signUpWithPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → bounce to home.
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!isSupabaseConfigured) {
      setError(
        "Supabase isn't configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
      );
      return;
    }

    setSubmitting(true);
    const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const { error: authError } = await fn(email.trim(), password);
    setSubmitting(false);

    if (authError) {
      setError(authError);
      return;
    }

    if (mode === "signup") {
      setNotice(
        "Account created. If email confirmation is enabled, check your inbox to verify, then log in.",
      );
      setMode("signin");
      return;
    }

    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-elevated to-background text-foreground flex flex-col items-center px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-10 text-xl font-bold">
        <span className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
          <Music2 className="size-5" />
        </span>
        Rocky
      </Link>

      <div className="w-full max-w-sm rounded-xl bg-card/60 border border-border p-8">
        <h1 className="text-2xl font-bold text-center mb-1">
          {mode === "signin" ? "Log in to Rocky" : "Sign up for Rocky"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          {mode === "signin"
            ? "Enter your details to continue."
            : "Create an account to start listening."}
        </p>

        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            Supabase isn't configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> to enable login.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2.5 text-sm outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2.5 text-sm outline-none transition"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-sm text-primary" role="status">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-primary text-primary-foreground font-bold py-3 hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100 grid place-items-center"
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : mode === "signin" ? (
              "Log in"
            ) : (
              "Sign up"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                }}
                className="text-foreground font-semibold underline hover:text-primary"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="text-foreground font-semibold underline hover:text-primary"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
