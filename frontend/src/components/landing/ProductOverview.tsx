import { motion } from "framer-motion";

export function ProductOverview() {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Browser Window Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative max-w-7xl mx-auto"
        >
          {/* Browser Chrome - Desktop Only */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-t-xl shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Window Controls & URL Bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              {/* macOS Window Controls */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>

              {/* URL Bar */}
              <div className="flex-1 mx-4">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 flex items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>privexbot.com/chatflows/builder</span>
                  </div>
                </div>
              </div>

              {/* Browser Actions */}
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <button className="p-1 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button className="p-1 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Browser Content - Chatflow Interface */}
          <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-t-none md:rounded-b-xl shadow-2xl border md:border-l md:border-r md:border-b border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="relative">
              <img
                src="/chatflow.png"
                alt="PrivexBot Chatflow Builder Interface"
                className="w-full h-auto block"
              />

              {/* Subtle overlay for better integration */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Glow effect */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 rounded-xl blur-3xl scale-105"></div>
        </motion.div>

        {/* Bottom text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center mt-8 md:mt-12"
        >
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 font-manrope px-4">
            17 node types, auto-save, validation, and one-click deploy to web,
            Discord, Slack, Telegram, WhatsApp, Zapier, or REST API.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
