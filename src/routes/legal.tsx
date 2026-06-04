import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { Shield, FileText, RefreshCw, AlertTriangle, Cookie, Copyright, Mail } from "lucide-react";

const LAST_UPDATED = "May 29, 2026";

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground border-b border-border pb-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export const Route = createFileRoute("/legal")({
  component: () => (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Legal Center</h1>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about how BloxSmith operates, what we promise, and what we
            expect from you. For full documents, see the linked pages below.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/terms" className="rounded-xl border border-border bg-surface-elevated p-4 hover:border-primary/50 transition">
            <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" /> Terms of Service</div>
            <div className="text-xs text-muted-foreground mt-1">Accounts, credits, generated content, payments, plugin, acceptable use.</div>
          </Link>
          <Link to="/privacy" className="rounded-xl border border-border bg-surface-elevated p-4 hover:border-primary/50 transition">
            <div className="flex items-center gap-2 font-semibold"><Shield className="h-4 w-4 text-primary" /> Privacy Policy</div>
            <div className="text-xs text-muted-foreground mt-1">What we collect, how we use it, retention, your rights, AI processing.</div>
          </Link>
        </div>

        <Section title="Refund Policy" icon={RefreshCw}>
          <p>
            Credits are a limited, non-transferable license to access AI capacity. Because credits
            are consumed instantly when AI generations run, all sales are final once credits have
            been applied to your account, except:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-foreground font-medium">Platform errors</span> — if a generation
              fails due to a verifiable BloxSmith outage or bug, those credits are automatically
              refunded to your balance.
            </li>
            <li>
              <span className="text-foreground font-medium">Unauthorized purchases</span> — if your
              account or PayPal was charged without your authorization, contact us within 14 days
              with proof and we will investigate and, where warranted, refund.
            </li>
            <li>
              <span className="text-foreground font-medium">Mandatory consumer rights</span> — where
              local law (e.g. EU/UK distance-selling regulations) grants a non-waivable refund
              right, that right is preserved.
            </li>
          </ul>
          <p>
            Manual PayPal payments that have not yet been approved by staff can be cancelled by
            request. Approved purchases that have not been spent may be refunded at our discretion
            within 7 days of approval, minus any PayPal processing fees.
          </p>
          <p>
            To request a refund, email{" "}
            <a className="underline" href="mailto:community100x@gmail.com">community100x@gmail.com</a>{" "}
            with your account email, transaction ID, and a short description.
          </p>
        </Section>

        <Section title="Acceptable Use Policy" icon={AlertTriangle}>
          <p>You may not use BloxSmith, the Studio plugin, the MCP endpoint, or the global chat to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Generate, host, or distribute sexual content involving minors, or any CSAM. Such content is reported to the appropriate authorities.</li>
            <li>Harass, threaten, dox, impersonate, or target other users, including in global chat.</li>
            <li>Build cheats, exploits, account-stealers, malware, phishing pages, or anything designed to compromise Roblox or its users.</li>
            <li>Generate or publish hateful, discriminatory, violent, deceptive, or extremist content.</li>
            <li>Spam, flood chat, evade slow-mode, or evade a mute/ban with alt accounts.</li>
            <li>Reverse-engineer the Service, scrape it at scale, or attempt to extract model weights or non-public prompts.</li>
            <li>Resell, sublicense, or white-label BloxSmith without our written permission.</li>
            <li>Submit private information about third parties you are not authorized to share.</li>
          </ul>
          <p>
            Owners, admins, and moderators may remove messages, mute, kick, or ban accounts for
            violations, with or without notice. Repeat or severe violations result in permanent
            termination and forfeiture of unspent credits.
          </p>
        </Section>

        <Section title="DMCA / Copyright" icon={Copyright}>
          <p>
            BloxSmith respects intellectual property rights. If you believe content on the Service
            infringes your copyright, send a notice to{" "}
            <a className="underline" href="mailto:community100x@gmail.com">community100x@gmail.com</a>{" "}
            including:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your contact information and physical or electronic signature.</li>
            <li>Identification of the copyrighted work claimed to be infringed.</li>
            <li>The URL or location of the allegedly infringing material on BloxSmith.</li>
            <li>A statement of good-faith belief that the use is unauthorized.</li>
            <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on the rights holder's behalf.</li>
          </ul>
          <p>
            We respond to valid notices by removing or disabling access to the material and, where
            appropriate, terminating repeat-infringer accounts. Counter-notices follow the same
            email and must include the equivalent statutory elements.
          </p>
        </Section>

        <Section title="Cookies & Local Storage" icon={Cookie}>
          <p>
            BloxSmith uses strictly-necessary cookies and browser local storage to keep you signed
            in, remember preferences (theme, MCP configuration, chat window state), and run the
            chat UI. We do not use third-party advertising cookies and we do not sell your data.
          </p>
          <p>
            You can clear cookies and local storage at any time from your browser. Doing so will
            sign you out and reset preferences.
          </p>
        </Section>

        <Section title="Security & Vulnerability Disclosure" icon={Shield}>
          <p>
            We protect data in transit with TLS and at rest with industry-standard encryption.
            Database access is scoped through row-level security so users can only access their own
            data. Two-factor authentication (TOTP) is available from the security settings, and we
            strongly recommend enabling it on all owner and staff accounts.
          </p>
          <p>
            If you discover a security issue, please report it responsibly to{" "}
            <a className="underline" href="mailto:community100x@gmail.com">community100x@gmail.com</a>{" "}
            before disclosing publicly. We aim to acknowledge reports within 72 hours.
          </p>
        </Section>

        <Section title="Contact" icon={Mail}>
          <p>
            Legal questions, complaints, data-subject requests, or law-enforcement inquiries:{" "}
            <a className="underline" href="mailto:community100x@gmail.com">community100x@gmail.com</a>.
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Legal Center — BloxSmith" },
      {
        name: "description",
        content:
          "BloxSmith Legal Center: Terms of Service, Privacy Policy, Refund Policy, Acceptable Use, DMCA, Cookies, and security disclosure.",
      },
      { property: "og:title", content: "Legal Center — BloxSmith" },
      {
        property: "og:description",
        content:
          "Terms, Privacy, Refunds, Acceptable Use, DMCA, Cookies, and security disclosure for BloxSmith.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/legal" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/legal" }],
  }),
});
