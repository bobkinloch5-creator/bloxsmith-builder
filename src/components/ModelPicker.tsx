import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Cpu, Check } from "lucide-react";
import { toast } from "sonner";
import { getSiteModelHealth } from "@/lib/ai-model-health.functions";
import { saveProjectAiSettings } from "@/lib/project-ai.functions";
import {
  SITE_MODEL_DESCRIPTIONS,
  SITE_PROVIDER_LABELS,
  SITE_PROVIDER_MODELS,
  getModelCreditMultiplier,
  getModelTokenPricing,
  getModelToolCapabilities,
  type ModelTokenPricing,
  type SiteProviderId,
} from "@/lib/ai-models";

type ProviderId = SiteProviderId;

function statusDotClass(disabled?: boolean) {
  return disabled
    ? "bg-destructive shadow-[0_0_8px_var(--destructive)]"
    : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]";
}

function formatUsd(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function compactTokenPrice(pricing: ModelTokenPricing | null) {
  if (!pricing) return null;
  return `$${formatUsd(pricing.input)}/$${formatUsd(pricing.output)}/M`;
}

function tokenPriceTitle(pricing: ModelTokenPricing | null) {
  if (!pricing) return "";
  return `Provider price: $${formatUsd(pricing.input)} input, $${formatUsd(pricing.output)} output, $${formatUsd(pricing.cachedInput)} cached input per 1M tokens`;
}

export function ModelPicker({
  projectId,
  provider,
  model,
  onChange,
}: {
  projectId: string;
  provider: ProviderId | null;
  model: string | null;
  onChange: (provider: ProviderId, model: string) => void;
}) {
  const save = useServerFn(saveProjectAiSettings);
  const loadHealth = useServerFn(getSiteModelHealth);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const health = useQuery({
    queryKey: ["site-model-health"],
    queryFn: () => loadHealth(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const currentProvider: ProviderId =
    provider && provider in SITE_PROVIDER_LABELS ? provider : "neokens";
  const currentModel = model ?? SITE_PROVIDER_MODELS[currentProvider][0];
  const getHealth = (p: ProviderId, m: string) => health.data?.models?.[`${p}:${m}`];
  const currentHealth = getHealth(currentProvider, currentModel);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = async (p: ProviderId, m: string) => {
    const modelHealth = getHealth(p, m);
    // Only block a pick when we have a loaded health record that explicitly
    // says the model is down. If health hasn't loaded yet (undefined) or the
    // query errored, allow selection — a transient/empty health response must
    // never make every model unclickable.
    if (health.isSuccess && modelHealth?.disabled) return;
    // Apply the selection in the UI immediately so picking always works
    // visually, even if the server-side persistence is slow or fails. The
    // chat/generation calls read this selection regardless of whether the
    // per-project row was saved.
    onChange(p, m);
    setOpen(false);
    setSaving(true);
    try {
      await save({ data: { projectId, mode: "api_key", provider: p, model: m } });
    } catch (err: any) {
      // Don't revert the selection — just let the user know it won't persist
      // across reloads. Selecting still works for the current session.
      console.error("[ModelPicker] failed to save selection", err);
      toast.error(
        err?.message
          ? `Model selected, but couldn't be saved: ${err.message}`
          : "Model selected for now, but couldn't be saved to this project.",
      );
    } finally {
      setSaving(false);
    }
  };

  const shortModel = currentModel.length > 22 ? currentModel.slice(0, 22) + "…" : currentModel;

  const currentMult = getModelCreditMultiplier(currentModel);
  const currentCaps = getModelToolCapabilities(currentModel);
  const currentPricing = getModelTokenPricing(currentModel);
  const currentPriceBadge = compactTokenPrice(currentPricing);
  const currentStatusLabel = currentHealth?.label ?? "Available";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated/60 border border-border/40 px-2.5 py-0.5 text-[10px] hover:border-primary/60 transition"
        title={`Choose AI provider and model — ${currentStatusLabel}; current model costs ${currentMult}× credits per generation${currentPricing ? `; ${tokenPriceTitle(currentPricing)}` : ""}`}
      >
        <Cpu className="h-3 w-3 text-primary" />
        <span
          className={`h-2 w-2 rounded-full ${statusDotClass(currentHealth?.disabled)}`}
          aria-label={currentHealth?.disabled ? "Model down" : "Model available"}
        />
        <span className="text-muted-foreground">
          {SITE_PROVIDER_LABELS[currentProvider]} · {shortModel}
        </span>
        {currentCaps.webSearch && (
          <span className="rounded-full bg-sky-500/15 px-1.5 py-px text-[9px] font-semibold text-sky-500 dark:text-sky-300">
            Web
          </span>
        )}
        {currentCaps.thinking && (
          <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[9px] font-semibold text-violet-500 dark:text-violet-300">
            Think
          </span>
        )}
        {currentHealth?.disabled && (
          <span className="rounded-full bg-destructive/15 px-1.5 py-px text-[9px] font-semibold text-destructive">
            Down
          </span>
        )}
        <span
          className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${
            currentMult >= 4
              ? "bg-destructive/20 text-destructive"
              : currentMult >= 2
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          }`}
          aria-label={`Costs ${currentMult} times credits`}
        >
          {currentMult}× cr
        </span>
        {currentPriceBadge && (
          <span
            className="rounded-full bg-muted/70 px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
            title={tokenPriceTitle(currentPricing)}
          >
            {currentPriceBadge}
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-[24rem] max-h-[28rem] overflow-y-auto rounded-xl border border-border/60 bg-surface-elevated/95 backdrop-blur-xl shadow-2xl p-2">
          {(Object.keys(SITE_PROVIDER_LABELS) as ProviderId[]).map((p) => (
            <div key={p} className="mb-2">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                <span>{SITE_PROVIDER_LABELS[p]}</span>
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/70">
                  cost = base × multiplier
                </span>
              </div>
              {SITE_PROVIDER_MODELS[p].map((m) => {
                const active = p === currentProvider && m === currentModel;
                const desc = SITE_MODEL_DESCRIPTIONS[m];
                const mult = getModelCreditMultiplier(m);
                const caps = getModelToolCapabilities(m);
                const pricing = getModelTokenPricing(m);
                const priceBadge = compactTokenPrice(pricing);
                const modelHealth = getHealth(p, m);
                // Only block genuinely-down models, and only once health has
                // actually loaded. While loading or on error, keep selectable.
                const disabled = Boolean(health.isSuccess && modelHealth?.disabled);
                const tone =
                  mult >= 4
                    ? "bg-destructive/20 text-destructive"
                    : mult >= 2
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
                return (
                  <button
                    key={`${p}:${m}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(p, m)}
                    title={
                      modelHealth?.disabled
                        ? `${modelHealth.label}. ${modelHealth.detail ?? "This model is temporarily disabled."}`
                        : undefined
                    }
                    className={`w-full text-left rounded-md px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? modelHealth?.disabled
                          ? "bg-destructive/10 text-foreground"
                          : "bg-primary/15 text-foreground"
                        : modelHealth?.disabled
                          ? "bg-destructive/5"
                          : "hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(modelHealth?.disabled)}`}
                            aria-hidden="true"
                          />
                          <span
                            className={`truncate text-xs font-medium ${active ? "text-foreground" : "text-foreground/90"}`}
                          >
                            {m}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${
                            modelHealth?.disabled
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          }`}
                        >
                          {modelHealth?.disabled ? modelHealth.label : "Online"}
                        </span>
                        {caps.webSearch ? (
                          <span
                            className="rounded-full bg-sky-500/15 px-1.5 py-px text-[9px] font-semibold text-sky-500 dark:text-sky-300"
                            title="This model is intended for web_search, fetch_url, Roblox docs, and other tool calls."
                          >
                            Web/tools
                          </span>
                        ) : caps.tools ? (
                          <span
                            className="rounded-full bg-cyan-500/15 px-1.5 py-px text-[9px] font-semibold text-cyan-500 dark:text-cyan-300"
                            title="This model can use basic BloxSmith tools, but is not the first pick for web search."
                          >
                            Tools
                          </span>
                        ) : null}
                        {caps.thinking && (
                          <span
                            className="rounded-full bg-violet-500/15 px-1.5 py-px text-[9px] font-semibold text-violet-500 dark:text-violet-300"
                            title="This model is a good fit for deeper reasoning / Thinking mode."
                          >
                            Thinking
                          </span>
                        )}
                        <span
                          className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${tone}`}
                          title={`Uses ${mult}× the base credit cost for each generation with this model`}
                        >
                          {mult}× cr
                        </span>
                        {priceBadge && (
                          <span
                            className="rounded-full bg-muted/70 px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
                            title={tokenPriceTitle(pricing)}
                          >
                            {priceBadge}
                          </span>
                        )}
                        {active && <Check className="h-3 w-3 text-primary" />}
                      </div>
                    </div>
                    {desc && (
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                        {desc}
                      </div>
                    )}
                    {modelHealth?.disabled && (
                      <div className="mt-0.5 text-[10px] leading-snug text-destructive">
                        {modelHealth.detail ?? "This model is temporarily disabled."}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border/40 mt-1 space-y-1">
            <div>Credits per generation = base cost × the model's multiplier.</div>
            <div className="text-muted-foreground/70">
              Green means available. Red means temporarily down and cannot be selected.
            </div>
            <div className="text-muted-foreground/70">
              Web/tools models can call web_search, fetch_url, Roblox docs, and toolbox tools when
              the prompt needs current facts.
            </div>
            <div className="text-muted-foreground/70">
              Thinking models are better for deep architecture, debugging, QA, and multi-file Roblox
              builds.
            </div>
            <div className="text-muted-foreground/70">
              Base: chat 1 · plan 1 · fix 2 · build 3 · autopilot 10. Owners pay 0.
            </div>
            <div className="text-muted-foreground/70">
              Price badges show input/output USD per 1M provider tokens. Hover for cached-input
              price when Neokens lists one.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
