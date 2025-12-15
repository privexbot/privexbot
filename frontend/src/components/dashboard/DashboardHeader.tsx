/**
 * Dashboard Header Component
 *
 * WHY: Provide quick access to search, notifications, and resource creation
 * HOW: Clean icon-based design with pill-shaped controls and dynamic states
 *
 * DESIGN:
 * - Left: Clickable Avatar (to profile) + Greeting (truncated username)
 * - Right: Expandable Search + Bell + Unified Time/Calendar Picker + Create Button
 * - Modern, clean aesthetic with proper spacing and dynamic updates
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Calendar, Plus, Network, Book, ChevronDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { User } from "@/types/auth";

// Custom chatbot SVG component
const ChatbotIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20.5696 19.0752L20.0096 18.5056L19.6816 18.8256L19.7936 19.2688L20.5696 19.0752ZM21.6 23.2L21.4064 23.976C21.5403 24.0093 21.6806 24.0075 21.8136 23.9706C21.9466 23.9337 22.0678 23.863 22.1654 23.7654C22.263 23.5678 22.3337 23.5466 22.3706 23.4136C22.4075 23.2806 22.4093 23.1403 22.376 23.0064L21.6 23.2ZM15.2 21.6L14.6336 21.0336L13.6352 22.0336L15.0064 22.376L15.2 21.6ZM15.24 21.56L15.8048 22.1264C15.9215 22.0101 15.9995 21.8606 16.0281 21.6983C16.0566 21.536 16.0344 21.3688 15.9644 21.2197C15.8943 21.0705 15.7799 20.9466 15.6368 20.8649C15.4937 20.7832 15.3289 20.7477 15.1648 20.7632L15.24 21.56ZM11.2 0V4H12.8V0H11.2ZM14.4 3.2H9.6V4.8H14.4V3.2ZM24 12.8C24 10.2539 22.9886 7.81212 21.1882 6.01178C19.3879 4.21143 16.9461 3.2 14.4 3.2V4.8C15.4506 4.8 16.4909 5.00693 17.4615 5.40896C18.4321 5.811 19.314 6.40028 20.0569 7.14315C20.7997 7.88601 21.389 8.76793 21.791 9.73853C22.1931 10.7091 22.4 11.7494 22.4 12.8H24ZM21.1296 19.6464C22.0402 18.7538 22.7633 17.6882 23.2562 16.5122C23.7491 15.3362 24.002 14.0751 24 12.8H22.4C22.402 13.8627 22.1915 14.9136 21.7807 15.8937C21.3699 16.8738 20.7688 17.7619 20.0096 18.5056L21.1296 19.6464ZM22.3776 23.0064L21.344 18.88L19.792 19.2672L20.8224 23.392L22.3776 23.0064ZM15.0064 22.376L21.4064 23.976L21.7936 22.424L15.3936 20.824L15.0064 22.376ZM14.6736 20.9952L14.6336 21.0336L15.7664 22.1648L15.8048 22.1264L14.6736 20.9952ZM14.4 22.4C14.7093 22.4 15.0144 22.3856 15.3152 22.3568L15.1648 20.7632C14.9106 20.7877 14.6554 20.7999 14.4 20.8V22.4ZM9.6 22.4H14.4V20.8H9.6V22.4ZM0 12.8C0 15.3461 1.01143 17.7879 2.81177 19.5882C4.61212 21.3886 7.05392 22.4 9.6 22.4V20.8C8.54942 20.8 7.50914 20.5931 6.53853 20.191C5.56793 19.789 4.68601 19.1997 3.94315 18.4569C2.44285 16.9566 1.6 14.9217 1.6 12.8H0ZM9.6 3.2C7.05392 3.2 4.61212 4.21143 2.81177 6.01178C1.01143 7.81212 0 10.2539 0 12.8H1.6C1.6 10.6783 2.44285 8.64344 3.94315 7.14315C5.44344 5.64285 7.47827 4.8 9.6 4.8V3.2ZM12 12.8C11.3635 12.8 10.753 12.5471 10.3029 12.0971C9.85286 11.647 9.6 11.0365 9.6 10.4H8C8 11.4609 8.42143 12.4783 9.17157 13.2284C9.92172 13.9786 10.9391 14.4 12 14.4V12.8ZM14.4 10.4C14.4 11.0365 14.1471 11.647 13.6971 12.0971C13.247 12.5471 12.6365 12.8 12 12.8V14.4C13.0609 14.4 14.0783 13.9786 14.8284 13.2284C15.5786 12.4783 16 11.4609 16 10.4H14.4ZM12 8C12.6365 8 13.247 8.25286 13.6971 8.70294C14.1471 9.15303 14.4 9.76348 14.4 10.4H16C16 9.33913 15.5786 8.32172 14.8284 7.57157C14.0783 6.82143 13.0609 6.4 12 6.4V8ZM12 6.4C10.9391 6.4 9.92172 6.82143 9.17157 7.57157C8.42143 8.32172 8 9.33913 8 10.4H9.6C9.6 9.76348 9.85286 9.15303 10.3029 8.70294C10.753 8.25286 11.3635 8 12 8V6.4ZM12 19.2C13.7024 19.2 15.2672 18.608 16.5008 17.6208L15.4992 16.3728C14.5392 17.1408 13.3248 17.6 12 17.6V19.2ZM7.4992 17.6208C8.7312 18.608 10.2992 19.2 12 19.2V17.6C10.7276 17.6028 9.49272 17.1697 8.5008 16.3728L7.4992 17.6208Z" fill="currentColor"/>
  </svg>
);

interface DashboardHeaderProps {
  user?: User | null;
  onCreateChatbot?: () => void;
  onCreateChatflow?: () => void;
  onCreateKnowledgeBase?: () => void;
  onTimeRangeChange?: (timeRange: string) => void;
  selectedTimeRange?: string;
  onCustomDateRangeChange?: (dateRange: string | null) => void;
  onSearchChange?: (search: string) => void;
}

export function DashboardHeader({
  user,
  onCreateChatbot,
  onCreateChatflow,
  onCreateKnowledgeBase,
  onTimeRangeChange,
  selectedTimeRange: propSelectedTimeRange,
  onCustomDateRangeChange,
  onSearchChange,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [hasUnreadNotifications] = useState(true); // TODO: Get from API
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState(propSelectedTimeRange || "Last 7 days");
  const [selectedDateRange, setSelectedDateRange] = useState<string | null>(null);
  const [calendarStartDate, setCalendarStartDate] = useState<Date | null>(null);
  const [calendarEndDate, setCalendarEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Get user initials for avatar fallback
  const userInitials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleSearchToggle = () => {
    setSearchExpanded(!searchExpanded);
    if (searchExpanded) {
      setSearchQuery("");
      // Clear the search in parent component when closing search
      onSearchChange?.("");
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();

    // Call the search callback with the query (empty string clears search)
    onSearchChange?.(trimmedQuery);

    // Collapse search input after submit
    setSearchExpanded(false);
    setSearchQuery("");
  };

  const handleNotifications = () => {
    // TODO: Open notifications panel
    console.log("Open notifications");
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  const handleTimeRangeSelect = (range: string) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range); // Notify parent component

    // Clear custom date range when selecting a time range
    setSelectedDateRange(null);
    onCustomDateRangeChange?.(null);

    // TODO: Fetch data for selected time range
    console.log("Time range selected:", range);
  };

  const handleDateClick = (date: Date) => {
    if (!calendarStartDate || (calendarStartDate && calendarEndDate)) {
      // First click or reset: set start date
      setCalendarStartDate(date);
      setCalendarEndDate(null);
    } else if (calendarStartDate && !calendarEndDate) {
      // Second click: set end date
      if (date >= calendarStartDate) {
        setCalendarEndDate(date);
      } else {
        // If second date is before first, reset start date
        setCalendarStartDate(date);
        setCalendarEndDate(null);
      }
    }
  };

  const handleApplyCustomRange = () => {
    if (calendarStartDate && calendarEndDate) {
      const startStr = calendarStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = calendarEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateRangeStr = `${startStr} - ${endStr}`;
      setSelectedDateRange(dateRangeStr);
      setIsCalendarOpen(false);

      // Notify parent component about custom date range
      onCustomDateRangeChange?.(dateRangeStr);

      // Clear the time range since we're using custom dates
      onTimeRangeChange?.("");

      // TODO: Fetch data for custom date range
      console.log("Custom date range applied:", startStr, endStr);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isDateInRange = (date: Date) => {
    if (!calendarStartDate) return false;
    if (!calendarEndDate) return date.getTime() === calendarStartDate.getTime();
    return date >= calendarStartDate && date <= calendarEndDate;
  };

  const isDateSelected = (date: Date) => {
    if (!calendarStartDate) return false;
    if (calendarEndDate) {
      return date.getTime() === calendarStartDate.getTime() || date.getTime() === calendarEndDate.getTime();
    }
    return date.getTime() === calendarStartDate.getTime();
  };

  return (
    <div className="w-full bg-white dark:bg-[#1F2937] transition-all duration-500 ease-out">
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
        <div className="flex items-center justify-between gap-4 py-4 sm:py-5 md:py-6 lg:py-8">
        {/* Left: Clickable Avatar + Greeting */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={handleProfile}
            className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-transform hover:scale-105"
          >
            <Avatar className="h-11 w-11 md:h-12 md:w-12 ring-2 ring-gray-200 dark:ring-gray-600 cursor-pointer">
              <AvatarImage src={user?.avatar_url} alt={user?.username} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm md:text-base">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-50 truncate transition-all duration-300 ease-out font-manrope">
              Hey {user?.username}!
            </h1>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 truncate transition-all duration-300 ease-out font-manrope">
              Welcome back! Here's what's happening with your workspace.
            </p>
          </div>
        </div>

        {/* Right: Icon Buttons + Time/Calendar Picker + Create Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          {/* Expandable Search */}
          {searchExpanded ? (
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="h-10 w-48 sm:w-64 px-4 pr-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 focus:border-transparent transition-all font-manrope"
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={handleSearchToggle}
                className="h-9 w-9 sm:h-10 sm:w-10 min-h-[36px] min-w-[36px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSearchToggle}
              className="h-9 w-9 sm:h-10 sm:w-10 min-h-[36px] min-w-[36px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}

          {/* Notifications Icon Button */}
          {!searchExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNotifications}
              className="relative h-9 w-9 sm:h-10 sm:w-10 min-h-[36px] min-w-[36px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {hasUnreadNotifications && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
              )}
            </Button>
          )}

          {/* Unified Time Range + Calendar Picker (Pill-shaped) - Hidden on mobile or when search expanded */}
          {!searchExpanded && (
            <div className="hidden md:flex items-center h-10 bg-gray-100 dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 overflow-hidden">
              {/* Time Range Selector - Shows selected value */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 h-full text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap focus:outline-none focus:ring-0 font-manrope">
                    <span className="font-medium transition-all duration-300 ease-out">{selectedTimeRange}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                  <DropdownMenuItem
                    onClick={() => handleTimeRangeSelect("Last 24 hours")}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-50 font-manrope"
                  >
                    Last 24 hours
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleTimeRangeSelect("Last 7 days")}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-50 font-manrope"
                  >
                    Last 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleTimeRangeSelect("Last 30 days")}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-50 font-manrope"
                  >
                    Last 30 days
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleTimeRangeSelect("Last 90 days")}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-50 font-manrope"
                  >
                    Last 90 days
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Vertical Divider */}
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

              {/* Calendar Date Picker - Shows selected date or icon */}
              <DropdownMenu open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 h-full text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-0">
                    <Calendar className="h-4 w-4" />
                    {selectedDateRange && <span className="font-medium hidden lg:inline transition-opacity duration-200">{selectedDateRange}</span>}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 shadow-xl w-80">
                  {/* Advanced Calendar with Month/Year Navigation */}
                  <div className="space-y-4">
                    {/* Month/Year Header with Navigation */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 font-manrope">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Selected Range Display */}
                    {(calendarStartDate || calendarEndDate) && (
                      <div className="text-sm text-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                        <span className="text-blue-700 dark:text-blue-300 font-medium font-manrope">
                          {calendarStartDate && !calendarEndDate && "Start: "}
                          {calendarStartDate && calendarStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {calendarStartDate && calendarEndDate && " - "}
                          {calendarEndDate && calendarEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}

                    {/* Calendar Grid */}
                    <div className="space-y-2">
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
                          <div key={i} className="text-center font-medium text-gray-500 dark:text-gray-400 p-2 font-manrope">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(currentMonth).map((date, i) => {
                          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                          const isToday = date.toDateString() === new Date().toDateString();
                          const isInRange = isDateInRange(date);
                          const isSelected = isDateSelected(date);

                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => isCurrentMonth && handleDateClick(date)}
                              disabled={!isCurrentMonth}
                              className={cn(
                                "p-2 text-sm text-center rounded-lg transition-all duration-200 hover:scale-105",
                                isCurrentMonth
                                  ? "text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                  : "text-gray-300 dark:text-gray-600 cursor-not-allowed",
                                isToday && "font-bold text-blue-600 dark:text-blue-400",
                                isSelected && "bg-blue-600 text-white hover:bg-blue-700",
                                isInRange && !isSelected && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              )}
                            >
                              {date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          setCalendarStartDate(null);
                          setCalendarEndDate(null);
                          setSelectedDateRange(null);
                        }}
                        className="flex-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors font-manrope"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleApplyCustomRange}
                        disabled={!calendarStartDate || !calendarEndDate}
                        className={cn(
                          "flex-1 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 font-manrope",
                          calendarStartDate && calendarEndDate
                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        )}
                      >
                        Apply Range
                      </button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Create Button (Pill-shaped, Bright) */}
          {!searchExpanded && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 min-h-[40px] px-4 sm:px-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-md hover:shadow-lg rounded-full transition-all duration-200 font-manrope">
                  <Plus className="h-4 w-4 mr-1.5" />
                  <span>Create</span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-xl shadow-lg">
                <DropdownMenuItem
                  onClick={onCreateChatbot || (() => navigate("/chatbots/create"))}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 rounded-lg m-1 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <ChatbotIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50 font-manrope">Chatbot</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Simple form-based bot</div>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onCreateChatflow || (() => navigate("/studio"))}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 rounded-lg m-1 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50 font-manrope">Chatflow</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Visual workflow builder</div>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onCreateKnowledgeBase || (() => navigate("/knowledge-bases/create"))}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 rounded-lg m-1 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Book className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50 font-manrope">Knowledge Base</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Upload documents for RAG</div>
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
