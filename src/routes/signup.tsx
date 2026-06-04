import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Sign up — BloxSmith" },
      {
        name: "description",
        content:
          "Create a free BloxSmith account to start building Roblox games with AI — 150 starter credits, no card required, sync straight into Studio.",
      },
      { property: "og:title", content: "Sign up for BloxSmith — Free Roblox AI Builder" },
      {
        property: "og:description",
        content:
          "Start building Roblox games with AI in minutes. Free starter credits, no credit card, instant Roblox Studio sync.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/signup" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/signup" }],
  }),
});

function SignupPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const formatAuthError = (message: string) => {
    if (message.includes("weak_password") || message.includes("known to be weak")) {
      return "That password is too weak or has appeared in known leaks. Use a longer, more unique password.";
    }
    if (message.includes("email_address_invalid")) {
      return "Please enter a valid email address.";
    }
    if (message.includes("email_exists") || message.includes("already registered")) {
      return "That email already has an account. Try logging in instead.";
    }
    if (message.includes("email_domain_not_allowed")) {
      return "That email domain is blocked. Please use a real, non-disposable email address.";
    }
    return message;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref");
    if (r) {
      const clean = r.trim().toLowerCase();
      setRefCode(clean);
      localStorage.setItem("bloxsmith_ref", clean);
    } else {
      const stored = localStorage.getItem("bloxsmith_ref");
      if (stored) setRefCode(stored);
    }
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { display_name: name, ref: refCode ?? undefined },
        },
      });
      if (error) {
        const message = formatAuthError(error.message);
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      if (data.session) {
        toast.success("Account created — you’re now signed in.");
        nav({ to: "/dashboard" });
        return;
      }

      const message = "Account created. Check your email and confirm your address before logging in.";
      setSuccessMessage(message);
      toast.success(message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed — please try again.";
      setErrorMessage(formatAuthError(msg));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth/callback",
    });
    if (res.error) toast.error(res.error.message ?? "Sign up failed");
  };

  const handleApple = async () => {
    const res = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin + "/auth/callback",
    });
    if (res.error) toast.error(res.error.message ?? "Sign up failed");
  };

  const resendSignupEmail = async () => {
    const target = email.trim();
    if (!target) {
      toast.error("Enter the email you signed up with first.");
      return;
    }
    setResendLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        const message = formatAuthError(error.message);
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      const message = `Confirmation email resent to ${target}. Check spam/promotions too.`;
      setSuccessMessage(message);
      toast.success(message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not resend confirmation email.";
      setErrorMessage(formatAuthError(msg));
      toast.error(msg);
    } finally {
      setResendLoading(false);
    }
  };


  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md glass-strong rounded-2xl p-8">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <img src={logo} alt="BloxSmith logo" width={36} height={36} className="h-9 w-9" />
          <span className="text-xl font-bold">
            Blox<span className="gradient-text">Smith</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-center">Create your account</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Get 150 free credits to start, plus 10 free daily.
        </p>
        {errorMessage && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary-glow">
            {successMessage}
          </p>
        )}
        {refCode && (
          <p className="text-xs text-center mt-2 text-primary-glow">
            🎁 Referral applied: <span className="font-mono">{refCode}</span> — +10 bonus credits
            after signup.
          </p>
        )}
        <a
          href="https://discord.gg/ZzdqTpntB"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-xs rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#a3b1ff] hover:bg-[#5865F2]/20 py-2 font-semibold transition"
        >
          + Join our Discord for an extra 10 credits
        </a>
        <button
          onClick={handleGoogle}
          className="mt-6 w-full rounded-lg border border-border bg-surface py-2.5 text-sm font-medium hover:bg-surface-elevated"
        >
          Continue with Google
        </button>
        <button
          onClick={handleApple}
          className="mt-2 w-full rounded-lg border border-border bg-black text-white py-2.5 text-sm font-medium hover:bg-black/85 inline-flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM228.3 89.4c20.7-24.6 18.9-47 18.3-55-18.4 1.1-39.7 12.5-51.9 26.6-13.4 15.1-21.3 33.8-19.6 54.6 19.9 1.5 38.1-8.7 53.2-26.2z"/>
          </svg>
          Continue with Apple
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          or
          <div className="flex-1 h-px bg-border" />
        </div>
        <form onSubmit={handle} className="space-y-3">
          <label htmlFor="signup-name" className="sr-only">
            Display name
          </label>
          <input
            id="signup-name"
            placeholder="Display name"
            aria-label="Display name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm"
          />
          <label htmlFor="signup-email" className="sr-only">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm"
          />
          <label htmlFor="signup-password" className="sr-only">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            aria-label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm"
          />
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link to="/login" className="text-primary-glow">
            Log in
          </Link>
        </p>
        <div className="mt-4 rounded-xl border border-border bg-surface/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Signed up but did not get the confirmation email?
          </p>
          <button
            type="button"
            onClick={resendSignupEmail}
            disabled={resendLoading || !email.trim()}
            className="mt-2 text-xs font-semibold text-primary-glow underline disabled:opacity-50"
          >
            {resendLoading ? "Sending..." : "Resend confirmation email"}
          </button>
        </div>
      </div>
    </div>
  );
}
