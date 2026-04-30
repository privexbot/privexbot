/**
 * Enhanced Signup Page
 *
 * Modern, responsive signup interface with:
 * - Email/password registration with strength validation
 * - Comprehensive wallet integration
 * - Enhanced mobile experience
 * - Proper validation and error handling
 * - Success states and onboarding guidance
 */

import { useState, FormEvent, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2,
  Smartphone,
  KeyRound,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import { WalletButton } from "@/components/auth/WalletButton";
import { PasswordField } from "@/components/auth/PasswordField";
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

export function NewSignupPage() {
  const navigate = useNavigate();
  const { emailSignup, walletLogin, isLoading, error, clearError } = useAuth();
  // Optional referral code from `/signin?ref=<code>`. Captured once and
  // forwarded with the signup payload; the backend writes a Referral row.
  const [searchParams] = useSearchParams();
  const referralCode = useMemo(() => {
    const raw = searchParams.get("ref");
    return raw ? raw.trim() : "";
  }, [searchParams]);

  // Form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("email");
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Wallet state
  const [walletDetection, setWalletDetection] = useState(detectWallets());
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  useEffect(() => {
    // Re-detect wallets when component mounts
    setWalletDetection(detectWallets());
  }, []);

  const displayError = error || localError;

  /**
   * Validate form fields
   */
  const validateForm = () => {
    if (!username.trim()) {
      setLocalError("Username is required");
      return false;
    }

    if (username.trim().length < 3) {
      setLocalError("Username must be at least 3 characters long");
      return false;
    }

    if (!email.trim()) {
      setLocalError("Email is required");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError("Please enter a valid email address");
      return false;
    }

    if (!password) {
      setLocalError("Password is required");
      return false;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long");
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return false;
    }

    if (!acceptTerms) {
      setLocalError("You must accept the Terms of Service and Privacy Policy");
      return false;
    }

    return true;
  };

  /**
   * Handle email/password signup
   */
  const handleEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!validateForm()) return;

    try {
      await emailSignup({
        username: username.trim(),
        email: email.trim(),
        password,
        ...(referralCode ? { referral_code: referralCode } : {}),
      });

      setSignupSuccess(true);

      // Redirect after showing success message
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
    } catch (err: any) {
      console.error("Signup failed:", err);
      // Error is handled by AuthContext
    }
  };

  /**
   * Handle wallet authentication
   */
  const handleWalletSignup = async (walletId: string) => {
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

      // Verify signature with backend (creates account if new)
      const verifyData: any = {
        address,
        signed_message: challenge.message,
        signature,
      };

      if (wallet.provider === "cosmos" && publicKey) {
        verifyData.public_key = publicKey;
      }

      await walletLogin(wallet.provider, verifyData);

      setSignupSuccess(true);

      // Redirect after showing success message
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
    } catch (err: any) {
      console.error("Wallet signup failed:", err);

      // Enhanced error messages
      if (err.message.includes("not detected")) {
        setLocalError(`${wallet.name} is not installed. Click the wallet button to install it.`);
      } else if (err.message.includes("rejected")) {
        setLocalError("Connection was cancelled. Please try again.");
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
   * Open mobile wallet deep link
   */
  const handleMobileWallet = (walletId: string) => {
    const deepLink = getMobileWalletDeepLink(walletId);
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  const isMobile = isMobileDevice();

  if (signupSuccess) {
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
                Welcome to PrivexBot!
              </h1>
              <p className="text-green-700 dark:text-green-300">
                Your account has been created successfully. Redirecting to your dashboard...
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950 dark:via-pink-950 dark:to-rose-950">
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
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? <span className="font-medium text-primary">Sign in</span>
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
              <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
              <p className="text-muted-foreground">
                Join PrivexBot and start building privacy-first AI chatbots with complete data sovereignty.
              </p>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs text-muted-foreground">Private by Design</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs text-muted-foreground">Quick Setup</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs text-muted-foreground">AI Powered</p>
              </div>
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

              {/* Email Signup */}
              <TabsContent value="email" className="space-y-6 mt-6">
                <form onSubmit={handleEmailSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="alice_wonderland"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                      maxLength={50}
                      disabled={isLoading}
                      className="h-11"
                      pattern="^[a-zA-Z0-9_-]+$"
                      title="Username can only contain letters, numbers, underscores, and hyphens"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only letters, numbers, underscore, and hyphens allowed
                    </p>
                  </div>

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

                  <PasswordField
                    id="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a strong password"
                    showStrength={true}
                    disabled={isLoading}
                    required
                    className="space-y-3"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className={cn(
                        "h-11",
                        confirmPassword && password === confirmPassword
                          ? "border-green-500 focus-visible:ring-green-500"
                          : confirmPassword && password !== confirmPassword
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      )}
                    />
                    {confirmPassword && password === confirmPassword && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Passwords match</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="terms" className="text-sm leading-5">
                      I agree to the{" "}
                      <Link to="/privacy" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isLoading || !acceptTerms}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Wallet Signup */}
              <TabsContent value="wallet" className="space-y-6 mt-6">
                {/* Terms acceptance for wallet signup */}
                <div className="flex items-start space-x-2 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="wallet-terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="wallet-terms" className="text-sm leading-5">
                    I agree to the{" "}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>

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
                          onClick={() => acceptTerms && handleWalletSignup(wallet.id)}
                          isLoading={connectingWallet === wallet.id}
                          className={cn(
                            connectingWallet === wallet.id && "opacity-75",
                            !acceptTerms && "opacity-50 cursor-not-allowed"
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
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Your Wallet, Your Data
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        PrivexBot connects directly to your wallet. We never store your private keys or have access to your funds.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}