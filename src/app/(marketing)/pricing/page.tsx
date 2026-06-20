import type { Metadata } from "next";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="container py-20">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Pay monthly or yearly. Switch plans or cancel whenever you like.
        </p>
      </div>
      <PricingCards />
    </section>
  );
}
