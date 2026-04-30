import { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { billingApi, type PlanCard as PlanCardData } from "@/api/billing";
import {
  planCtaCopy,
  planFeatureBullets,
  priceLabel,
} from "@/lib/plans";

const HIGHLIGHT_TIER = "pro";

export function PricingPage() {
  const [annual, setAnnual] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => billingApi.listPublicPlans(),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 dark:opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, #d1d5db 2px, transparent 2px),
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px, 48px 48px, 48px 48px',
              backgroundPosition: '24px 24px, 0 0, 0 0'
            }}
          />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-manrope">
                Simple, Transparent Pricing
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
                Free forever — no credit card required. Every plan runs on Secret VM
                confidential compute.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center gap-4 mb-12"
            >
              <Label htmlFor="billing-toggle-page" className={`font-manrope ${!annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle-page"
                checked={annual}
                onCheckedChange={setAnnual}
              />
              <Label htmlFor="billing-toggle-page" className={`font-manrope ${annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                Annual
                <Badge variant="secondary" className="ml-2">Save 20%</Badge>
              </Label>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(isLoading || !plans
                ? Array.from({ length: 4 }).map(() => null)
                : plans
              ).map((tier, index) => (
                <motion.div
                  key={tier?.tier ?? index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                >
                  <PlanColumn
                    tier={tier}
                    annual={annual}
                    isHighlight={tier?.tier === HIGHLIGHT_TIER}
                  />
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-12 text-center"
            >
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                Questions about pricing?{" "}
                <Link to="/faqs" className="text-blue-600 hover:underline">
                  View FAQ
                </Link>{" "}
                or{" "}
                <Link to="/help" className="text-blue-600 hover:underline">
                  contact support
                </Link>
              </p>
            </motion.div>
          </div>
        </section>

        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function PlanColumn({
  tier,
  annual,
  isHighlight,
}: {
  tier: PlanCardData | null;
  annual: boolean;
  isHighlight: boolean;
}) {
  if (!tier) {
    return (
      <Card className="relative h-[480px] animate-pulse bg-muted/30 border" />
    );
  }

  const { primary, secondary } = priceLabel(tier, annual);
  const features = planFeatureBullets(tier.limits);
  const cta = planCtaCopy(tier.tier);

  return (
    <Card
      className={`relative h-full transition-all duration-300 hover:shadow-xl ${
        isHighlight
          ? "border-blue-500 shadow-lg scale-105"
          : "border-gray-200 dark:border-gray-700"
      } bg-white dark:bg-gray-800`}
    >
      {isHighlight && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="px-4 py-1 bg-blue-600">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-6 pt-8 space-y-4">
        <div>
          <h3 className="text-2xl font-bold mb-2 font-manrope text-gray-900 dark:text-white">
            {tier.label}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope min-h-[40px]">
            {tier.tagline}
          </p>
        </div>

        <div className="min-h-[120px] flex flex-col items-center justify-center">
          <div className="space-y-2">
            <div>
              <span className="text-4xl font-bold text-gray-900 dark:text-white font-manrope">
                {primary}
              </span>
              {tier.price_monthly_usd !== null && tier.price_monthly_usd > 0 && (
                <span className="text-base text-gray-600 dark:text-gray-400 font-manrope">
                  /month
                </span>
              )}
            </div>
            {secondary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                {secondary}
              </p>
            )}
          </div>
        </div>

        <Link to={cta.to}>
          <Button
            variant={isHighlight ? "default" : "outline"}
            className="w-full font-manrope"
            size="lg"
          >
            {cta.label}
          </Button>
        </Link>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
