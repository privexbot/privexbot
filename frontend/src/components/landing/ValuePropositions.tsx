import { Check, Shield, Users, Zap, Globe } from "lucide-react";
import { motion } from "framer-motion";

const valueProps = [
  {
    icon: Check,
    title: "No-Code Builder",
    description:
      "Create sophisticated chatbots with our visual flow designer. No programming required.",
  },
  {
    icon: Shield,
    title: "Complete Privacy",
    description:
      "Data processing happens in Secret Network's TEE, ensuring your conversations stay private.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Work together with your team to build, test, and deploy chatbots collaboratively.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Deploy and scale your chatbots instantly. Built for performance and reliability.",
  },
  {
    icon: Globe,
    title: "Multi-Platform Deploy",
    description:
      "Create KB from Notion, Google Docs, PDFs & more. Deploy chatbots on discord, web & custom platforms.",
  },
];

export function ValuePropositions() {
  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:gap-16 items-center">
          {/* Left side - Main feature with frame */}
          <div className="flex-1">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
                  No-Code Builder
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 font-manrope">
                  Create sophisticated chatbots with our visual flow designer.
                  No programming required.
                </p>
              </div>

              {/* Frame with interface image */}
              <div className="relative">
                <img
                  src="/why-us-frame-image.png"
                  alt="PrivexBot No-Code Builder Interface"
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Right side - Value proposition grid */}
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-6">
              {valueProps.slice(1).map((prop, index) => {
                const Icon = prop.icon;
                return (
                  <motion.div
                    key={index + 1}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-white dark:text-black" />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 font-manrope">
                      {prop.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-manrope">
                      {prop.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-8">
          {/* Main feature card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 font-manrope">
              No-Code Builder
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-manrope">
              Create sophisticated chatbots with our visual flow designer. No
              programming required.
            </p>
            <div className="relative">
              <img
                src="/why-us-frame-image.png"
                alt="PrivexBot No-Code Builder Interface"
                className="w-full h-auto rounded-xl"
              />
            </div>
          </motion.div>

          {/* Value proposition cards */}
          {valueProps.slice(1).map((prop, index) => {
            const Icon = prop.icon;
            return (
              <motion.div
                key={index + 1}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                {/* Icon */}
                <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-white dark:text-black" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 font-manrope">
                  {prop.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-manrope">
                  {prop.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
