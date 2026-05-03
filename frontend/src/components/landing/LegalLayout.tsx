import { motion } from "framer-motion";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export interface LegalSection {
  title: string;
  content: string;
}

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export function LegalLayout({
  title,
  subtitle,
  effectiveDate,
  sections,
}: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        <section className="pt-24 pb-12 md:pt-32 md:pb-16 relative overflow-hidden">
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
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
                {title}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
                {subtitle}
              </p>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-500 font-manrope">
                Effective: {effectiveDate}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-10 md:space-y-14">
              {sections.map((section, index) => (
                <motion.div
                  key={`${section.title}-${String(index)}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.5 }}
                  className="relative"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
                        {section.title}
                      </h2>
                      <div className="prose prose-lg prose-gray dark:prose-invert max-w-none">
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-manrope whitespace-pre-line">
                          {section.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
