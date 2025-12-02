import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BrandIcon, BrandSection, NavCard, brandClasses } from "@/lib/design-system";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        <section className="brand-section min-h-[80vh] flex items-center justify-center">
          <div className="brand-grid-bg" />
          <div className="brand-container relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-2xl mx-auto"
            >
              {/* 404 Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="mb-8"
              >
                <div className="relative">
                  <div className="text-9xl font-bold text-gray-300 dark:text-gray-600 select-none font-manrope">
                    404
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="icon-container animate-pulse" style={{ width: '8rem', height: '8rem' }}>
                      <svg className="w-16 h-16 text-white dark:text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Error Message */}
              <h1 className="brand-heading-xl mb-6">
                Page Not Found
              </h1>
              <p className="brand-text-lg mb-8 leading-relaxed max-w-3xl mx-auto">
                Looks like you've ventured into uncharted territory. The page you're looking
                for doesn't exist or has been moved to a secure location.
              </p>

              {/* Helpful Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="space-y-4 mb-8"
              >
                <p className="brand-text">Here are some helpful links instead:</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <NavCard
                    to="/"
                    icon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                      </svg>
                    }
                    title="Home"
                    description="Back to our homepage"
                    delay={0.8}
                  />

                  <NavCard
                    to="/dashboard"
                    icon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                      </svg>
                    }
                    title="Dashboard"
                    description="Manage your chatbots"
                    delay={0.9}
                  />

                  <NavCard
                    to="/help"
                    icon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                      </svg>
                    }
                    title="Help Center"
                    description="Find answers and support"
                    delay={1.0}
                  />

                  <NavCard
                    to="/documentation"
                    icon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    }
                    title="Documentation"
                    description="API docs and guides"
                    delay={1.1}
                  />
                </div>
              </motion.div>

              {/* Primary Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 items-center justify-center"
              >
                <Link to="/">
                  <Button
                    className="font-manrope bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-lg"
                    size="lg"
                  >
                    Go Home
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="font-manrope border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 px-8 py-3 text-lg rounded-lg"
                  size="lg"
                >
                  Go Back
                </Button>
              </motion.div>

              {/* Fun Easter Egg */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4, duration: 0.6 }}
                className="mt-12 p-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl"
              >
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2 font-manrope">
                  🔐 <strong>Privacy Tip:</strong>
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
                  Even our 404 pages respect your privacy. Unlike other platforms, we don't track
                  which missing pages you visit or use this data for analytics.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}