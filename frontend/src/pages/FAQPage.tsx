import { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: "What is PrivexBot?",
    answer: `PrivexBot is a privacy-first, multi-tenant SaaS platform for building AI chatbots with RAG-powered knowledge bases. It features dual creation modes: simple form-based setup and visual workflow builder for complex chatflows.

Our platform runs AI workloads in Secret Network's Trusted Execution Environment (TEE) to ensure complete data privacy. You can create knowledge bases from multiple sources (Notion, Google Docs, PDFs, websites) and deploy chatbots across multiple channels including web widgets, Discord, Telegram, and WhatsApp.`,
  },
  {
    id: 2,
    question: "How does the privacy-first architecture work?",
    answer: `PrivexBot uses Secret Network's Trusted Execution Environment (TEE) for verifiable execution and confidential AI processing. This means your data and conversations runs in a secure, isolated environment.

Your knowledge base content, user conversations, and AI processing all happen in SecretVM, ensuring complete privacy and data sovereignty. This is especially important for businesses handling sensitive information or operating in regulated industries.`,
  },
  {
    id: 3,
    question: "What sources can I use to create knowledge bases?",
    answer: `PrivexBot supports multiple knowledge base sources:

• File uploads: PDF, Word, CSV, JSON, and 15+ other formats
• Website scraping: Automatic content extraction from any URL
• Google Docs/Sheets: Direct integration with OAuth authentication
• Notion: API integration for seamless content sync
• Direct text input: Manual content creation and editing

All content goes through our intelligent chunking and embedding pipeline for optimal RAG performance.`,
  },
  {
    id: 4,
    question: "What's the difference between Chatbots and Chatflows?",
    answer: `PrivexBot offers two creation modes:

**Chatbots**: Simple, form-based creation for straightforward Q&A bots. Perfect for basic customer support or FAQ automation.

**Chatflows**: Advanced visual workflow builder with drag-and-drop nodes, conditional logic, and complex branching. Ideal for sophisticated automation, lead qualification, or multi-step processes.

Both share the same deployment API and can be deployed to the same channels, but chatflows offer much more flexibility for complex use cases.`,
  },
  {
    id: 5,
    question: "Which platforms can I deploy my chatbots to?",
    answer: `PrivexBot supports multi-channel deployment:

• **Website embed**: JavaScript widget or iframe integration
• **Discord**: Automatic bot registration and webhook setup
• **Telegram**: Direct bot creation and management
• **WhatsApp Business API**: For business communication
• **Zapier webhook**: Custom integrations with 5,000+ apps
• **REST API**: Direct API access for custom implementations

All channels use the same underlying bot logic and knowledge base, so you create once and deploy everywhere.`,
  },
  {
    id: 6,
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a 30-day money-back guarantee for all paid plans. If you're not satisfied with our service, contact our support team within 30 days of your purchase for a full refund. No questions asked.",
  },
];

export function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

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
              backgroundSize: "48px 48px, 48px 48px, 48px 48px",
              backgroundPosition: "24px 24px, 0 0, 0 0",
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
                FAQs
              </h1>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 font-manrope">
                Your Questions.
              </h2>
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-8 font-manrope">
                Answered.
              </h3>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-manrope">
                Contact us if you have any other questions.
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ Content Section */}
        <section className="pb-16 md:pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {faqData.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full px-6 py-6 md:px-8 md:py-8 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-2xl"
                  >
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white font-manrope pr-4">
                      {item.question}
                    </h3>
                    <ChevronDown
                      className={`h-5 w-5 md:h-6 md:w-6 text-gray-600 dark:text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                        openItems.has(item.id) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <motion.div
                    initial={false}
                    animate={{
                      height: openItems.has(item.id) ? "auto" : 0,
                      opacity: openItems.has(item.id) ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 md:px-8 md:pb-8 pt-0">
                      <div className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed whitespace-pre-line">
                        {item.answer}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
