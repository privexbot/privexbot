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
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordField } from "@/components/auth/PasswordField";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";

interface PasswordResetRequest {
  token: string;
  new_password: string;
}

export function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Get token from URL
  const token = searchParams.get("token");

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
      const isValid = await authApi.validateResetToken(token);
      setTokenValid(isValid);

      if (!isValid) {
        setError("This reset link has expired or is invalid. Please request a new one.");
      }
    } catch (err: any) {
      console.error("Token validation failed:", err);
      setError("This reset link has expired or is invalid. Please request a new one.");
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

      const request: PasswordResetRequest = {
        token,
        new_password: password,
      };

      await authApi.resetPassword(token, password);

      setSuccess(true);

      // Redirect to login after success
      setTimeout(() => {
        navigate("/login", {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Validating reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950">
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-md mx-auto text-center space-y-8"
          >
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-green-900 dark:text-green-100">
                Password Reset Successful!
              </h1>
              <p className="text-green-700 dark:text-green-300">
                Your password has been updated. Redirecting to login...
              </p>
            </div>

            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-green-600 dark:text-green-400" />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <Link
            to="/signup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Need an account? <span className="font-medium text-primary">Sign up</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
                <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
              <p className="text-muted-foreground">
                {tokenValid
                  ? "Choose a strong new password for your account."
                  : "There was a problem with your reset link."}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Invalid Token */}
            {tokenValid === false && (
              <div className="space-y-6">
                <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                  <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    Invalid Reset Link
                  </h3>
                  <p className="text-red-700 dark:text-red-300 text-sm mb-4">
                    This password reset link has expired or is invalid. Please request a new one.
                  </p>
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
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

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
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
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Security Tip
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
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
  );
}