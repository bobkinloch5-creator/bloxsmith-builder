import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { recordAndEnforceSingleAccount } from "@/lib/account-guard.functions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { toast } from "sonner";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  username?: string | null;
  username_normalized?: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  specialization?: string | null;
  credits: number;
  discord_claimed?: boolean;
  referral_code?: string | null;
  referred_by?: string | null;
  hide_email?: boolean;
  chat_name_gradient?: string[] | null;
  chat_text_gradient?: string[] | null;
  chat_icon?: string | null;
  chat_nickname?: string | null;
  chat_font?: string | null;
  // Profile customization fields
  profile_accent?: string | null;
  profile_card_color?: string | null;
  profile_card_effect?: string | null;
  profile_effect?: string | null;
  profile_background?: string | null;
  custom_background_url?: string | null;
  profile_layout?: string | null;
  pfp_effect?: string | null;
  status_message?: string | null;
  pronouns?: string | null;
  location?: string | null;
  private_profile?: boolean;
  presence_enabled?: boolean;
  presence_status?: string | null;
  show_activity?: boolean;
  last_seen_at?: string | null;
  profile_badges?: string[] | null;
  profile_decoration?: string | null;
  onboarding_completed_at?: string | null;
  onboarding_step?: number | null;
  onboarding_reward_claimed?: boolean | null;
};

type Role = "owner" | "admin" | "moderator" | "user";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: Role[];
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const PROFILE_SELECT_FULL =
  "id,display_name,username,username_normalized,avatar_url,banner_url,bio,specialization,credits,discord_claimed,referral_code,referred_by,hide_email,chat_name_gradient,chat_text_gradient,chat_icon,chat_nickname,chat_font,profile_accent,profile_card_color,profile_card_effect,profile_effect,profile_background,custom_background_url,profile_layout,pfp_effect,status_message,pronouns,location,private_profile,presence_enabled,presence_status,show_activity,last_seen_at,profile_badges,profile_decoration,onboarding_completed_at,onboarding_step,onboarding_reward_claimed";

const PROFILE_SELECT_CORE =
  "id,display_name,avatar_url,bio,specialization,credits,discord_claimed,referral_code,referred_by";

function profileMediaPath(url?: string | null) {
  if (!url) return null;
  const signedMatch = url.match(/\/storage\/v1\/object\/sign\/profile-media\/([^?]+)/);
  if (signedMatch?.[1]) return decodeURIComponent(signedMatch[1]);
  const publicMatch = url.match(/\/storage\/v1\/object\/public\/profile-media\/([^?]+)/);
  if (publicMatch?.[1]) return decodeURIComponent(publicMatch[1]);
  return null;
}

async function refreshSignedProfileMediaUrls(profile: Partial<Profile> | null) {
  if (!profile) return profile;
  const next = { ...profile };
  const candidates: Array<[keyof Profile, string | null | undefined]> = [
    ["avatar_url", profile.avatar_url],
    ["banner_url", profile.banner_url],
    ["custom_background_url", profile.custom_background_url],
  ];

  await Promise.all(
    candidates.map(async ([key, value]) => {
      const path = profileMediaPath(value);
      if (!path) return;
      const { data, error } = await supabase.storage.from("profile-media").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (!error) (next as any)[key] = data.signedUrl;
    }),
  );

  return next;
}

function withProfileDefaults(profile: Partial<Profile> | null, email: string): Profile | null {
  if (!profile?.id) return null;
  return {
    ...(profile as Partial<Profile>),
    id: profile.id,
    email,
    display_name: profile.display_name ?? null,
    username: profile.username ?? null,
    username_normalized: profile.username_normalized ?? null,
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    specialization: profile.specialization ?? null,
    credits: profile.credits ?? 0,
    discord_claimed: profile.discord_claimed ?? false,
    referral_code: profile.referral_code ?? null,
    referred_by: profile.referred_by ?? null,
  } as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const authReadyRef = useRef(false);
  const router = useRouter();
  const qc = useQueryClient();

  const cleanupLegacyAuthStorage = () => {
    if (typeof localStorage === "undefined") return;
    const currentRef = (() => {
      try {
        return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
      } catch {
        return "lyoftuqltymlmfiedncj";
      }
    })();
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-") && key.includes("-auth-token") && !key.includes(currentRef)) {
        localStorage.removeItem(key);
      }
    }
  };

  const loadProfile = async (uid: string, userEmail?: string) => {
    try {
      const { error: ensureError } = await (supabase as any).rpc("ensure_my_profile");
      if (ensureError) {
        console.warn("[auth] profile self-heal skipped:", ensureError.message ?? ensureError);
      }

      const [profileRes, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select(PROFILE_SELECT_FULL)
          .eq("id", uid)
          .maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", uid),
      ]);

      let p = profileRes.data as Partial<Profile> | null;
      if (profileRes.error) {
        console.warn("[auth] full profile load failed, retrying core fields:", profileRes.error.message);
        const { data: coreProfile, error: coreError } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT_CORE)
          .eq("id", uid)
          .maybeSingle();
        if (coreError) throw coreError;
        p = coreProfile as Partial<Profile> | null;
      }

      let resolvedEmail = userEmail;
      if (p && !resolvedEmail) {
        const { data } = await supabase.auth.getUser();
        resolvedEmail = data?.user?.email || "";
      }

      const hydratedProfile = await refreshSignedProfileMediaUrls(p);
      setProfile(withProfileDefaults(hydratedProfile, resolvedEmail || ""));
      setRoles(((r ?? []) as { role: Role }[]).map((x) => x.role));
    } catch (e) {
      // Supabase unreachable/unconfigured — don't crash; leave profile empty.
      console.error("[auth] failed to load profile:", e instanceof Error ? e.message : e);
      setProfile(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    cleanupLegacyAuthStorage();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id, s.user.email), 0);
        if (event === "SIGNED_IN") {
          // Enforce 1-account-per-user. Runs once per fresh sign-in.
          setTimeout(async () => {
            try {
              const fp = getDeviceFingerprint();
              await recordAndEnforceSingleAccount({ data: { fingerprint: fp } });
            } catch (e) {
              const msg =
                e instanceof Error
                  ? e.message
                  : "This device is already linked to another account.";
              toast.error(msg);
              try {
                await supabase.auth.signOut();
              } catch {
                /* noop */
              }
              try {
                router.navigate({ to: "/login" as any });
              } catch {
                /* noop */
              }
            }
          }, 0);
        }
      } else {
        setProfile(null);
        setRoles([]);
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        authReadyRef.current = true;
        setLoading(false);
      }
      router.invalidate();
      qc.invalidateQueries();
    });

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const sess = data.session;
        if (sess?.access_token && sess?.user) {
          const expiresAt = sess.expires_at ? sess.expires_at * 1000 : 0;
          if (expiresAt && expiresAt < Date.now()) {
            try {
              await supabase.auth.signOut();
            } catch {
              /* noop */
            }
            setSession(null);
            authReadyRef.current = true;
            setLoading(false);
            return;
          }
          // Validate token against the Auth server — if signing keys rotated
          // (e.g. "unrecognized JWT kid ... for algorithm ES256"), the stored
          // session is unusable. Clear it so the user can sign in fresh.
          const { error: verifyError } = await supabase.auth.getUser();
          if (verifyError) {
            const msg = verifyError.message || "";
            const stale =
              /invalid jwt|unrecognized jwt|jwt.*kid|signature|unverifiable/i.test(msg);
            if (stale) {
              console.warn("[auth] stale session detected, signing out:", msg);
              try {
                await supabase.auth.signOut({ scope: "local" } as any);
              } catch {
                /* noop */
              }
              try {
                // Hard-clear any leftover supabase auth keys in localStorage.
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("sb-") && k.includes("-auth-token"))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {
                /* noop */
              }
              setSession(null);
              authReadyRef.current = true;
              setLoading(false);
              return;
            }
          }
          setSession(sess);
          authReadyRef.current = true;
          loadProfile(sess.user.id, sess.user.email).finally(() => setLoading(false));

        } else {
          setSession(null);
          authReadyRef.current = true;
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        console.error("[auth] getSession failed:", e instanceof Error ? e.message : e);
        setLoading(false);
      });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle auto-logout: only after a long period of real inactivity.
  useEffect(() => {
    if (!session?.user || !authReadyRef.current) return;
    // Respect a "Stay signed in" preference: when the user opted in, keep the long 2h window.
    // Otherwise apply the 30-minute idle auto-logout the user asked for.
    const stay = typeof window !== "undefined" && localStorage.getItem("bs:stay_signed_in") === "1";
    const IDLE_MS = stay ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000;
    let lastActivity = Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    const markActive = () => {
      if (document.visibilityState !== "visible") return;
      lastActivity = Date.now();
    };

    const checkIdle = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity < IDLE_MS) return;
      if (!session?.user) return;
      await supabase.auth.signOut();
      try {
        router.navigate({ to: "/login", search: { reason: "idle" } as any });
      } catch {
        /* noop */
      }
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "pointerdown"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    interval = setInterval(() => {
      void checkIdle();
    }, 60_000);

    return () => {
      if (interval) clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [session?.user?.id, router, session]);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    isOwner: roles.includes("owner"),
    isAdmin: roles.includes("admin") || roles.includes("owner"),
    isModerator: roles.includes("moderator") || roles.includes("admin") || roles.includes("owner"),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
