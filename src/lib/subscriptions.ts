export const PRO_PLAN_ID = "pro_monthly";
export const PRO_PLAN_NAME = "BloxSmith Pro";
export const PRO_PLAN_PRICE_USD = 25;
export const PRO_PLAN_INTERVAL = "month";
export const PRO_MONTHLY_BONUS_CREDITS = 500;

export const PRO_BENEFITS = [
  "All higher AI models unlocked, including Claude Fable 5",
  "Maximum reasoning access for complex scripts, debugging, and full-game planning",
  `${PRO_MONTHLY_BONUS_CREDITS.toLocaleString()} bonus credits added when each month is approved`,
  "Premium model picker with Claude, GPT, Gemini, DeepSeek, Grok, Qwen, MiniMax, and Comet routes",
  "Pro account status in billing with cancel-anytime access through the paid period",
  "Early access to new AI model routes and advanced builder tools",
] as const;

export type SubscriptionSummary = {
  planId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isPro: boolean;
};

export function isSubscriptionCurrentlyPro(
  subscription: Pick<SubscriptionSummary, "status" | "currentPeriodEnd"> | null | undefined,
) {
  if (!subscription?.status || !subscription.currentPeriodEnd) return false;
  if (!["active", "canceled"].includes(subscription.status)) return false;
  return new Date(subscription.currentPeriodEnd).getTime() > Date.now();
}

export function proAccessLabel(subscription: SubscriptionSummary | null | undefined) {
  if (!subscription?.currentPeriodEnd) return "No active Pro period";
  const end = new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return subscription.cancelAtPeriodEnd || subscription.status === "canceled"
    ? `Access ends ${end}`
    : `Renews after ${end}`;
}
