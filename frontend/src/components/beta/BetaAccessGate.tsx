/**
 * Beta Access Gate Component
 *
 * WHY: Control access to beta features like KB creation
 * HOW: Check user's beta access status and show invite code form if needed
 *
 * USAGE:
 * <BetaAccessGate>
 *   <CreateKnowledgeBasePage />
 * </BetaAccessGate>
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { betaApi } from "@/api/beta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Construction, KeyRound, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface BetaAccessGateProps {
  children: React.ReactNode;
}

export function BetaAccessGate({ children }: BetaAccessGateProps) {
  const { user } = useAuth();
  const { actualTheme } = useTheme();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if user has beta access
  const hasBetaAccess = user?.is_staff ?? user?.has_beta_access;

  // If user has access, render children
  if (hasBetaAccess || success) {
    return <>{children}</>;
  }

  const handleRedeem = async () => {
    if (!code.trim()) {
      setError("Please enter an invite code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await betaApi.redeemCode(code.trim().toUpperCase());

      if (response.success) {
        setSuccess(true);
        // Page will re-render and show children
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail ?? "Failed to redeem code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleRedeem();
    }
  };

  // Background style matching Hero/Signin pages
  const getBackgroundStyle = () => {
    if (actualTheme === "dark") {
      return {
        backgroundImage: `
          radial-gradient(50% 50% at 50% 30%, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.12) 30%, hsl(var(--primary) / 0.05) 50%, hsl(var(--background)) 80%),
          radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.12) 2px, transparent 2px),
          linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px, 0 0, 0 0",
      };
    } else {
      return {
        backgroundImage: `
          radial-gradient(50% 50% at 50% 30%, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary) / 0.06) 30%, hsl(var(--primary) / 0.02) 50%, hsl(var(--background)) 80%),
          radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.06) 2px, transparent 2px),
          linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px, 0 0, 0 0",
      };
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={getBackgroundStyle()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border border-gray-200 dark:border-gray-700 shadow-xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-2">
            {/* Icon without colored background - consistent with ValuePropositions */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mx-auto w-16 h-16 bg-black dark:bg-white rounded-full flex items-center justify-center"
            >
              <Construction className="h-8 w-8 text-white dark:text-black" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="space-y-2"
            >
              <CardTitle className="text-2xl font-manrope font-semibold text-gray-900 dark:text-white">
                Early Access Program
              </CardTitle>
              <CardDescription className="text-base font-manrope text-gray-600 dark:text-gray-400">
                PrivexBot is currently in active development
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Beta Warning - Clean styling without colored background */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-300 font-manrope leading-relaxed">
                  As an early tester, you may encounter bugs or incomplete features.
                  We're working hard to make it production-ready!
                </p>
              </div>
            </motion.div>

            {/* Invite Code Form */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-manrope">
                <KeyRound className="h-4 w-4" />
                <span>Enter your invite code to continue</span>
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder="PRIV-XXXX"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="font-mono text-center tracking-wider text-lg py-5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20"
                  maxLength={20}
                />
                <Button
                  onClick={() => { void handleRedeem(); }}
                  disabled={isLoading || !code.trim()}
                  className="font-manrope px-6 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Redeem"
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-300 font-manrope">{error}</p>
                </motion.div>
              )}

              {/* Success Message - shown briefly before redirect */}
              {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-2 p-3 rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20"
                >
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-600 dark:text-green-300 font-manrope">
                    Access granted! Redirecting...
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="pt-4 border-t border-gray-200 dark:border-gray-700 text-center"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                Need an invite code?{" "}
                <a
                  href="mailto:privexbot@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Contact the PrivexBot team
                </a>
              </p>
            </motion.div>
          </CardContent>
        </Card>

        {/* Subtle branding below card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-6 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <Sparkles className="h-4 w-4" />
            <span className="font-manrope">Powered by PrivexLabs</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default BetaAccessGate;
