const DEFAULT_COMET_BASE_URL = "https://api.cometapi.com/v1";

export function getCometApiKey() {
  return process.env.COMETAPI_KEY || process.env.COMET_API_KEY || "";
}

export function getCometBaseUrl() {
  return (process.env.COMET_BASE_URL || DEFAULT_COMET_BASE_URL).replace(/\/+$/, "");
}

export function hasCometApiKey() {
  return Boolean(getCometApiKey());
}
