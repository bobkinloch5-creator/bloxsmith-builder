import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "@/components/layout";
import { CREDIT_PACKS } from "@/lib/credits";
import { CreditCostBreakdown } from "@/components/CreditCostBreakdown";
import {
  PRO_BENEFITS,
  PRO_MONTHLY_BONUS_CREDITS,
  PRO_PLAN_NAME,
  PRO_PLAN_PRICE_USD,
} from "@/lib/subscriptions";
import {
  formatLtcAmount,
  LITECOIN_FALLBACK_USD_RATE,
  LITECOIN_PAYMENT_ADDRESS,
} from "@/lib/crypto-payments";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "Simple & Fair AI Game Builder Pricing | BloxSmith" },
      {
        name: "description",
        content:
          "Credit-based pricing for Roblox creators. Start free with daily credits, or buy packs to unlock complex scripts and templates.",
      },
      {
        name: "keywords",
        content:
          "BloxSmith pricing, Roblox AI builder credits, buy Roblox script maker credits, pay as you go Roblox coding",
      },
      { property: "og:title", content: "Simple & Fair AI Game Builder Pricing | BloxSmith" },
      {
        property: "og:description",
        content:
          "Credit-based pricing for Roblox creators. Start free with daily credits, or buy packs to unlock complex scripts and templates.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/pricing" }],
  }),
});

function Pricing() {
  const [yearly, setYearly] = useState(false);
  const bonusMult = yearly ? 1.2 : 1; // +20% bonus credits when prepaying yearly

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Simple, fair pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Free to start. Upgrade to Pro for premium models, or buy credits only when you need more.
          </p>

          {/* Billing toggle */}
          <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm">
            <button
              type="button"
              onClick={() => setYearly(false)}
              aria-pressed={!yearly}
              className={`px-4 py-1.5 rounded-full font-medium transition ${!yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pay as you go
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              aria-pressed={yearly}
              className={`px-4 py-1.5 rounded-full font-medium transition inline-flex items-center gap-1.5 ${yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Yearly bundle
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 ${yearly ? "bg-primary-foreground/20 text-primary-foreground" : "bg-success/15 text-success"}`}
              >
                +20% credits
              </span>
            </button>
          </div>
          {yearly && (
            <p className="mt-3 text-xs text-muted-foreground">
              Yearly bundles include 20% bonus credits — billed once, credits never expire.
            </p>
          )}
        </div>

        <section className="mt-10 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="glass rounded-2xl p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Free
            </div>
            <div className="mt-2 text-3xl font-bold">$0</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Start building with selected fast models, starter credits, daily refills, script
              generation, and core AI chat.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>100 starter credits and 10 daily credits</li>
              <li>Free model access: Gemini Flash, Claude Haiku, GPT Codex, DeepSeek Flash, and budget Comet routes</li>
              <li>Pay-as-you-go credit packs when you need bigger runs</li>
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-primary/10 p-6 shadow-lg shadow-primary/10">
            <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Crypto Pro
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              {PRO_PLAN_NAME}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <span className="text-4xl font-black">${PRO_PLAN_PRICE_USD}</span>
              <span className="pb-1 text-sm text-muted-foreground">USD / month</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Unlock all higher models for the month, including Claude Fable 5. If you cancel, Pro
              access stays active until the paid month ends.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PRO_BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-xl border border-primary/20 bg-background/35 px-3 py-2 text-sm"
                >
                  {benefit}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-primary/25 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              Includes {PRO_MONTHLY_BONUS_CREDITS.toLocaleString()} bonus credits when the Litecoin
              payment is approved. Premium models still show estimated credit cost before each run.
            </div>
            <Link
              to="/checkout/pro"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              Subscribe with Litecoin
            </Link>
          </div>
        </section>

        <h2 className="sr-only">Credit packs</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="glass rounded-2xl p-5 flex flex-col">
            <h3 className="font-semibold">Free</h3>
            <div className="mt-2 text-2xl font-bold">$0</div>
            <div className="text-xs text-muted-foreground mt-1">100 starter + 10 daily</div>
            <p className="text-xs text-muted-foreground mt-auto pt-4">No card required.</p>
          </div>
          {CREDIT_PACKS.map((p) => {
            const popular = "popular" in p && p.popular;
            const credits = Math.round(p.credits * bonusMult);
            const perCr = (p.price / credits).toFixed(3);
            return (
              <div
                key={p.id}
                className={`glass rounded-2xl p-5 flex flex-col relative ${popular ? "ring-2 ring-primary" : ""}`}
              >
                {popular && (
                  <div className="absolute -top-2.5 left-5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Popular
                  </div>
                )}
                {yearly && (
                  <div className="absolute -top-2.5 right-5 rounded-full bg-success/20 text-success px-2 py-0.5 text-[10px] font-semibold">
                    +20% bonus
                  </div>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <div className="mt-2 text-2xl font-bold">${p.price}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {credits} credits · ${perCr}/cr
                  {yearly && (
                    <span className="ml-1 text-muted-foreground/70 line-through">{p.credits}</span>
                  )}
                </div>
                <div className="mt-2 rounded-lg border border-primary/15 bg-primary/5 px-2 py-1 text-[11px] text-muted-foreground">
                  Crypto: est. {formatLtcAmount(p.price, LITECOIN_FALLBACK_USD_RATE)} LTC
                </div>
                <Link
                  to="/checkout/$pack"
                  params={{ pack: p.id }}
                  search={yearly ? ({ period: "yearly" } as never) : undefined}
                  className="mt-4 block text-center w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Buy
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-6 glass rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Custom amount</h3>
            <p className="text-sm text-muted-foreground">
              Pick exactly what you need — $0.05 / credit. PayPal and Litecoin accepted.
            </p>
          </div>
          <Link
            to="/checkout/custom"
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Buy custom
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <h3 className="font-semibold">We take crypto now</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Litecoin payments are available on every checkout page. Each pack shows the USD total,
            estimated LTC amount, and the wallet address before you submit your transaction hash.
          </p>
          <div className="mt-3 break-all rounded-xl border border-border/60 bg-background/45 px-3 py-2 font-mono text-xs text-foreground">
            {LITECOIN_PAYMENT_ADDRESS}
          </div>
        </div>

        <div className="mt-10">
          <CreditCostBreakdown />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          PayPal or Litecoin · paste your transaction ID/hash after payment and credits are added
          after verification.
        </p>
      </main>
      <Footer />
    </div>
  );
}
