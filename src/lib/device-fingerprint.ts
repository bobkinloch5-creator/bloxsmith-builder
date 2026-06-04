/**
 * Lightweight, dependency-free device fingerprint.
 * Combines stable browser/device signals into a single string.
 * Hashed server-side before storage.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "ssr";

  const parts: string[] = [];
  try {
    parts.push(navigator.userAgent || "");
    parts.push(navigator.language || "");
    parts.push(String(navigator.hardwareConcurrency ?? ""));
    parts.push(String((navigator as any).deviceMemory ?? ""));
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(String(new Date().getTimezoneOffset()));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    parts.push(String((navigator as any).platform ?? ""));

    // Canvas fingerprint
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = "#069";
        ctx.fillText("BloxSmith-fp-✸", 2, 2);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("BloxSmith-fp-✸", 4, 17);
        parts.push(canvas.toDataURL());
      }
    } catch {
      /* canvas blocked */
    }

    // Persistent local salt so the same browser stays stable across upgrades.
    try {
      let salt = localStorage.getItem("bs:dfp_salt");
      if (!salt) {
        salt = crypto.randomUUID();
        localStorage.setItem("bs:dfp_salt", salt);
      }
      parts.push(salt);
    } catch {
      /* storage blocked */
    }
  } catch {
    /* noop */
  }

  return parts.join("|");
}
