import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Container } from "@/components/shared/Container";
import { SectionHeading } from "@/components/shared/SectionHeading";
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

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-16 md:py-24 scroll-mt-16">
      <Container>
        <SectionHeading
          title="Simple, Transparent Pricing"
          subtitle="Choose the plan that's right for you. All plans include Secret VM security."
        />

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <Label htmlFor="billing-toggle" className={!annual ? "font-semibold" : ""}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={annual}
            onCheckedChange={setAnnual}
          />
          <Label htmlFor="billing-toggle" className={annual ? "font-semibold" : ""}>
            Annual
            <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </Label>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative transition-all duration-300 hover:shadow-xl ${
                tier.popular ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="px-4 py-1 bg-primary">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-6 pt-8 space-y-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                {/* Price */}
                <div className="min-h-[120px] flex flex-col items-center justify-center">
                  {tier.priceMonthly !== null ? (
                    <div className="space-y-2">
                      <div>
                        <span className="text-4xl font-bold">
                          ${annual ? Math.round(tier.priceAnnual / 12) : tier.priceMonthly}
                        </span>
                        <span className="text-base text-muted-foreground">/month</span>
                      </div>
                      {annual && tier.priceAnnual > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Billed ${tier.priceAnnual}/year
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-4xl font-bold">Custom</span>
                  )}
                </div>

                {/* CTA */}
                <Link to={tier.name === "Enterprise" ? "/contact" : "/signup"}>
                  <Button
                    variant={tier.ctaVariant}
                    className="w-full"
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
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Link */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Questions about pricing?{" "}
            <Link to="/faqs" className="text-primary hover:underline">
              View FAQ
            </Link>{" "}
            or{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact sales
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
