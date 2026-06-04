const NSFW_TEXT_PATTERNS = [
  /\bnsfw\b/i,
  /\bnude\b/i,
  /\bnaked\b/i,
  /\bsex(?:ual)?\b/i,
  /\berotic\b/i,
  /\bporn(?:ographic)?\b/i,
  /\bfetish\b/i,
  /\bstrip(?:per|ping)?\b/i,
  /\bunderwear\b/i,
  /\blingerie\b/i,
  /\bgenital(?:s)?\b/i,
  /\bboobs?\b/i,
  /\bbreasts?\b/i,
  /\bbutt\b/i,
  /\bass\b/i,
  /\bchild\s*(?:nude|sexual|explicit)\b/i,
  /\bminor\s*(?:nude|sexual|explicit)\b/i,
  /\bloli\b/i,
  /\bshota\b/i,
];

const NORMALIZED_BLOCKED_TERMS = [
  "nsfw",
  "nude",
  "naked",
  "sexual",
  "erotic",
  "porn",
  "pornographic",
  "fetish",
  "stripper",
  "stripping",
  "lingerie",
  "genitals",
  "hentai",
  "loli",
  "shota",
  "gore",
  "beheading",
  "dismemberment",
  "selfharm",
  "suicide",
  "killyourself",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalizeSafetyText(text: string) {
  return text
    .toLowerCase()
    .replace(/[013457@$!]/g, (char) => LEET_MAP[char] ?? char)
    .replace(/[^a-z]+/g, "");
}

export function checkTextSafeFor3D(text: string): { safe: true } | { safe: false; reason: string } {
  const clean = text.trim();
  if (!clean) return { safe: true };
  for (const pattern of NSFW_TEXT_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        safe: false,
        reason: "That request looks adult/NSFW. BloxSmith generation is only for safe Roblox-ready assets.",
      };
    }
  }
  const normalized = normalizeSafetyText(clean);
  if (NORMALIZED_BLOCKED_TERMS.some((term) => normalized.includes(term))) {
    return {
      safe: false,
      reason: "That request looks unsafe or inappropriate. BloxSmith generation is only for safe Roblox-ready assets.",
    };
  }
  return { safe: true };
}

export function parseImageDataUrl(dataUrl?: string | null):
  | { base64: string; mime: "image/png" | "image/jpeg" | "image/webp"; bytes: Buffer }
  | null {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return { mime: match[1] as "image/png" | "image/jpeg" | "image/webp", base64: match[2], bytes };
}

export async function checkImageSafeFor3D(dataUrl: string): Promise<
  | { safe: true }
  | { safe: false; reason: string }
> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    return { safe: false, reason: "Upload a PNG, JPG, or WEBP image." };
  }
  if (parsed.bytes.length > 8 * 1024 * 1024) {
    return { safe: false, reason: "Image uploads must be 8 MB or smaller." };
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    return {
      safe: false,
      reason: "Image moderation is unavailable right now, so image-to-3D uploads are paused.",
    };
  }

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  'Classify this image for a Roblox 3D model generator. Reply only JSON: {"safe":true|false,"reason":"short"}. Mark false for nudity, sexualized bodies, lingerie/underwear focus, explicit content, minors in unsafe context, gore, hate symbols, or shock content. Safe game props, characters, buildings, vehicles, animals, and objects are true.',
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      return { safe: false, reason: "Image moderation failed. Try again with a different image." };
    }
    const j: any = await r.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "{}");
    const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    const verdict = JSON.parse(jsonText);
    if (verdict?.safe === true) return { safe: true };
    return {
      safe: false,
      reason: verdict?.reason || "That image does not meet the safe Roblox asset rules.",
    };
  } catch {
    return { safe: false, reason: "Image moderation failed. Try again with a safe asset image." };
  }
}
