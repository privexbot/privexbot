/**
 * Enhanced Login Page
 *
 * Modern, responsive login interface with:
 * - Email/password authentication
 * - Comprehensive wallet integration with detection
 * - Forgot password functionality
 * - Enhanced mobile experience
 * - Proper validation and error handling
 */

import { useState, FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Smartphone,
  Download,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { WalletButton } from "@/components/auth/WalletButton";
import {
  detectWallets,
  connectEVMWallet,
  connectSolanaWallet,
  connectCosmosWallet,
  signEVMMessage,
  signSolanaMessage,
  signCosmosMessage,
  isMobileDevice,
  getMobileWalletDeepLink,
  WALLET_CONFIGS,
} from "@/lib/wallet-utils";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function NewLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { emailLogin, walletLogin, isLoading, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("email");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Wallet state
  const [walletDetection, setWalletDetection] = useState(detectWallets());
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  // Check for redirect reason
  const redirectReason = searchParams.get("reason");

  useEffect(() => {
    // Re-detect wallets when component mounts
    setWalletDetection(detectWallets());

    // Handle redirect messages
    if (redirectReason === "session_expired") {
      setLocalError("Your session has expired. Please log in again.");
    } else if (redirectReason === "unauthorized") {
      setLocalError("Please log in to access that page.");
    }
  }, [redirectReason]);

  const displayError = error || localError;

  /**
   * Handle email/password login
   */
  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    // Client-side validation
    if (!email.trim()) {
      setLocalError("Email is required");
      return;
    }

    if (!password.trim()) {
      setLocalError("Password is required");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    try {
      await emailLogin({ email: email.trim(), password });
      navigate("/dashboard");
    } catch (err: any) {
      // Error is handled by AuthContext, but we can add specific handling here
      console.error("Login failed:", err);
    }
  };

  /**
   * Handle wallet authentication
   */
  const handleWalletConnect = async (walletId: string) => {
    const wallet = WALLET_CONFIGS[walletId];
    if (!wallet) return;

    clearError();
    setLocalError(null);
    setConnectingWallet(walletId);

    try {
      let address: string;
      let provider: any;
      let publicKey: string | undefined;

      // Connect to wallet based on provider type
      if (wallet.provider === "evm") {
        const connection = await connectEVMWallet(walletId);
        address = connection.address;
        provider = connection.provider;
      } else if (wallet.provider === "solana") {
        const connection = await connectSolanaWallet(walletId);
        address = connection.address;
        provider = connection.provider;
      } else if (wallet.provider === "cosmos") {
        const connection = await connectCosmosWallet(walletId);
        address = connection.address;
        provider = connection.provider;
        publicKey = connection.publicKey;
      } else {
        throw new Error("Unsupported wallet provider");
      }

      // Request challenge from backend
      const challenge = await authApi.requestWalletChallenge(wallet.provider, { address });

      // Sign challenge message
      let signature: string;
      if (wallet.provider === "evm") {
        signature = await signEVMMessage(provider, address, challenge.message);
      } else if (wallet.provider === "solana") {
        signature = await signSolanaMessage(provider, challenge.message);
      } else if (wallet.provider === "cosmos") {
        const signed = await signCosmosMessage(provider, "secret-4", address, challenge.message);
        signature = signed.signature;
        publicKey = signed.publicKey;
      } else {
        throw new Error("Unsupported wallet provider");
      }

      // Verify signature with backend
      const verifyData: any = {
        address,
        signed_message: challenge.message,
        signature,
      };

      if (wallet.provider === "cosmos" && publicKey) {
        verifyData.public_key = publicKey;
      }

      await walletLogin(wallet.provider, verifyData);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Wallet connection failed:", err);

      // Enhanced error messages
      if (err.message.includes("not detected")) {
        setLocalError(`${wallet.name} is not installed. Click the wallet button to install it.`);
      } else if (err.message.includes("rejected")) {
        setLocalError("Connection was cancelled. Please try again.");
      } else if (err.message.includes("not found") || err.message.includes("not registered")) {
        setLocalError(`This wallet is not registered. Please sign up first with your ${wallet.name} wallet.`);
      } else if (err.code === 'ERR_NETWORK') {
        setLocalError("Cannot connect to server. Please check your internet connection and try again.");
      } else {
        setLocalError(err.message || "Wallet connection failed. Please try again.");
      }
    } finally {
      setConnectingWallet(null);
    }
  };

  /**
   * Handle forgot password
   */
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setLocalError(null);

    if (!forgotEmail.trim()) {
      setLocalError("Email is required");
      setForgotPasswordLoading(false);
      return;
    }

    try {
      await authApi.requestPasswordReset(forgotEmail.trim());
      setForgotPasswordSent(true);
    } catch (err: any) {
      console.error("Password reset request failed:", err);

      if (err.response?.status === 404) {
        setLocalError("No account found with this email address.");
      } else if (err.response?.status === 429) {
        setLocalError("Too many reset requests. Please wait before trying again.");
      } else if (err.response?.data?.detail) {
        setLocalError(err.response.data.detail);
      } else {
        setLocalError("Failed to send reset email. Please try again.");
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  /**
   * Open mobile wallet deep link
   */
  const handleMobileWallet = (walletId: string) => {
    const deepLink = getMobileWalletDeepLink(walletId);
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  const isMobile = isMobileDevice();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <Link
            to="/signup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            New user? <span className="font-medium text-primary">Sign up</span>
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
              <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-muted-foreground">
                Sign in to your PrivexBot account to continue building privacy-first AI chatbots.
              </p>
            </div>

            {/* Error Alert */}
            <AnimatePresence>
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{displayError}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auth Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Wallet
                </TabsTrigger>
              </TabsList>

              {/* Email Login */}
              <TabsContent value="email" className="space-y-6 mt-6">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-xs">
                            Forgot password?
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Reset your password</DialogTitle>
                            <DialogDescription>
                              Enter your email address and we'll send you a link to reset your password.
                            </DialogDescription>
                          </DialogHeader>

                          {forgotPasswordSent ? (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <div>
                                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                    Reset link sent!
                                  </p>
                                  <p className="text-xs text-green-700 dark:text-green-300">
                                    Check your email for further instructions.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="forgot-email">Email address</Label>
                                <Input
                                  id="forgot-email"
                                  type="email"
                                  placeholder="you@example.com"
                                  value={forgotEmail}
                                  onChange={(e) => setForgotEmail(e.target.value)}
                                  required
                                />
                              </div>

                              <Button
                                type="submit"
                                className="w-full"
                                disabled={forgotPasswordLoading}
                              >
                                {forgotPasswordLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  "Send reset link"
                                )}
                              </Button>
                            </form>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Sign in with Email
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Wallet Login */}
              <TabsContent value="wallet" className="space-y-6 mt-6">
                {/* Installed Wallets */}
                {walletDetection.installed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">Connected Wallets</h3>
                      <Badge variant="secondary" className="text-xs">
                        {walletDetection.installed.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {walletDetection.installed.map((wallet) => (
                        <WalletButton
                          key={wallet.id}
                          wallet={wallet}
                          onClick={() => handleWalletConnect(wallet.id)}
                          isLoading={connectingWallet === wallet.id}
                          className={cn(
                            connectingWallet === wallet.id && "opacity-75"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Not Installed Wallets */}
                {walletDetection.notInstalled.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">Install a Wallet</h3>
                      {isMobile && (
                        <Badge variant="outline" className="text-xs">
                          <Smartphone className="h-3 w-3 mr-1" />
                          Mobile
                        </Badge>
                      )}
                    </div>

                    {/* Recommended wallets first */}
                    {walletDetection.recommended.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Recommended</p>
                        {walletDetection.recommended.map((wallet) => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => {
                              if (isMobile) {
                                handleMobileWallet(wallet.id);
                              } else {
                                window.open(wallet.installUrl, "_blank");
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Other wallets */}
                    <div className="space-y-2">
                      {walletDetection.notInstalled
                        .filter(wallet => !wallet.isDefault)
                        .map((wallet) => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => {
                              if (isMobile) {
                                handleMobileWallet(wallet.id);
                              } else {
                                window.open(wallet.installUrl, "_blank");
                              }
                            }}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Mobile Help */}
                {isMobile && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex gap-3">
                      <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Mobile Wallet Tips
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Tap a wallet to install it or open your existing wallet app to connect.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Security Notice */}
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Security Reminder
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Only connect wallets you trust. PrivexBot will never ask for your private keys or seed phrases.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                By signing in, you agree to our{" "}
                <Link to="/privacy" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}