/**
 * Recent Resources Component
 *
 * WHY: Display recently created/modified resources (chatbots, chatflows, KBs)
 * HOW: Tabbed layout with resource cards
 *
 * FEATURES:
 * - Tabs for switching between resource types
 * - Resource cards with status badges
 * - Quick actions (view, edit)
 * - Responsive layout
 * - Fixed tab switching animation (no shaking)
 * - Consistent design system with KB and signin pages
 */

import { useState } from "react";
import { Network, Book, MessageCircle, MoreVertical, Eye, Edit, Trash2, FileText, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/time";
import type { ChatbotSummary, ChatflowSummary, KnowledgeBaseSummary, ResourceStatus } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RecentResourcesProps {
  chatbots: ChatbotSummary[];
  chatflows: ChatflowSummary[];
  knowledgeBases: KnowledgeBaseSummary[];
  onViewChatbots?: () => void;
  onViewChatflows?: () => void;
  onViewKnowledgeBases?: () => void;
  onResourceClick?: (resourceId: string, resourceType: string) => void;
  isLoading?: boolean;
}

// Custom chatbot SVG component
const ChatbotIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20.5696 19.0752L20.0096 18.5056L19.6816 18.8256L19.7936 19.2688L20.5696 19.0752ZM21.6 23.2L21.4064 23.976C21.5403 24.0093 21.6806 24.0075 21.8136 23.9706C21.9466 23.9337 22.0678 23.863 22.1654 23.7654C22.263 23.5678 22.3337 23.5466 22.3706 23.4136C22.4075 23.2806 22.4093 23.1403 22.376 23.0064L21.6 23.2ZM15.2 21.6L14.6336 21.0336L13.6352 22.0336L15.0064 22.376L15.2 21.6ZM15.24 21.56L15.8048 22.1264C15.9215 22.0101 15.9995 21.8606 16.0281 21.6983C16.0566 21.536 16.0344 21.3688 15.9644 21.2197C15.8943 21.0705 15.7799 20.9466 15.6368 20.8649C15.4937 20.7832 15.3289 20.7477 15.1648 20.7632L15.24 21.56ZM11.2 0V4H12.8V0H11.2ZM14.4 3.2H9.6V4.8H14.4V3.2ZM24 12.8C24 10.2539 22.9886 7.81212 21.1882 6.01178C19.3879 4.21143 16.9461 3.2 14.4 3.2V4.8C15.4506 4.8 16.4909 5.00693 17.4615 5.40896C18.4321 5.811 19.314 6.40028 20.0569 7.14315C20.7997 7.88601 21.389 8.76793 21.791 9.73853C22.1931 10.7091 22.4 11.7494 22.4 12.8H24ZM21.1296 19.6464C22.0402 18.7538 22.7633 17.6882 23.2562 16.5122C23.7491 15.3362 24.002 14.0751 24 12.8H22.4C22.402 13.8627 22.1915 14.9136 21.7807 15.8937C21.3699 16.8738 20.7688 17.7619 20.0096 18.5056L21.1296 19.6464ZM22.3776 23.0064L21.344 18.88L19.792 19.2672L20.8224 23.392L22.3776 23.0064ZM15.0064 22.376L21.4064 23.976L21.7936 22.424L15.3936 20.824L15.0064 22.376ZM14.6736 20.9952L14.6336 21.0336L15.7664 22.1648L15.8048 22.1264L14.6736 20.9952ZM14.4 22.4C14.7093 22.4 15.0144 22.3856 15.3152 22.3568L15.1648 20.7632C14.9106 20.7877 14.6554 20.7999 14.4 20.8V22.4ZM9.6 22.4H14.4V20.8H9.6V22.4ZM0 12.8C0 15.3461 1.01143 17.7879 2.81177 19.5882C4.61212 21.3886 7.05392 22.4 9.6 22.4V20.8C8.54942 20.8 7.50914 20.5931 6.53853 20.191C5.56793 19.789 4.68601 19.1997 3.94315 18.4569C2.44285 16.9566 1.6 14.9217 1.6 12.8H0ZM9.6 3.2C7.05392 3.2 4.61212 4.21143 2.81177 6.01178C1.01143 7.81212 0 10.2539 0 12.8H1.6C1.6 10.6783 2.44285 8.64344 3.94315 7.14315C5.44344 5.64285 7.47827 4.8 9.6 4.8V3.2ZM12 12.8C11.3635 12.8 10.753 12.5471 10.3029 12.0971C9.85286 11.647 9.6 11.0365 9.6 10.4H8C8 11.4609 8.42143 12.4783 9.17157 13.2284C9.92172 13.9786 10.9391 14.4 12 14.4V12.8ZM14.4 10.4C14.4 11.0365 14.1471 11.647 13.6971 12.0971C13.247 12.5471 12.6365 12.8 12 12.8V14.4C13.0609 14.4 14.0783 13.9786 14.8284 13.2284C15.5786 12.4783 16 11.4609 16 10.4H14.4ZM12 8C12.6365 8 13.247 8.25286 13.6971 8.70294C14.1471 9.15303 14.4 9.76348 14.4 10.4H16C16 9.33913 15.5786 8.32172 14.8284 7.57157C14.0783 6.82143 13.0609 6.4 12 6.4V8ZM12 6.4C10.9391 6.4 9.92172 6.82143 9.17157 7.57157C8.42143 8.32172 8 9.33913 8 10.4H9.6C9.6 9.76348 9.85286 9.15303 10.3029 8.70294C10.753 8.25286 11.3635 8 12 8V6.4ZM12 19.2C13.7024 19.2 15.2672 18.608 16.5008 17.6208L15.4992 16.3728C14.5392 17.1408 13.3248 17.6 12 17.6V19.2ZM7.4992 17.6208C8.7312 18.608 10.2992 19.2 12 19.2V17.6C10.7276 17.6028 9.49272 17.1697 8.5008 16.3728L7.4992 17.6208Z" fill="currentColor"/>
  </svg>
);

export function RecentResources({
  chatbots,
  chatflows,
  knowledgeBases,
  onViewChatbots,
  onViewChatflows,
  onViewKnowledgeBases,
  onResourceClick,
  isLoading,
}: RecentResourcesProps) {
  const [activeTab, setActiveTab] = useState<"chatbots" | "chatflows" | "knowledge_bases">("chatbots");

  // Get status badge styling
  const getStatusBadge = (status: ResourceStatus) => {
    const statusConfig = {
      active: { label: "Active", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
      inactive: { label: "Inactive", className: "bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-400" },
      draft: { label: "Draft", className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
      deployed: { label: "Deployed", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
      archived: { label: "Archived", className: "bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-400" },
    };

    return statusConfig[status] || statusConfig.inactive;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm h-full flex flex-col">
        <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-5 sm:p-6">
          <div className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg h-full flex flex-col transition-all duration-300"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 font-manrope">
          Recent Resources
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
          Your recently created and modified resources
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 sm:px-3 md:px-4 pt-4 sm:pt-5 md:pt-6 pb-2 sm:pb-3 md:pb-4">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg h-auto">
          <TabsTrigger
            value="chatbots"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-gray-100 text-xs sm:text-sm min-h-[44px] px-2 sm:px-3 py-2 rounded-md flex items-center justify-center font-manrope"
          >
            <ChatbotIcon className="h-4 w-4 mr-1 sm:mr-1.5 flex-shrink-0" />
            <span className="truncate">Chatbots</span>
          </TabsTrigger>
          <TabsTrigger
            value="chatflows"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-gray-100 text-xs sm:text-sm min-h-[44px] px-2 sm:px-3 py-2 rounded-md flex items-center justify-center font-manrope"
          >
            <Network className="h-4 w-4 mr-1 sm:mr-1.5 flex-shrink-0" />
            <span className="truncate">Chatflows</span>
          </TabsTrigger>
          <TabsTrigger
            value="knowledge_bases"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-gray-100 text-xs sm:text-sm min-h-[44px] px-2 sm:px-3 py-2 rounded-md flex items-center justify-center font-manrope"
          >
            <Book className="h-4 w-4 mr-1 sm:mr-1.5 flex-shrink-0" />
            <span className="truncate hidden lg:inline">Knowledge Bases</span>
            <span className="truncate lg:hidden">KB</span>
          </TabsTrigger>
          </TabsList>
        </div>

        {/* Chatbots Tab */}
        <TabsContent value="chatbots" className="flex-1 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
          <div className="p-3 sm:p-4 md:p-5">
            <div className="space-y-4">
              {/* Card Slots - Always render 4 slots for consistency */}
              <div className="space-y-4">
          {chatbots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChatbotIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-200">No chatbots yet</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Create your first chatbot to get started
              </p>
            </div>
          ) : (
            <>
              {chatbots.slice(0, 3).map((chatbot, index) => {
                const statusBadge = getStatusBadge(chatbot.status);
                return (
                  <motion.div
                    key={chatbot.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => onResourceClick?.(chatbot.id, "chatbot")}
                    className="group bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 sm:p-5 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
                  >
                    {/* Top Row (Primary Info Zone) */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Avatar/Icon (Left) */}
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-full border-2 border-blue-600 dark:border-blue-400 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50">
                          <ChatbotIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>

                      {/* Text Column (Center-Left) */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate font-manrope">
                          {chatbot.name}
                        </h3>
                      </div>

                      {/* Status Tag (Close to Title) */}
                      <div className="flex-shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            statusBadge.className
                          )}
                        >
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* More Options (Far Right) */}
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Horizontal Divider Line */}
                    <div className="flex justify-center mb-3">
                      <div className="w-[90%] h-px bg-gray-200 dark:bg-gray-500"></div>
                    </div>

                    {/* Bottom Row (Meta Information Zone) */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 ml-12">
                      {/* Conversations (Left) */}
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{chatbot.conversations_count} conversations</span>
                      </div>

                      {/* Timestamp (Right, closer to meta info) */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{formatRelativeTime(chatbot.last_active_at || chatbot.created_at)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {onViewChatbots && chatbots.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewChatbots}
                  className="w-full mt-2 min-h-[40px] text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 font-manrope"
                >
                  View All Chatbots ({chatbots.length})
                </Button>
              )}
            </>
          )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Chatflows Tab */}
        <TabsContent value="chatflows" className="flex-1 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
          <div className="p-3 sm:p-4 md:p-5">
            <div className="space-y-4">
              {/* Card Slots - Always render 4 slots for consistency */}
              <div className="space-y-4">
          {chatflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <Network className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-1">No chatflows yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Build your first chatflow in the studio
              </p>
            </div>
          ) : (
            <>
              {chatflows.slice(0, 3).map((chatflow, index) => {
                const statusBadge = getStatusBadge(chatflow.status);
                return (
                  <motion.div
                    key={chatflow.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => onResourceClick?.(chatflow.id, "chatflow")}
                    className="group bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 sm:p-5 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
                  >
                    {/* Top Row (Primary Info Zone) */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Avatar/Icon (Left) */}
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-full border-2 border-purple-600 dark:border-purple-400 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50">
                          <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>

                      {/* Text Column (Center-Left) */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate font-manrope">
                          {chatflow.name}
                        </h3>
                      </div>

                      {/* Status Tag (Close to Title) */}
                      <div className="flex-shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            statusBadge.className
                          )}
                        >
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* More Options (Far Right) */}
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Horizontal Divider Line */}
                    <div className="flex justify-center mb-3">
                      <div className="w-[90%] h-px bg-gray-200 dark:bg-gray-500"></div>
                    </div>

                    {/* Bottom Row (Meta Information Zone) */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 ml-12">
                      {/* Node Count (Left) */}
                      <span className="font-manrope">{chatflow.nodes_count} nodes</span>

                      {/* Conversations Count */}
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{chatflow.conversations_count} conversations</span>
                      </div>

                      {/* Timestamp (Right, closer to meta info) */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{formatRelativeTime(chatflow.updated_at || chatflow.created_at)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {onViewChatflows && chatflows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewChatflows}
                  className="w-full mt-2 min-h-[40px] text-purple-600 dark:text-purple-400 border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 font-manrope"
                >
                  View All Chatflows ({chatflows.length})
                </Button>
              )}
            </>
          )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Bases Tab */}
        <TabsContent value="knowledge_bases" className="flex-1 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
          <div className="p-3 sm:p-4 md:p-5">
            <div className="space-y-4">
              {/* Card Slots - Always render 4 slots for consistency */}
              <div className="space-y-4">
          {knowledgeBases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <Book className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-1">No knowledge bases yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Create your first KB to power RAG
              </p>
            </div>
          ) : (
            <>
              {knowledgeBases.slice(0, 3).map((kb, index) => {
                const statusBadge = getStatusBadge(kb.status);
                return (
                  <motion.div
                    key={kb.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => onResourceClick?.(kb.id, "knowledge_base")}
                    className="group bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 sm:p-5 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
                  >
                    {/* Top Row (Primary Info Zone) */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Avatar/Icon (Left) */}
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-full border-2 border-green-600 dark:border-green-400 flex items-center justify-center bg-green-100 dark:bg-green-900/50">
                          <Book className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>

                      {/* Text Column (Center-Left) */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate font-manrope">
                          {kb.name}
                        </h3>
                      </div>

                      {/* Status Tag (Close to Title) */}
                      <div className="flex-shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            statusBadge.className
                          )}
                        >
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* More Options (Far Right) */}
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Horizontal Divider Line */}
                    <div className="flex justify-center mb-3">
                      <div className="w-[90%] h-px bg-gray-200 dark:bg-gray-500"></div>
                    </div>

                    {/* Bottom Row (Meta Information Zone) */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 ml-12">
                      {/* Documents Count (Left) */}
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{kb.documents_count} documents</span>
                      </div>

                      {/* Timestamp (Right, closer to meta info) */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">{formatRelativeTime(kb.updated_at || kb.created_at)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {onViewKnowledgeBases && knowledgeBases.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewKnowledgeBases}
                  className="w-full mt-2 min-h-[40px] text-green-600 dark:text-green-400 border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 font-manrope"
                >
                  View All Knowledge Bases ({knowledgeBases.length})
                </Button>
              )}
            </>
          )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
