import { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const pricingTiers = [
  {
    name: "Free",
    description: "Perfect for trying out PrivexBot",
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      "1 Chatbot",
      "1 Knowledge Base",
      "1,000 messages/month",
      "Basic analytics",
      "Community support",
      "Embeddable widget",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Starter",
    description: "For small businesses getting started",
    priceMonthly: 19,
    priceAnnual: 180,
    features: [
      "3 Chatbots",
      "2 Knowledge Bases",
      "10,000 messages/month",
      "Advanced analytics",
      "Email support",
      "Custom branding",
      "Basic API access",
      "WhatsApp integration",
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    description: "For growing teams and businesses",
    priceMonthly: 49,
    priceAnnual: 470,
    features: [
      "10 Chatbots",
      "5 Knowledge Bases",
      "50,000 messages/month",
      "Priority support",
      "Full API access",
      "Webhook integrations",
      "Multi-language support",
      "Advanced workflows",
      "A/B testing",
    ],
    cta: "Start Free Trial",
    ctaVariant: "default" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large organizations",
    priceMonthly: null,
    priceAnnual: null,
    features: [
      "Unlimited chatbots",
      "Unlimited knowledge bases",
      "Unlimited messages",
      "Dedicated support",
      "Custom deployment",
      "SLA guarantee",
      "White-label solution",
      "On-premise option",
      "Custom integrations",
      "Advanced security",
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    popular: false,
  },
];

export function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        {/* Hero Section with Grid Background */}
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
          {/* Grid background pattern with diamond intersections */}
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
                Choose the plan that's right for you. All plans include Secret VM security.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Pricing Content Section */}
        <section className="pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Billing Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center gap-4 mb-12"
            >
              <Label htmlFor="billing-toggle" className={`font-manrope ${!annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={annual}
                onCheckedChange={setAnnual}
              />
              <Label htmlFor="billing-toggle" className={`font-manrope ${annual ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                Annual
                <Badge variant="secondary" className="ml-2">Save 20%</Badge>
              </Label>
            </motion.div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                >
                  <Card
                    className={`relative h-full transition-all duration-300 hover:shadow-xl ${
                      tier.popular ? "border-blue-500 shadow-lg scale-105" : "border-gray-200 dark:border-gray-700"
                    } bg-white dark:bg-gray-800`}
                  >
                    {tier.popular && (
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
                          {tier.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                          {tier.description}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="min-h-[120px] flex flex-col items-center justify-center">
                        {tier.priceMonthly !== null ? (
                          <div className="space-y-2">
                            <div>
                              <span className="text-4xl font-bold text-gray-900 dark:text-white font-manrope">
                                ${annual ? Math.round(tier.priceAnnual / 12) : tier.priceMonthly}
                              </span>
                              <span className="text-base text-gray-600 dark:text-gray-400 font-manrope">/month</span>
                            </div>
                            {annual && tier.priceAnnual > 0 && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                                Billed ${tier.priceAnnual}/year
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-4xl font-bold text-gray-900 dark:text-white font-manrope">Custom</span>
                        )}
                      </div>

                      {/* CTA */}
                      <Link to={tier.name === "Enterprise" ? "/contact" : "/signup"}>
                        <Button
                          variant={tier.ctaVariant}
                          className="w-full font-manrope"
                          size="lg"
                        >
                          {tier.cta}
                        </Button>
                      </Link>
                    </CardHeader>

                    <CardContent>
                      {/* Features List */}
                      <ul className="space-y-3">
                        {tier.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-3">
                            <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* FAQ Link */}
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
                <Link to="/contact" className="text-blue-600 hover:underline">
                  contact sales
                </Link>
              </p>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}