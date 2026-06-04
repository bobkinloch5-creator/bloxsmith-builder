import process from "node:process";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SITE_PROVIDER_DEFAULT_MODEL,
  SITE_PROVIDER_MODELS,
  resolveCometModel,
  resolveNeokensModel,
  type SiteProviderId,
} from "./ai-models";
import { hasCometApiKey } from "./comet-config.server";
import { hasNeokensApiKey } from "./neokens-config.server";

export type SiteModelHealthStatus = "online" | "down";

export type SiteModelHealth = {
  provider: SiteProviderId;
  modelId: string;
  realModel: string;
  status: SiteModelHealthStatus;
  disabled: boolean;
  label: string;
  detail?: string;
  lastCheckedAt?: string;
  errorKind?: string | null;
  recentFailures: number;
};

export type SiteModelHealthResponse = {
  checkedAt: string;
  lookbackMinutes: number;
  models: Record<string, SiteModelHealth>;
};

const MODEL_HEALTH_LOOKBACK_MS = 30 * 60 * 1000;
const DOWN_ERROR_KINDS = new Set([
  "auth",
  "model_not_found",
  "not_configured",
  "provider",
  "rate_limit",
  "timeout",
  "unknown",
]);

type ProviderEventRow = {
  provider: string;
  model: string;
  ok: boolean;
  error_kind: string | null;
  created_at: string;
};

function healthKey(provider: SiteProviderId, modelId: string) {
  return `${provider}:${modelId}`;
}

function providerConfigured(provider: SiteProviderId) {
  if (provider === "neokens") return hasNeokensApiKey();
  if (provider === "comet") return hasCometApiKey();
  return false;
}

function modelAliases(provider: SiteProviderId, modelId: string) {
  const aliases = new Set([modelId]);
  if (provider === "neokens") {
    aliases.add(resolveNeokensModel(modelId).model);
  }
  if (provider === "comet") {
    aliases.add(resolveCometModel(modelId).model);
  }
  return aliases;
}

function downLabel(errorKind?: string | null) {
  switch (errorKind) {
    case "auth":
      return "Auth failed";
    case "model_not_found":
      return "Model unavailable";
    case "not_configured":
      return "Not configured";
    case "provider":
      return "Provider down";
    case "rate_limit":
      return "Rate limited";
    case "timeout":
      return "Timed out";
    default:
      return "Temporarily down";
  }
}

export async function getSiteModelHealthSnapshot(): Promise<SiteModelHealthResponse> {
  const checkedAt = new Date().toISOString();
  const since = new Date(Date.now() - MODEL_HEALTH_LOOKBACK_MS).toISOString();
  const providers = Object.keys(SITE_PROVIDER_MODELS) as SiteProviderId[];
  let events: ProviderEventRow[] = [];

  try {
    const { data, error } = await supabaseAdmin
      .from("ai_provider_events")
      .select("provider,model,ok,error_kind,created_at")
      .in("provider", providers)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(800);
    if (error) {
      if (!/relation .*ai_provider_events.* does not exist/i.test(error.message ?? "")) {
        console.warn("[model-health] query failed:", error.message);
      }
    } else {
      events = (data ?? []) as ProviderEventRow[];
    }
  } catch (err) {
    console.warn("[model-health] skipped:", err);
  }

  const models: Record<string, SiteModelHealth> = {};

  for (const provider of providers) {
    const configured = providerConfigured(provider);
    for (const modelId of SITE_PROVIDER_MODELS[provider]) {
      const realModel =
        provider === "neokens"
          ? resolveNeokensModel(modelId).model
          : provider === "comet"
            ? resolveCometModel(modelId).model
            : modelId;
      const aliases = modelAliases(provider, modelId);
      const relevant = events.filter(
        (event) => event.provider === provider && aliases.has(event.model),
      );
      const recentFailures = relevant.filter(
        (event) => !event.ok && DOWN_ERROR_KINDS.has(event.error_kind ?? "unknown"),
      ).length;

      let status: SiteModelHealthStatus = "online";
      let label = "Available";
      let detail: string | undefined;
      let lastCheckedAt: string | undefined;
      let errorKind: string | null | undefined;

      if (!configured) {
        status = "down";
        label = "Not configured";
        detail = "The site provider key is missing.";
        errorKind = "not_configured";
      } else {
        const latestDecisive = relevant.find(
          (event) => event.ok || DOWN_ERROR_KINDS.has(event.error_kind ?? "unknown"),
        );
        if (latestDecisive) {
          lastCheckedAt = latestDecisive.created_at;
          errorKind = latestDecisive.error_kind;
          if (!latestDecisive.ok) {
            status = "down";
            label = downLabel(latestDecisive.error_kind);
            detail = "Disabled while recent health checks report this model down.";
          }
        }
      }

      models[healthKey(provider, modelId)] = {
        provider,
        modelId,
        realModel,
        status,
        disabled: status === "down",
        label,
        detail,
        lastCheckedAt,
        errorKind,
        recentFailures,
      };
    }
  }

  return {
    checkedAt,
    lookbackMinutes: Math.round(MODEL_HEALTH_LOOKBACK_MS / 60_000),
    models,
  };
}

export async function chooseAvailableSiteModel(
  provider: SiteProviderId,
  preferredModel: string,
): Promise<string> {
  const snapshot = await getSiteModelHealthSnapshot();
  const preferred = snapshot.models[healthKey(provider, preferredModel)];
  if (!preferred?.disabled) return preferredModel;

  const defaultModel = SITE_PROVIDER_DEFAULT_MODEL[provider];
  const defaultHealth = snapshot.models[healthKey(provider, defaultModel)];
  if (defaultModel && !defaultHealth?.disabled) return defaultModel;

  const firstAvailable = SITE_PROVIDER_MODELS[provider].find(
    (modelId) => !snapshot.models[healthKey(provider, modelId)]?.disabled,
  );
  return firstAvailable ?? preferredModel;
}
