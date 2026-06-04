import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Link2,
  Link2Off,
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Gamepad2,
} from "lucide-react";
import {
  startRobloxLink,
  confirmRobloxLink,
  unlinkRoblox,
  getRobloxLink,
} from "@/lib/roblox-link.functions";

type LinkState =
  | { linked: false }
  | {
      linked: true;
      robloxUserId: number;
      robloxUsername: string | null;
      robloxDisplayName: string | null;
      robloxAvatarUrl: string | null;
      verifiedAt: string | null;
      profileUrl: string;
    };

export function RobloxAccountLink() {
  const start = useServerFn(startRobloxLink);
  const confirm = useServerFn(confirmRobloxLink);
  const unlink = useServerFn(unlinkRoblox);
  const get = useServerFn(getRobloxLink);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LinkState>({ linked: false });

  const [username, setUsername] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = (await get()) as LinkState;
        setState(r);
      } catch (e) {
        console.error("getRobloxLink", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  async function handleStart() {
    if (!username.trim()) return;
    setBusy(true);
    try {
      const r = await start({ data: { username: username.trim() } });
      setCode(r.code);
      setProfileUrl(r.profileUrl);
      toast.success("Verification code generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!username.trim()) return;
    setBusy(true);
    try {
      const r = await confirm({ data: { username: username.trim() } });
      setState({
        linked: true,
        robloxUserId: r.robloxUserId,
        robloxUsername: r.robloxUsername,
        robloxDisplayName: r.robloxDisplayName,
        robloxAvatarUrl: r.robloxAvatarUrl ?? null,
        verifiedAt: new Date().toISOString(),
        profileUrl: r.profileUrl,
      });
      setCode(null);
      setProfileUrl(null);
      setUsername("");
      toast.success("Roblox account linked!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    if (!window.confirm("Unlink your Roblox account from BloxSmith?")) return;
    setBusy(true);
    try {
      await unlink({});
      setState({ linked: false });
      toast.success("Roblox account unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unlink");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  return (
    <section className="rounded-xl border border-border bg-surface-elevated p-5 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15">
            <Gamepad2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Roblox account</h2>
            <p className="text-xs text-muted-foreground">
              Link your Roblox profile so it shows on your BloxSmith profile and showcase.
            </p>
          </div>
        </div>
        {state.linked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : state.linked ? (
        <div className="flex items-center gap-4">
          {state.robloxAvatarUrl && (
            <img
              src={state.robloxAvatarUrl}
              alt={state.robloxUsername ?? "Roblox avatar"}
              className="h-14 w-14 rounded-full border border-border bg-background object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">
              {state.robloxDisplayName || state.robloxUsername}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              @{state.robloxUsername} · ID {state.robloxUserId}
            </div>
            <a
              href={state.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View on Roblox <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
          >
            <Link2Off className="h-3.5 w-3.5" /> Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Roblox username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Builderman"
              maxLength={20}
              disabled={busy || !!code}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none disabled:opacity-50"
            />
          </div>

          {!code ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={busy || username.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Get verification code
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-background/60 p-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 1 — Copy this code
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm">
                    {code}
                  </code>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-surface"
                    aria-label="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 2 — Paste into your Roblox "About" description
                </div>
                {profileUrl && (
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open your Roblox profile <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Edit your profile description, paste the code anywhere in it, and save. You can
                  remove it once verification is complete.
                </p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 3 — Verify
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  I've added the code — verify
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
