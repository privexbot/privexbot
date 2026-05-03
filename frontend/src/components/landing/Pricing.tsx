import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { billingApi, type PlanCard as PlanCardData } from "@/api/billing";
import { motion } from "framer-motion";
import {
  planCtaCopy,
  planFeatureBullets,
  priceLabel,
} from "@/lib/plans";

const HIGHLIGHT_TIER = "pro";

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => billingApi.listPublicPlans(),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <section
      id="pricing"
      className="py-16 md:py-24 bg-white dark:bg-gray-900 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-manrope">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
            Free forever — no credit card required
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
            Start on the Free tier and upgrade only when you outgrow it. Every
            plan runs on Secret VM confidential compute.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <Label
            htmlFor="billing-toggle-landing"
            className={`font-manrope ${!annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}
          >
            Monthly
          </Label>
          <Switch
            id="billing-toggle-landing"
            checked={annual}
            onCheckedChange={setAnnual}
          />
          <Label
            htmlFor="billing-toggle-landing"
            className={`font-manrope ${annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}
          >
            Annual
            <Badge variant="secondary" className="ml-2">
              Save 20%
            </Badge>
          </Label>
        </div>

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

        <div className="mt-12 text-center">
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
        </div>
      </div>
    </section>
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
      <Card className="relative h-[480px] animate-pulse bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700" />
    );
  }

  const { primary, secondary } = priceLabel(tier, annual);
  const features = planFeatureBullets(tier.limits);
  const cta = planCtaCopy(tier.tier);

  return (
    <Card
      className={`relative h-full transition-all duration-300 hover:shadow-md ${
        isHighlight
          ? "border-blue-500 shadow-lg scale-105"
          : "border-gray-200 dark:border-gray-700"
      } bg-white dark:bg-gray-800`}
    >
      {isHighlight && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="px-4 py-1 bg-blue-600 hover:bg-blue-600">
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
            className={`w-full font-manrope ${
              isHighlight ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
            }`}
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
