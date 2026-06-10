import { toast } from "sonner";

function fallbackCopy(text: string) {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  return ok;
}

export async function copyText(text: string, label = "Copied!") {
  const value = String(text ?? "");
  if (!value) {
    toast.error("Nothing to copy");
    return false;
  }
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else if (!fallbackCopy(value)) {
      throw new Error("fallback copy failed");
    }
    toast.success(label);
    return true;
  } catch {
    if (fallbackCopy(value)) {
      toast.success(label);
      return true;
    }
    toast.error("Copy failed. Select the text and copy manually.");
    return false;
  }
}
