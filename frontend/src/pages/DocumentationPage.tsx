/**
 * Documentation Page (Protected)
 *
 * Surfaces external GitBook docs + in-app help/FAQ. The sidebar entry now
 * jumps straight to GitBook, but this route is kept for direct visits.
 */

import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const GITBOOK_URL =
  "https://privexbot.gitbook.io/privexbot-docs/documentation";
const DISCORD_URL = "https://discord.gg/53S3Ur9x";

const resources = [
  {
    icon: BookOpen,
    title: "Read the docs on GitBook",
    description:
      "Comprehensive guides, API reference, integrations, and tutorials.",
    href: GITBOOK_URL,
    external: true,
  },
  {
    icon: HelpCircle,
    title: "Help Center",
    description: "Quick how-tos for getting started, building, and deploying.",
    href: "/help",
    external: false,
  },
  {
    icon: MessageCircle,
    title: "FAQs",
    description: "Common questions about pricing, privacy, and features.",
    href: "/faqs",
    external: false,
  },
] as const;

export function DocumentationPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="w-full bg-background min-h-screen">
        <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 max-w-5xl mx-auto py-10 md:py-14">
          <Button
            variant="ghost"
            onClick={() => {
              navigate("/dashboard");
            }}
            className="mb-6 -ml-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 font-manrope">
              Documentation
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-3xl font-manrope leading-relaxed">
              Access comprehensive guides, API documentation, tutorials, and
              help resources. Learn how to maximize your PrivexBot experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            {resources.map((resource) => {
              const Icon = resource.icon;
              const inner = (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <Icon
                      className="h-6 w-6 text-blue-600"
                      strokeWidth={1.75}
                    />
                    {resource.external ? (
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-manrope">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                    {resource.description}
                  </p>
                </div>
              );

              if (resource.external) {
                return (
                  <a
                    key={resource.title}
                    href={resource.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {inner}
                  </a>
                );
              }

              return (
                <Link key={resource.title} to={resource.href} className="block">
                  {inner}
                </Link>
              );
            })}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2 font-manrope">
              Still stuck?
            </h2>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mb-4">
              Join the community on Discord or email us — we read every
              message.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white font-manrope"
              >
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Join Discord
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-manrope"
              >
                <a href="mailto:privexbot@gmail.com">privexbot@gmail.com</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
