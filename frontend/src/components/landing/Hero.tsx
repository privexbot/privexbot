import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  ContainerAnimated,
  ContainerInset,
  ContainerScroll,
  ContainerSticky,
  HeroButton,
  HeroVideo,
} from "@/components/ui/animated-video-on-scroll";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";

export function Hero() {
  const { actualTheme } = useTheme();

  // Different gradient backgrounds for light and dark mode with grid pattern
  // Using PrivexBot brand colors: Primary #3b82f6, Secondary #8b5cf6
  const getBackgroundStyle = () => {
    if (actualTheme === "dark") {
      return {
        backgroundImage: `
          radial-gradient(50% 50% at 50% 20%, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0.18) 22.92%, hsl(var(--primary) / 0.09) 42.71%, hsl(var(--background)) 88.54%),
          radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 2px, transparent 2px),
          linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px, 0 0, 0 0",
      };
    } else {
      return {
        backgroundImage: `
          radial-gradient(50% 50% at 50% 20%, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.10) 22.92%, hsl(var(--primary) / 0.05) 42.71%, hsl(var(--background)) 88.54%),
          radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.08) 2px, transparent 2px),
          linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px, 0 0, 0 0",
      };
    }
  };

  return (
    <section>
      <ContainerScroll className="h-[350vh]">
        <ContainerSticky
          style={getBackgroundStyle()}
          className="px-6 py-10 text-foreground"
        >
          <ContainerAnimated className="space-y-6 text-center">
            <div className="space-y-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-5xl font-semibold tracking-tight md:text-6xl font-manrope"
              >
                Build Privacy-First AI Chatbots
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="mx-auto max-w-[54ch] text-lg text-muted-foreground font-manrope"
              >
                Create intelligent chatbots with complete privacy using Secret
                Network's Trusted Execution Environment.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-8"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Link to="/signup">
                  <Button
                    className="font-manrope bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    size="lg"
                  >
                    Start Building For Free
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 1.0 }}
              >
                <Link to="/about">
                  <Button
                    variant="outline"
                    className="font-manrope border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 px-8 py-3 text-lg rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    size="lg"
                  >
                    Explore
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </ContainerAnimated>

          <ContainerInset
            className="max-h-[500px] w-auto py-8 mt-8 rounded-2xl overflow-hidden"
            roundednessRange={[1000, 24]}
          >
            <HeroVideo
              src="/videos/privexbot-anime.mp4"
              data-src="/videos/privexbot-anime.mp4"
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect fill='%234361EE' width='1920' height='1080'/%3E%3C/svg%3E"
            />
          </ContainerInset>

          {/* Trust indicators */}
          <ContainerAnimated
            transition={{ delay: 0.6 }}
            outputRange={[-100, 0]}
            inputRange={[0, 0.7]}
            className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-success-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Verifiable Execution</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-success-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>TEE Computing</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-success-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Confidential AI</span>
            </div>
          </ContainerAnimated>
        </ContainerSticky>
      </ContainerScroll>
    </section>
  );
}
