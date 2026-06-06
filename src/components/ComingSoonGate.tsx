import { useEffect, useState, type ReactNode } from "react";

const UNLOCK_KEY = "bs_coming_soon_unlocked_v1";

export function ComingSoonGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* sessionStorage unavailable */
    }
    setChecked(true);
  }, []);

  const enter = () => {
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  };

  // Once unlocked, render the real app.
  if (checked && unlocked) return <>{children}</>;

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
          Open for Testing
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "oklch(0.75 0.02 160)",
            margin: "0 0 26px",
            lineHeight: 1.5,
          }}
        >
          We&rsquo;re live and looking for feedback. Jump in, test things out,
          and let us know what you think on Discord.
        </p>

        <button
          type="button"
          onClick={enter}
          style={{
            width: "100%",
            padding: "13px 16px",
            fontSize: "15px",
            fontWeight: 700,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            color: "#06120c",
            background:
              "linear-gradient(135deg, oklch(0.8 0.16 158), oklch(0.72 0.17 165))",
            transition: "opacity 0.15s ease, transform 0.05s ease",
          }}
        >
          Enter
        </button>

        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid oklch(0.4 0.04 160 / 0.15)" }}>
          <p style={{ fontSize: "13px", color: "oklch(0.7 0.02 160)", margin: "0 0 12px" }}>
            Want to report bugs or suggest features?
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
            Join our Discord
          </a>
        </div>
      </div>
    </div>
  );
}

