/**
 * Action Cards Component
 *
 * WHY: Provide quick access to create new resources
 * HOW: Grid of clickable cards with icons and descriptions
 *
 * FEATURES:
 * - Centered icon with gradient background
 * - Title and description
 * - Call-to-action button
 * - Hover animations
 * - Responsive grid layout
 * - Consistent design system with KB and signin pages
 */

import { Plus, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActionCardsProps {
  onCreateChatbot?: () => void;
  onCreateChatflow?: () => void;
  onCreateKnowledgeBase?: () => void;
  onViewAnalytics?: () => void;
}

export function ActionCards({
  onCreateChatbot,
  onCreateChatflow,
  onCreateKnowledgeBase,
  onViewAnalytics,
}: ActionCardsProps) {
  const actions = [
    {
      icon: Plus,
      iconColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-300 dark:border-blue-500",
      title: "Create Chatbot",
      description: "Build a simple form-based chatbot with AI assistance",
      buttonText: "Get Started",
      buttonClass: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-sm",
      onClick: onCreateChatbot,
      isCreateAction: true,
    },
    {
      icon: Plus,
      iconColor: "text-purple-600 dark:text-purple-400",
      borderColor: "border-purple-300 dark:border-purple-500",
      title: "Create Chatflow",
      description: "Design complex visual workflows with our intuitive studio",
      buttonText: "Open Studio",
      buttonClass: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
      onClick: onCreateChatflow,
      isCreateAction: true,
    },
    {
      icon: Plus,
      iconColor: "text-green-600 dark:text-green-400",
      borderColor: "border-green-300 dark:border-green-500",
      title: "Create Knowledge Base",
      description: "Upload documents and data for RAG-powered AI responses",
      buttonText: "Get Started",
      buttonClass: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
      onClick: onCreateKnowledgeBase,
      isCreateAction: true,
    },
    {
      icon: BarChart3,
      iconColor: "text-orange-600 dark:text-orange-400",
      title: "View Analytics",
      description: "Track performance, conversations, and user engagement metrics",
      buttonText: "View Report",
      buttonClass: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
      onClick: onViewAnalytics,
      isCreateAction: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
      {actions.map((action, index) => {
        const Icon = action.icon;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            className="h-full"
          >
            <Card
              onClick={action.onClick}
              className={cn(
                "group cursor-pointer border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl",
                "hover:shadow-lg dark:hover:shadow-gray-900/30 hover:border-gray-300 dark:hover:border-gray-500",
                "transition-all duration-300 h-full"
              )}
            >
            <CardContent className="p-5 md:p-6 flex flex-col h-full">
              {/* Top Section: Icon + Title/Description Horizontal Layout */}
              <div className="flex items-start gap-3 mb-4 md:mb-5 flex-1">
                {/* Icon - Left Side */}
                <div className="flex-shrink-0">
                  <div className="transition-transform duration-200 group-hover:scale-110">
                    {action.isCreateAction ? (
                      <div className={cn(
                        "w-9 h-9 md:w-10 md:h-10 rounded-full border flex items-center justify-center",
                        action.borderColor
                      )}>
                        <Icon className={cn("h-4 w-4 md:h-5 md:w-5", action.iconColor)} />
                      </div>
                    ) : (
                      <Icon className={cn("h-7 w-7 md:h-8 md:w-8", action.iconColor)} />
                    )}
                  </div>
                </div>

                {/* Text Content - Right Side */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-2 font-manrope">
                    {action.title}
                  </h3>

                  {/* Description - Below title, specific spacing and typography */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-manrope">
                    {action.description}
                  </p>
                </div>
              </div>

              {/* CTA Button - Full width at bottom */}
              <div className="mt-auto">
                <Button
                  className={cn(
                    "w-full min-h-[42px] md:min-h-[44px] font-medium text-center rounded-lg transition-all duration-200 font-manrope",
                    action.buttonClass
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick?.();
                  }}
                >
                  {action.buttonText}
                </Button>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
