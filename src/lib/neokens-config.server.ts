import process from "node:process";

const DEFAULT_NEOKENS_BASE_URL = "https://api.quatarly.cloud/v1";

function normalizeBaseUrl(raw: string | undefined) {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_NEOKENS_BASE_URL;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function getNeokensApiKey() {
  return (
    process.env.NEOKENS_API_KEY ||
    process.env.NEOKENS_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN
  );
}

export function hasNeokensApiKey() {
  return Boolean(getNeokensApiKey());
}

export function getNeokensBaseUrl() {
  return normalizeBaseUrl(process.env.NEOKENS_BASE_URL || process.env.ANTHROPIC_BASE_URL);
}

export function getNeokensChatCompletionsUrl() {
  return `${getNeokensBaseUrl()}/chat/completions`;
}

export function getNeokensDefaultClaudeModels() {
  return {
    haiku: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || "claude-haiku-4-5-20251001",
    sonnet: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || "claude-sonnet-4-6-thinking",
    opus: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-sonnet-4-6-thinking",
  };
}
