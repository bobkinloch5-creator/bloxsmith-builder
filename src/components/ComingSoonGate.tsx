import { useEffect, useState, type ReactNode } from "react";

/**
 * ComingSoonGate — a CLIENT-SIDE "coming soon" gate.
 *
 * IMPORTANT / SECURITY NOTE:
 * This is a soft lock only. It keeps casual visitors out behind a
 * "Coming Soon" screen, but it is NOT real security — the unlock logic ships
 * to the browser, so anyone using DevTools can bypass it. We store only a
 * SHA-256 hash of the passphrase (never the plaintext) so the literal password
 * does not appear in the bundle, but a determined user can still get past a
 * client-only gate. For genuine protection, gate access on the server or use
 * Vercel/Cloudflare platform password protection.
 */

// SHA-256 of the launch passphrase. The plaintext is intentionally NOT stored.
const PASSPHRASE_HASH =
  "5eafeed7b1ca4d0583c761a5f4af2bacd2f93cb91dce52e80ab2047874341c3a";

const UNLOCK_KEY = "bs_coming_soon_unlocked_v1";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ComingSoonGate({ children }: { children: ReactNode }) {
  // Start locked until we've checked sessionStorage on the client. We render the
  // gate (not the app) during SSR / first paint so the real site is never shown
  // before the check resolves.
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* sessionStorage unavailable — stay locked */
    }
    setChecked(true);
  }, []);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const hash = await sha256Hex(value);
      if (hash === PASSPHRASE_HASH) {
        try {
          sessionStorage.setItem(UNLOCK_KEY, "1");
        } catch {
          /* ignore persistence failure */
        }
        setUnlocked(true);
      } else {
        setError(true);
        setValue("");
      }
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Once unlocked, render the real app.
  if (checked && unlocked) return <>{children}</>;

  // Locked (or still checking): show the coming-soon screen.
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(1200px 600px at 50% -10%, oklch(0.28 0.06 160 / 0.5), transparent), #0a0d0c",
        color: "#e8efe9",
        fontFamily:
          "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
          background: "oklch(0.18 0.02 160 / 0.6)",
          border: "1px solid oklch(0.4 0.04 160 / 0.4)",
          borderRadius: "20px",
          padding: "40px 28px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "oklch(0.73 0.17 158)",
            fontWeight: 700,
            marginBottom: "10px",
          }}
        >
          BloxSmith
        </div>
        <h1
          style={{
            fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif",
            fontSize: "34px",
            lineHeight: 1.1,
            fontWeight: 800,
            margin: "0 0 12px",
            background:
              "linear-gradient(135deg, oklch(0.85 0.12 158), oklch(0.7 0.18 200))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Coming Soon
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "oklch(0.75 0.02 160)",
            margin: "0 0 26px",
            lineHeight: 1.5,
          }}
        >
          We&rsquo;re putting the finishing touches on something great. Enter the
          access password to take an early look.
        </p>

        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Access password"
          aria-label="Access password"
          aria-invalid={error}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 16px",
            fontSize: "15px",
            borderRadius: "12px",
            background: "#0d1210",
            border: error
              ? "1px solid oklch(0.6 0.2 25)"
              : "1px solid oklch(0.4 0.04 160 / 0.5)",
            color: "#e8efe9",
            outline: "none",
            marginBottom: "12px",
          }}
        />

        {error && (
          <div
            style={{
              fontSize: "13px",
              color: "oklch(0.72 0.19 25)",
              marginBottom: "12px",
            }}
            role="alert"
          >
            Incorrect password. Please try again.
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || value.length === 0}
          style={{
            width: "100%",
            padding: "13px 16px",
            fontSize: "15px",
            fontWeight: 700,
            borderRadius: "12px",
            border: "none",
            cursor: submitting || value.length === 0 ? "not-allowed" : "pointer",
            opacity: submitting || value.length === 0 ? 0.55 : 1,
            color: "#06120c",
            background:
              "linear-gradient(135deg, oklch(0.8 0.16 158), oklch(0.72 0.17 165))",
            transition: "opacity 0.15s ease, transform 0.05s ease",
          }}
        >
          {submitting ? "Checking…" : "Enter"}
        </button>

        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid oklch(0.4 0.04 160 / 0.15)" }}>
          <p style={{ fontSize: "13px", color: "oklch(0.7 0.02 160)", margin: "0 0 12px" }}>
            Want early access to build games?
          </p>
          <a
            href="https://discord.gg/gkYGrVBbca"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "12px",
              border: "1px solid oklch(0.5 0.1 240 / 0.25)",
              background: "linear-gradient(135deg, oklch(0.28 0.08 250 / 0.8), oklch(0.22 0.06 250 / 0.8))",
              color: "#e0e8ff",
              textDecoration: "none",
              cursor: "pointer",
              transition: "border-color 0.2s ease, opacity 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "oklch(0.6 0.15 250 / 0.5)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "oklch(0.5 0.1 240 / 0.25)";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 127.14 96.36"
              fill="currentColor"
              style={{ color: "#5865F2" }}
            >
              <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a75.58,75.58,0,0,0,73,0c.83.68,1.69,1.37,2.58,2a68.86,68.86,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.75,124.23,27.82,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
            </svg>
            Join Discord to be first to try
          </a>
        </div>
      </div>
    </div>
  );
}
