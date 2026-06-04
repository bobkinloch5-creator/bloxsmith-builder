import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
  head: () => ({
    meta: [
      { title: "Signing in — BloxSmith" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AuthCallbackPage() {
  const nav = useNavigate();

  useEffect(() => {
    let done = false;

    const finish = async () => {
      if (done) return;
      done = true;

      // Decide whether a second factor is still required.
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.nextLevel === "aal2" && data?.currentLevel !== "aal2") {
          toast.info("Enter your 2FA code to finish signing in.");
          nav({ to: "/mfa", replace: true });
          return;
        }
      } catch {
        /* ignore MFA check failure and continue to dashboard */
      }
      toast.success("Welcome back!");
      nav({ to: "/dashboard", replace: true });
    };

    const finishFromUrl = async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const error = url.searchParams.get("error_description") ?? hash.get("error_description") ?? url.searchParams.get("error") ?? hash.get("error");
      if (error) {
        done = true;
        toast.error(error);
        nav({ to: "/login", replace: true });
        return;
      }

      const access_token = hash.get("access_token") ?? url.searchParams.get("access_token");
      const refresh_token = hash.get("refresh_token") ?? url.searchParams.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) {
          done = true;
          toast.error(sessionError.message);
          nav({ to: "/login", replace: true });
          return;
        }
        void finish();
      }
    };

    void finishFromUrl();

    // If the session is already there, go immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void finish();
    });

    // Otherwise wait for detectSessionInUrl to parse the tokens and fire.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void finish();
      }
    });

    // Safety net: if nothing resolves, send the user back to login.
    const timer = setTimeout(() => {
      if (!done) {
        toast.error("Sign in could not be completed. Please try again.");
        nav({ to: "/login", replace: true });
      }
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [nav]);

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="BloxSmith logo" width={40} height={40} className="h-10 w-10 animate-pulse" />
        <p className="text-sm text-muted-foreground">Finishing sign in…</p>
      </div>
    </div>
  );
}
