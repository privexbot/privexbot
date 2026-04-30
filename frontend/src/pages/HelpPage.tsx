import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { useState } from "react";
import { motion } from "framer-motion";
import { BrandIcon, BrandSection, BrandHero, FAQItem, brandClasses } from "@/lib/design-system";

interface FAQItem {
  question: string;
  answer: string;
}

export function HelpPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const gettingStartedFAQs: FAQItem[] = [
    {
      question: "How do I create my first chatbot?",
      answer:
        "Sign up for a PrivexBot account, then navigate to the dashboard. Create an organization and workspace or use default, and click 'Create Knowledge Base and Chatbot'. Follow the prompts to configure your chatbot.",
    },
    {
      question: "What knowledge sources can I connect?",
      answer:
        "You can upload files (PDF, Word, CSV), scrape websites, connect Google Docs/Sheets, import from Notion, or directly input text content. All sources are processed privately in our TEE.",
    },
    {
      question: "How do I deploy my chatbot?",
      answer:
        "Once configured, click 'Deploy' to make your chatbot live. You'll get embed codes for websites, webhook URLs for Discord/Telegram, and API endpoints for custom integrations.",
    },
    {
      question: "Can I customize the chatbot appearance?",
      answer:
        "Yes! Customize colors, logos, welcome messages, and behavior patterns to match your brand. The widget is fully customizable while maintaining privacy.",
    },
  ];

  const privacyFAQs: FAQItem[] = [
    {
      question: "How does the Trusted Execution Environment work?",
      answer:
        "TEE creates secure, isolated environments where your data is processed. This ensures that sensitive information remains confidential and tamper-proof during AI processing.",
    },
    {
      question: "What data do you store?",
      answer:
        "We store only configuration metadata (chatbot settings, user preferences). All sensitive data (conversations, documents) is processed in TEE on selfhosted postgresql database",
    },
    {
      question: "Can I audit the privacy guarantees?",
      answer:
        "Yes! The codebase is opensourced and runs on secret VM. You can audit that your data was processed correctly and privately.",
    },
    {
      question: "Is PrivexBot GDPR compliant?",
      answer:
        "Absolutely. Our privacy-first architecture makes GDPR compliance inherent. Users have full control over their data.",
    },
  ];

  const technicalFAQs: FAQItem[] = [
    {
      question: "What AI models do you support?",
      answer:
        "We support Secret AI models and open-source alternatives. All models run privately within our TEE infrastructure.",
    },
    {
      question: "How do I integrate with my existing systems?",
      answer:
        "Use our REST API, webhooks, or pre-built integrations for Discord, Telegram, WhatsApp, and Zapier. All integrations maintain the same privacy guarantees.",
    },
    {
      question: "What's the difference between chatbots and chatflows?",
      answer:
        "Chatbots are simple Q&A systems built with forms. Chatflows are complex workflows with branching logic, built with our visual drag-and-drop editor.",
    },
    {
      question: "Do you offer on-premise deployment?",
      answer:
        "Yes! Enterprise customers can deploy PrivexBot on their own infrastructure while maintaining TEE privacy guarantees. Contact sales for details.",
    },
  ];

  const billingFAQs: FAQItem[] = [
    {
      question: "How does pricing work?",
      answer:
        "We offer tier-based plans (Free, Starter, Pro, Enterprise) with quotas on chatbots, chatflows, KB documents, messages, API calls, and team members. The Free tier is free forever — no credit card required. See /pricing for the live limits and prices.",
    },
    {
      question: "Can I change plans anytime?",
      answer:
        "Yes. While self-serve checkout is being finalized, plan upgrades go through privexbot@gmail.com — we apply the change immediately and pro-rate billing.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "Major credit cards via our payment processor (Stripe is being wired up). Bank transfer is available for Enterprise on request.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Annual plans: pro-rated refund within 30 days of purchase. Monthly plans: cancel anytime, effective at the end of the current cycle. See /terms for the full policy.",
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const renderFAQSection = (
    title: string,
    faqs: FAQItem[],
    sectionIndex: number
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      <h2 className="text-2xl font-bold mb-6 font-manrope text-gray-900 dark:text-white">{title}</h2>
      <div className="space-y-4">
        {faqs.map((faq, index) => {
          const faqIndex = sectionIndex * 1000 + index;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleFAQ(faqIndex)}
                className="w-full px-6 py-6 md:px-8 md:py-8 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-2xl flex items-center justify-between"
              >
                <span className="font-medium pr-4 text-gray-900 dark:text-white font-manrope">{faq.question}</span>
                <svg
                  className={`w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400 transform transition-transform duration-300 flex-shrink-0 ${
                    openFAQ === faqIndex ? "rotate-180" : ""
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {openFAQ === faqIndex && (
                <div className="px-6 pb-6 md:px-8 md:pb-8 pt-0">
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-manrope">
                    {faq.answer}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        <BrandSection>
          <BrandHero
            title="Help Center"
            subtitle="Find answers to common questions, learn how to use PrivexBot, and get the most out of your privacy-first AI chatbots."
          />
        </BrandSection>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="grid md:grid-cols-3 gap-6 mb-16"
          >
            <motion.a
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.1, duration: 0.6 }}
              href="#getting-started"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow group"
            >
              <BrandIcon className="mb-4">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </BrandIcon>
              <h3 className="text-lg font-semibold mb-2 font-manrope text-gray-900 dark:text-white">Getting Started</h3>
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                Learn the basics of creating and deploying your first chatbot
              </p>
            </motion.a>

            <motion.a
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.2, duration: 0.6 }}
              href="#privacy"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow group"
            >
              <BrandIcon className="mb-4">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </svg>
              </BrandIcon>
              <h3 className="text-lg font-semibold mb-2 font-manrope text-gray-900 dark:text-white">Privacy & Security</h3>
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                Understand how we protect your data with TEE technology
              </p>
            </motion.a>

            <motion.a
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.3, duration: 0.6 }}
              href="#technical"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-md transition-shadow group"
            >
              <BrandIcon className="mb-4">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </BrandIcon>
              <h3 className="text-lg font-semibold mb-2 font-manrope text-gray-900 dark:text-white">Technical Guide</h3>
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                Advanced features, integrations, and API documentation
              </p>
            </motion.a>
          </motion.div>

          {/* FAQ Sections */}
          <div id="getting-started">
            {renderFAQSection("Getting Started", gettingStartedFAQs, 0)}
          </div>

          <div id="privacy">
            {renderFAQSection("Privacy & Security", privacyFAQs, 1)}
          </div>

          <div id="technical">
            {renderFAQSection("Technical Guide", technicalFAQs, 2)}
          </div>

          <div id="billing">
            {renderFAQSection("Billing & Plans", billingFAQs, 3)}
          </div>

        </div>
      </main>

      <FinalCTA />
      <Footer />
    </div>
  );
}
