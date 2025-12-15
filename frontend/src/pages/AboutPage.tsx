import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { motion } from "framer-motion";
import { BrandIcon, BrandSection, BrandHero, FeatureCard, brandClasses } from "@/lib/design-system";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        <BrandSection>
          <BrandHero
            title="About PrivexBot"
            subtitle="Building the future of privacy-first AI chatbots using Secret Network's Trusted Execution Environment technology."
          />
        </BrandSection>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* Mission Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center font-manrope text-gray-900 dark:text-white">Our Mission</h2>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6 font-manrope">
                At PrivexBot, we believe that privacy and AI should go hand in hand. Traditional
                AI platforms require you to sacrifice your sensitive data to gain intelligence.
                We're changing that.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed font-manrope">
                Our platform leverages Secret Network's cutting-edge Trusted Execution Environment
                to ensure your data remains completely private while still enabling powerful AI
                interactions. Your conversations, documents, and insights stay yours.
              </p>
            </div>
          </motion.div>

          {/* Technology Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center font-manrope text-gray-900 dark:text-white">Technology</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <BrandIcon className="mb-4">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  </svg>
                </BrandIcon>
                <h3 className="text-xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Trusted Execution Environment</h3>
                <p className="text-gray-600 dark:text-gray-400 font-manrope">
                  All AI processing happens inside secure enclaves that are cryptographically
                  verified, ensuring your data never leaves the protected environment.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <BrandIcon className="mb-4">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </BrandIcon>
                <h3 className="text-xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Verifiable Computing</h3>
                <p className="text-gray-600 dark:text-gray-400 font-manrope">
                  Every computation can be cryptographically verified, providing mathematical
                  proof that your data was processed correctly and privately.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <BrandIcon className="mb-4">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 6H5V5h14v4z"/>
                    <path d="M19 13H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zm0 6H5v-4h14v4z"/>
                  </svg>
                </BrandIcon>
                <h3 className="text-xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Multi-Modal AI</h3>
                <p className="text-gray-600 dark:text-gray-400 font-manrope">
                  Support for text, voice, images, and documents with advanced RAG capabilities
                  for intelligent knowledge retrieval.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <BrandIcon className="mb-4">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                </BrandIcon>
                <h3 className="text-xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Enterprise Ready</h3>
                <p className="text-gray-600 dark:text-gray-400 font-manrope">
                  Multi-tenant architecture with organization and workspace management,
                  perfect for teams and enterprises.
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Team Values Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center font-manrope text-gray-900 dark:text-white">Our Values</h2>
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="text-center"
              >
                <div className="flex items-center justify-center mx-auto mb-4">
                  <BrandIcon size="lg">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                    </svg>
                  </BrandIcon>
                </div>
                <h3 className="text-2xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Privacy First</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-manrope">
                  Privacy isn't an afterthought—it's our foundation. Every feature is designed
                  with privacy as the core principle.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-center"
              >
                <div className="flex items-center justify-center mx-auto mb-4">
                  <BrandIcon size="lg">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547A8.014 8.014 0 014 21h16a8.014 8.014 0 01-.244-5.428z"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </BrandIcon>
                </div>
                <h3 className="text-2xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">User Empowerment</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-manrope">
                  We build tools that put users in control of their data and AI interactions,
                  not the other way around.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-center"
              >
                <div className="flex items-center justify-center mx-auto mb-4">
                  <BrandIcon size="lg">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </BrandIcon>
                </div>
                <h3 className="text-2xl font-semibold mb-3 font-manrope text-gray-900 dark:text-white">Innovation</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-manrope">
                  We're pushing the boundaries of what's possible with private AI, creating
                  solutions that don't exist anywhere else.
                </p>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </main>

      <FinalCTA />
      <Footer />
    </div>
  );
}