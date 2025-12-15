import { TrendingUp, Users, Clock, ArrowRight, Quote } from "lucide-react";
import { Container } from "@/components/shared/Container";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const caseStudies = [
  {
    company: "TechCorp Solutions",
    industry: "SaaS",
    logo: "TC",
    challenge:
      "Customer support team overwhelmed with 1000+ daily inquiries, leading to slow response times and customer dissatisfaction.",
    solution:
      "Implemented PrivexBot with comprehensive knowledge base integration, handling 80% of common queries automatically.",
    results: [
      { metric: "80%", label: "Queries Automated" },
      { metric: "5min", label: "Avg Response Time" },
      { metric: "92%", label: "Customer Satisfaction" },
    ],
    quote:
      "PrivexBot transformed our support operations. We can now focus on complex issues while routine queries are handled instantly.",
    author: "Sarah Chen",
    role: "VP of Customer Success",
    color: "from-blue-500 to-primary",
  },
  {
    company: "HealthCare Plus",
    industry: "Healthcare",
    logo: "HC",
    challenge:
      "HIPAA compliance requirements made it difficult to deploy AI solutions while maintaining patient data privacy.",
    solution:
      "Deployed PrivexBot with Secret VM technology, ensuring all patient interactions remain confidential and compliant.",
    results: [
      { metric: "100%", label: "HIPAA Compliant" },
      { metric: "60%", label: "Cost Reduction" },
      { metric: "24/7", label: "Availability" },
    ],
    quote:
      "The Secret VM technology gave us the confidence to deploy AI while maintaining the highest privacy standards.",
    author: "Dr. Michael Rodriguez",
    role: "Chief Medical Officer",
    color: "from-green-500 to-emerald-600",
  },
  {
    company: "FinanceAI Group",
    industry: "Finance",
    logo: "FA",
    challenge:
      "Complex financial products required sophisticated conversational AI with multi-step workflows and API integrations.",
    solution:
      "Built advanced chatflows with conditional logic, external API integrations, and personalized financial recommendations.",
    results: [
      { metric: "3x", label: "Lead Generation" },
      { metric: "45%", label: "Conversion Rate" },
      { metric: "$2M", label: "Revenue Impact" },
    ],
    quote:
      "The visual workflow builder let us create complex financial advisory flows without a single line of code.",
    author: "Aisha Patel",
    role: "Director of Digital Strategy",
    color: "from-purple-500 to-pink-600",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.6,
      ease: [0.0, 0.0, 0.2, 1] as const,
    },
  }),
};

export function CaseStudies() {
  return (
    <section id="case-studies" className="py-16 md:py-24 bg-secondary/20 relative overflow-hidden scroll-mt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      <Container>
        <SectionHeading
          title="Success Stories"
          subtitle="See how leading organizations use PrivexBot to transform their customer engagement"
        />

        <div className="space-y-12 md:space-y-16">
          {caseStudies.map((study, index) => (
            <motion.div
              key={index}
              custom={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={cardVariants}
            >
              <Card className="overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:border-primary/50">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Left side - Company info and visual */}
                  <div className={`relative p-8 md:p-12 bg-gradient-to-br ${study.color}`}>
                    <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_85%)]"></div>

                    <div className="relative z-10 text-white h-full flex flex-col justify-between">
                      {/* Company logo and badge */}
                      <div>
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                            {study.logo}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">{study.company}</h3>
                            <Badge variant="secondary" className="mt-1">
                              {study.industry}
                            </Badge>
                          </div>
                        </div>

                        {/* Quote */}
                        <div className="mb-8">
                          <Quote className="h-8 w-8 mb-4 opacity-50" />
                          <blockquote className="text-lg md:text-xl font-medium leading-relaxed mb-4">
                            "{study.quote}"
                          </blockquote>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                              <Users className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-semibold">{study.author}</p>
                              <p className="text-sm text-white/80">{study.role}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Results */}
                      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/20">
                        {study.results.map((result, i) => (
                          <div key={i} className="text-center">
                            <div className="text-2xl md:text-3xl font-bold mb-1">
                              {result.metric}
                            </div>
                            <div className="text-xs md:text-sm text-white/80">
                              {result.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right side - Challenge and solution */}
                  <CardContent className="p-8 md:p-12 flex flex-col justify-between">
                    <div className="space-y-6">
                      {/* Challenge */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-destructive" />
                          </div>
                          <h4 className="text-lg font-semibold">Challenge</h4>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {study.challenge}
                        </p>
                      </div>

                      {/* Solution */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <h4 className="text-lg font-semibold">Solution</h4>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {study.solution}
                        </p>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-8 pt-6 border-t">
                      <Link to="/contact">
                        <Button variant="outline" className="w-full sm:w-auto group">
                          Read Full Case Study
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-muted-foreground mb-6">
            Want to see how PrivexBot can transform your business?
          </p>
          <Link to="/contact">
            <Button size="lg" className="gap-2">
              Schedule a Demo
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </motion.div>
      </Container>
    </section>
  );
}
