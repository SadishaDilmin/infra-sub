import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  CreditCard,
  BarChart3,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PricingCards } from "@/components/marketing/pricing-cards";

const features = [
  {
    icon: CreditCard,
    title: "PayHere payments",
    desc: "Local LKR/USD card payments and recurring billing through PayHere — Sri Lanka's trusted gateway.",
  },
  {
    icon: RefreshCw,
    title: "Automatic renewals",
    desc: "Subscriptions renew themselves. We track status, retries, and past-due automatically.",
  },
  {
    icon: Receipt,
    title: "Invoices & history",
    desc: "Every successful payment generates a numbered invoice. Customers see their full history.",
  },
  {
    icon: BarChart3,
    title: "Revenue analytics",
    desc: "Admins get MRR, ARR, churn, active subscriptions and failed payments at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "JWT auth with refresh-token rotation, RBAC, rate limiting, CSRF protection and audit logging.",
  },
  {
    icon: Zap,
    title: "Self-serve",
    desc: "Customers upgrade, downgrade and cancel on their own — no more manual bank transfers.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="container flex flex-col items-center gap-6 py-24 text-center">
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" /> Subscriptions for infrastructure services
          </Badge>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Stop chasing bank transfers. Start billing on autopilot.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Infra Sub lets your customers subscribe to your infrastructure
            services, pay securely with PayHere, and manage everything
            themselves — while you watch revenue grow.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">Start free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to bill recurring revenue
          </h2>
          <p className="mt-3 text-muted-foreground">
            A complete, production-ready subscription platform — auth, payments,
            invoicing and analytics included.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <span className="inline-flex rounded-lg bg-primary/10 p-2 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/30 py-24">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Choose a plan that fits. Upgrade or cancel anytime.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "How are payments processed?",
                a: "Securely through PayHere. Card details never touch our servers — PayHere handles the checkout and notifies us via a signed webhook.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your dashboard and you keep access until the end of your current billing period.",
              },
              {
                q: "Do you store my card?",
                a: "No. Recurring billing is tokenised by PayHere; we only store payment results and invoices.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-lg border p-5">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
