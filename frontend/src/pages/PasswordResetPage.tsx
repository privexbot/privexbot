/**
 * Password Reset Page
 *
 * Handles password reset flow from email links with:
 * - Token validation
 * - New password setup with strength validation
 * - Success/error handling
 * - Automatic redirect to login
 */

import { useState, FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordField } from "@/components/auth/PasswordField";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";

export function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { actualTheme } = useTheme();

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Get token from URL
  const token = searchParams.get("token");

  // Grid pattern background for consistency with signin page
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

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      setTokenValid(false);
      return;
    }

    // Validate token
    validateResetToken();
  }, [token]);

  /**
   * Validate the reset token
   */
  const validateResetToken = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const result = await authApi.validateResetToken(token);
      setTokenValid(result.valid);

      if (!result.valid) {
        setError(result.error || "This reset link has expired or is invalid. Please request a new one.");
      }
    } catch (err: any) {
      console.error("Token validation failed:", err);
      setError("Unable to validate reset link. Please try again.");
      setTokenValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Validate form
   */
  const validateForm = () => {
    if (!password) {
      setError("Password is required");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  /**
   * Handle password reset
   */
  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    if (!validateForm()) return;

    try {
      setIsLoading(true);

      await authApi.resetPassword(token, password);

      setSuccess(true);

      // Redirect to signin after success
      setTimeout(() => {
        navigate("/signin", {
          replace: true,
          state: {
            message: "Password reset successfully. Please log in with your new password.",
          },
        });
      }, 3000);
    } catch (err: any) {
      console.error("Password reset failed:", err);

      if (err.response?.status === 400) {
        setError("Invalid or expired reset token. Please request a new password reset.");
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to reset password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (tokenValid === null && !error) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={getBackgroundStyle()}
      >
        {/* Header with Logo */}
        <div className="w-full px-4 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/logo-green.png"
                alt="Privexbot"
                className="w-10 h-10 object-contain"
              />
              <span className="text-xl font-bold font-manrope text-blue-600">Privexbot</span>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-md">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
                    Validating Reset Link
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope">Please wait while we verify your password reset link...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={getBackgroundStyle()}
      >
        {/* Header with Logo */}
        <div className="w-full px-4 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/logo-green.png"
                alt="Privexbot"
                className="w-10 h-10 object-contain"
              />
              <span className="text-xl font-bold font-manrope text-blue-600">Privexbot</span>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-md">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-6"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>

                <div className="space-y-4">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                    Password Reset Successful!
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope">
                    Your password has been updated. Redirecting to login...
                  </p>
                </div>

                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={getBackgroundStyle()}
    >
      {/* Header with Logo */}
      <div className="w-full px-4 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo-green.png"
              alt="Privexbot"
              className="w-10 h-10 object-contain"
            />
            <span className="text-xl font-bold font-manrope text-blue-600">Privexbot</span>
          </Link>

          <Link
            to="/signin"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-manrope"
          >
            Back to <span className="font-medium text-blue-600">Sign in</span>
          </Link>
        </div>
      </div>

      {/* Main Content - Centered Layout with Grid Background */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto">
                  <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope mb-2">Reset your password</h1>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-sm">
                    {tokenValid
                      ? "Choose a strong new password for your account."
                      : "There was a problem with your reset link."}
                  </p>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              {/* Invalid Token */}
              {tokenValid === false && (
                <div className="space-y-6">
                  <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-center">
                    <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 font-manrope mb-2">
                      Invalid Reset Link
                    </h3>
                    <p className="text-red-700 dark:text-red-300 text-sm font-manrope mb-4">
                      This password reset link has expired or is invalid. Please request a new one.
                    </p>
                    <Link to="/signin">
                      <Button variant="outline" className="w-full h-12 font-manrope bg-white dark:bg-gray-800/70 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:border-red-400 dark:hover:border-red-600 active:bg-red-100 dark:active:bg-red-950/70 transition-all duration-200">
                        Request New Reset
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Valid Token - Reset Form */}
              {tokenValid === true && (
                <form onSubmit={handlePasswordReset} className="space-y-6">
                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a strong password"
                    showStrength={true}
                    disabled={isLoading}
                    required
                  />

                  <PasswordField
                    id="confirm-new-password"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Confirm your new password"
                    disabled={isLoading}
                    required
                    error={
                      confirmPassword && password !== confirmPassword
                        ? "Passwords do not match"
                        : undefined
                    }
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:bg-blue-800 dark:active:bg-blue-700 text-white rounded-lg font-manrope font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Reset Password
                      </>
                    )}
                  </Button>

                  {/* Security Notice */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex gap-3">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 font-manrope">
                          Security Tip
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope">
                          Use a unique password that you don't use anywhere else. Consider using a password manager.
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}