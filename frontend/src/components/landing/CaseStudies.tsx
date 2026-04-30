import { Workflow, MessagesSquare, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface CaseStudy {
  icon: typeof Workflow;
  eyebrow: string;
  title: string;
  summary: string;
  results: { metric: string; label: string }[];
}

const caseStudies: CaseStudy[] = [
  {
    icon: Workflow,
    eyebrow: "Knowledge base",
    title: "Grounded support assistant",
    summary:
      "KB node feeds an LLM node, embedded as a website widget. Answers cite their sources.",
    results: [
      { metric: "5", label: "Node chatflow" },
      { metric: "TEE", label: "Inference" },
      { metric: "1 day", label: "To live" },
    ],
  },
  {
    icon: MessagesSquare,
    eyebrow: "Multi-channel",
    title: "One agent, every channel",
    summary:
      "Same chatflow deployed to Telegram, Discord, and a website widget — with shared-bot routing.",
    results: [
      { metric: "3", label: "Channels" },
      { metric: "0", label: "Glue code" },
      { metric: "Webhook", label: "To CRM" },
    ],
  },
  {
    icon: Code2,
    eyebrow: "Self-host",
    title: "Auditable on-prem deployment",
    summary:
      "Apache 2.0 stack on internal Kubernetes, inference pointed at Secret AI for confidential execution.",
    results: [
      { metric: "Apache 2.0", label: "License" },
      { metric: "Self-host", label: "Deploy" },
      { metric: "Attested", label: "Inference" },
    ],
  },
];

export function CaseStudies() {
  return (
    <section
      id="case-studies"
      className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-manrope">
            Use cases
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
            What you can build
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
            Three patterns we keep seeing, mapped to the actual nodes and
            channels in the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {caseStudies.map((study, index) => {
            const Icon = study.icon;
            return (
              <motion.div
                key={study.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col"
              >
                <Icon
                  className="h-6 w-6 text-blue-600 mb-4"
                  strokeWidth={1.75}
                />

                <p className="text-xs font-medium uppercase tracking-wide text-blue-600 mb-2 font-manrope">
                  {study.eyebrow}
                </p>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3 font-manrope">
                  {study.title}
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mb-6">
                  {study.summary}
                </p>

                <div className="grid grid-cols-3 gap-3 mt-auto pt-6 border-t border-gray-200 dark:border-gray-700">
                  {study.results.map((result) => (
                    <div key={result.label}>
                      <div className="text-base md:text-lg font-bold text-gray-900 dark:text-white font-manrope">
                        {result.metric}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        {result.label}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 lg:mt-16 text-center">
          <Link to="/signup">
            <Button
              size="lg"
              className="font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              Build something similar — free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
