/**
 * Signin Page
 *
 * Implements the exact dual-column layout specified in the design document:
 * - Left column: Social Login section with primary wallets
 * - Right column: Progressive disclosure (Email form / Wallet search / Installation)
 * - Matches design system: Manrope font, specific colors, rounded corners
 * - Mobile responsive with horizontal scrolling wallets
 * - Grid pattern background for consistency
 */

import { useState, FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Search,
  Download,
  ExternalLink,
  AtSign,
  Wallet,
} from "lucide-react";
import {
  getPrimaryWallets,
  getAllWalletsForSearch,
  connectEVMWallet,
  connectSolanaWallet,
  connectCosmosWallet,
  signEVMMessage,
  signSolanaMessage,
  signCosmosMessage,
  getWalletProvider,
  WALLET_CONFIGS,
  WalletInfo,
} from "@/lib/wallet-utils";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Right column content types
type RightColumnContent = 'email-form' | 'wallet-search' | 'wallet-install' | 'wallet-connecting' | null;

interface SelectedWallet {
  wallet: WalletInfo;
  isInstalled: boolean;
}

export function SigninPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { emailLogin, walletLogin, isLoading, error, clearError } = useAuth();
  const { actualTheme } = useTheme();

  // Grid pattern background for consistency with landing page
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

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Progressive disclosure state - Start with null, show email-form only when Social Login is clicked
  const [rightColumnContent, setRightColumnContent] = useState<RightColumnContent>(null);
  const [selectedWallet, setSelectedWallet] = useState<SelectedWallet | null>(null);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  // Wallet search state
  const [walletSearchTerm, setWalletSearchTerm] = useState("");
  const [allWallets, setAllWallets] = useState<WalletInfo[]>([]);
  const [primaryWallets, setPrimaryWallets] = useState<WalletInfo[]>([]);

  // Forgot password state
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [resetResponse, setResetResponse] = useState<{
    message: string;
    email_sent: boolean;
    reset_link?: string;
  } | null>(null);

  // Email verification signup state
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [username, setUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  // Check for redirect reason
  const redirectReason = searchParams.get("reason");

  useEffect(() => {
    // Initialize wallet data
    const primary = getPrimaryWallets();
    const all = getAllWalletsForSearch();

    // Update detection status for each wallet
    const updateWalletDetection = (wallets: WalletInfo[]) => {
      return wallets.map(wallet => ({
        ...wallet,
        detected: !!getWalletProvider(wallet.id),
      }));
    };

    setPrimaryWallets(updateWalletDetection(primary));
    setAllWallets(updateWalletDetection(all));

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

    try {
      // Use enhanced login to detect new users
      const result = await authApi.enhancedEmailLogin({
        email: email.trim(),
        password
      });

      if (result.status === "success" && result.token) {
        // Successful login - handle token and navigate
        const { access_token, expires_in } = result.token;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("token_expires_at", (Date.now() + expires_in * 1000).toString());

        // Trigger auth context refresh
        await emailLogin({ email: email.trim(), password });
        navigate("/dashboard");

      } else if (result.status === "invalid_credentials") {
        // Wrong password for existing user
        setLocalError("Invalid credentials");

      } else if (result.status === "email_not_found") {
        // New user - trigger signup flow
        setNewUserEmail(result.email || email.trim());
        setNewUserPassword(password);
        setShowSignupPrompt(true);
      }
    } catch (err: any) {
      console.error("Login failed:", err);

      // Handle API errors
      if (err.response?.data?.detail) {
        setLocalError(err.response.data.detail);
      } else {
        setLocalError("Login failed. Please try again.");
      }
    }
  };

  /**
   * Handle signup confirmation - send verification code
   */
  const handleSignupConfirmation = async () => {
    if (!username.trim()) {
      setLocalError("Username is required");
      return;
    }

    setVerificationLoading(true);
    setLocalError(null);

    try {
      const result = await authApi.sendEmailVerification({
        email: newUserEmail,
        password: newUserPassword,
        username: username.trim()
      });

      setVerificationSent(true);
      setShowSignupPrompt(false);

      if (!result.code_sent) {
        // Email failed but verification code was created
        setLocalError("Verification code generated but email delivery failed. Check console for code.");
      }
    } catch (err: any) {
      console.error("Verification code sending failed:", err);

      if (err.response?.status === 409) {
        setLocalError("Email already registered. Please log in instead.");
        setShowSignupPrompt(false);
      } else if (err.response?.status === 400 && err.response?.data?.detail?.includes("Username already taken")) {
        setLocalError("Username already taken. Please choose a different username.");
      } else if (err.response?.data?.detail) {
        setLocalError(err.response.data.detail);
      } else {
        setLocalError("Failed to send verification code. Please try again.");
      }
    } finally {
      setVerificationLoading(false);
    }
  };

  /**
   * Handle email verification and complete signup
   */
  const handleEmailVerification = async (e: FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    setLocalError(null);

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setLocalError("Please enter the 6-digit verification code");
      setSignupLoading(false);
      return;
    }

    try {
      const tokenData = await authApi.verifyEmailAndSignup({
        email: newUserEmail,
        code: verificationCode.trim()
      });

      // Store token and trigger auth context refresh
      const { access_token, expires_in } = tokenData;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("token_expires_at", (Date.now() + expires_in * 1000).toString());

      // Trigger auth context refresh and navigate
      await emailLogin({ email: newUserEmail, password: newUserPassword });
      navigate("/dashboard");

    } catch (err: any) {
      console.error("Email verification failed:", err);

      if (err.response?.status === 400) {
        setLocalError("Invalid or expired verification code");
      } else if (err.response?.status === 409) {
        setLocalError("Email already registered. Please log in instead.");
      } else if (err.response?.data?.detail) {
        setLocalError(err.response.data.detail);
      } else {
        setLocalError("Verification failed. Please try again.");
      }
    } finally {
      setSignupLoading(false);
    }
  };

  /**
   * Reset signup flow
   */
  const resetSignupFlow = () => {
    setShowSignupPrompt(false);
    setVerificationSent(false);
    setUsername("");
    setVerificationCode("");
    setNewUserEmail("");
    setNewUserPassword("");
    setLocalError(null);
  };

  /**
   * Handle wallet connection
   */
  const handleWalletConnect = async (wallet: WalletInfo) => {
    clearError();
    setLocalError(null);
    setConnectingWallet(wallet.id);
    setSelectedWallet({ wallet, isInstalled: wallet.detected });

    // Check if wallet is installed
    if (!wallet.detected) {
      setRightColumnContent('wallet-install');
      setConnectingWallet(null);
      return;
    }

    // Show connecting state in right column
    setRightColumnContent('wallet-connecting');

    try {
      let address: string;
      let provider: any;
      let publicKey: string | undefined;

      // Connect to wallet based on provider type
      if (wallet.provider === "evm") {
        const connection = await connectEVMWallet(wallet.id);
        address = connection.address;
        provider = connection.provider;
      } else if (wallet.provider === "solana") {
        const connection = await connectSolanaWallet(wallet.id);
        address = connection.address;
        provider = connection.provider;
      } else if (wallet.provider === "cosmos") {
        const connection = await connectCosmosWallet(wallet.id);
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

      // Log more details for debugging
      if (err.response?.data) {
        console.error('Backend error details:', err.response.data);
      }

      // Clear connecting state and show error
      setRightColumnContent(null);

      if (err.message.includes("not detected")) {
        setLocalError(`${wallet.name} is not installed. Please install it first.`);
      } else if (err.message.includes("rejected")) {
        setLocalError("Connection was cancelled. Please try again.");
      } else if (err.message.includes("not found") || err.message.includes("not registered")) {
        setLocalError(`This wallet is not registered. Please sign up first.`);
      } else if (err.code === 'ERR_NETWORK') {
        setLocalError("Cannot connect to server. Please check your internet connection.");
      } else {
        setLocalError(err.message || "Wallet connection failed. Please try again.");
      }
    } finally {
      setConnectingWallet(null);
      // Clear selected wallet on error
      if (rightColumnContent === 'wallet-connecting') {
        setRightColumnContent(null);
      }
    }
  };

  /**
   * Handle "All Wallets" click to show search interface
   */
  const handleAllWalletsClick = () => {
    setRightColumnContent('wallet-search');
    setWalletSearchTerm("");
  };

  /**
   * Handle wallet selection from search
   */
  const handleWalletSearchSelect = (wallet: WalletInfo) => {
    handleWalletConnect(wallet);
  };

  /**
   * Handle back navigation
   */
  const handleBackToEmailForm = () => {
    setRightColumnContent('email-form');
    setSelectedWallet(null);
    setWalletSearchTerm("");
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
      const response = await authApi.requestPasswordReset(forgotEmail.trim());
      setResetResponse(response);
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

  // Filter wallets based on search term
  const filteredWallets = allWallets.filter(wallet =>
    wallet.name.toLowerCase().includes(walletSearchTerm.toLowerCase())
  );

  const walletCount = allWallets.length;

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
            to="/signup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-manrope"
          >
            New user? <span className="font-medium text-blue-600">Sign up</span>
          </Link>
        </div>
      </div>

      {/* Main Content - Centered Layout with Grid Background */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-5xl">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 lg:p-12 shadow-xl border border-white/20">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 lg:divide-x lg:divide-border">

              {/* Left Column - Wallet & Social Authentication */}
              <div className="space-y-6">

              {/* Mobile: Horizontal scrolling wallet options */}
              <div className="lg:hidden">
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-8 px-8 scrollbar-hide">
                  {/* Social Login Button */}
                  <motion.button
                    onClick={() => setRightColumnContent('email-form')}
                    className={cn(
                      "flex-shrink-0 w-16 h-16 rounded-xl transition-all duration-200",
                      rightColumnContent === 'email-form'
                        ? "bg-blue-100 ring-2 ring-blue-500"
                        : "bg-gray-100 hover:bg-gray-200"
                    )}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <AtSign className="w-6 h-6 text-blue-600" />
                    </div>
                  </motion.button>

                  {/* Primary Wallets */}
                  {primaryWallets.map((wallet) => (
                    <motion.button
                      key={wallet.id}
                      onClick={() => handleWalletConnect(wallet)}
                      disabled={connectingWallet === wallet.id || isLoading}
                      className={cn(
                        "flex-shrink-0 w-16 h-16 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all duration-200 p-2",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        selectedWallet?.wallet.id === wallet.id && "ring-2 ring-orange-500"
                      )}
                    >
                      {wallet.iconPath ? (
                        <img
                          src={wallet.iconPath}
                          alt={wallet.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl">{wallet.icon}</span>
                      )}
                    </motion.button>
                  ))}

                  {/* All Wallets Button */}
                  <motion.button
                    onClick={handleAllWalletsClick}
                    className={cn(
                      "flex-shrink-0 w-16 h-16 rounded-xl bg-blue-100 hover:bg-blue-200 transition-all duration-200",
                      rightColumnContent === 'wallet-search' && "ring-2 ring-blue-500"
                    )}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Desktop: Vertical wallet options */}
              <div className="hidden lg:block space-y-4">
                {/* Social Login Section Header - Clickable */}
                <motion.button
                  onClick={() => setRightColumnContent('email-form')}
                  className={cn(
                    "w-full rounded-lg p-4 transition-all duration-200",
                    rightColumnContent === 'email-form'
                      ? "bg-blue-50"
                      : "bg-gray-100 hover:bg-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <AtSign className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-semibold font-manrope text-gray-900 text-left">
                      Social Login
                    </h2>
                  </div>
                </motion.button>

              {/* Primary Wallet Options */}
              <div className="space-y-3">
                {primaryWallets.map((wallet) => (
                  <motion.button
                    key={wallet.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleWalletConnect(wallet)}
                    disabled={connectingWallet === wallet.id || isLoading}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200",
                      "hover:border-gray-300 hover:bg-gray-50 transition-all duration-200",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      connectingWallet === wallet.id && "opacity-75 cursor-not-allowed",
                      selectedWallet?.wallet.id === wallet.id && "bg-orange-50 border-orange-200"
                    )}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                      {wallet.iconPath ? (
                        <img
                          src={wallet.iconPath}
                          alt={wallet.name}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-2xl">{wallet.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium font-manrope text-gray-900">{wallet.name}</p>
                      {wallet.detected && (
                        <p className="text-xs text-green-600 font-manrope">Detected</p>
                      )}
                    </div>
                    {connectingWallet === wallet.id && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </motion.button>
                ))}

                {/* All Wallets Button */}
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  onClick={handleAllWalletsClick}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200",
                    "hover:border-blue-300 hover:bg-blue-50 transition-all duration-200",
                    rightColumnContent === 'wallet-search' && "bg-blue-50 border-blue-200"
                  )}
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium font-manrope text-gray-900">All Wallets</p>
                    <p className="text-xs text-gray-600 font-manrope">{walletCount} supported</p>
                  </div>
                </motion.button>
              </div>
            </div>
          </div>

            {/* Mobile: Horizontal separator */}
            <div className="lg:hidden border-t border-border my-6"></div>

            {/* Right Column - Progressive Disclosure Content */}
              <div className="space-y-6 lg:pl-8">
                {/* Error Alert - Shows for wallet connection errors when no specific content is shown */}
                {displayError && rightColumnContent === null && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{displayError}</AlertDescription>
                  </Alert>
                )}
                <AnimatePresence mode="wait">
                  {/* Default Empty State */}
                  {rightColumnContent === null && !displayError && (
                    <motion.div
                      key="empty-state"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center h-96"
                    >
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-manrope">
                        Select a login method to continue
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Email Login Form - Hidden when signup prompt or verification is shown */}
                {rightColumnContent === 'email-form' && !showSignupPrompt && !verificationSent && (
                  <motion.div
                    key="email-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Error Alert */}
                    {displayError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{displayError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="font-manrope">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter Email Address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          autoComplete="email"
                          className="h-12 bg-gray-100 border-0 rounded-lg font-manrope"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="font-manrope">Password</Label>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="link" className="h-auto p-0 text-xs font-manrope text-blue-600">
                                Forgot Password?
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="font-manrope">Reset your password</DialogTitle>
                                <DialogDescription className="font-manrope">
                                  Enter your email address and we'll send you a link to reset your password.
                                </DialogDescription>
                              </DialogHeader>

                              {forgotPasswordSent && resetResponse ? (
                                <div className="space-y-4">
                                  {resetResponse.email_sent ? (
                                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                      <div>
                                        <p className="text-sm font-medium text-green-900 font-manrope">
                                          Reset link sent!
                                        </p>
                                        <p className="text-xs text-green-700 font-manrope">
                                          Check your email for further instructions.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="text-blue-600 mt-0.5">ℹ️</div>
                                        <div>
                                          <p className="text-sm font-medium text-blue-900 font-manrope">
                                            Reset link sent
                                          </p>
                                          <p className="text-xs text-blue-700 font-manrope">
                                            If this email address is registered with us, you will receive a password reset link shortly.
                                          </p>
                                        </div>
                                      </div>
                                      {resetResponse.reset_link && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                          <p className="text-xs text-amber-700 font-medium font-manrope mb-2">
                                            Development Mode: Direct reset link (email not delivered)
                                          </p>
                                          <a
                                            href={resetResponse.reset_link}
                                            className="text-xs text-amber-600 hover:text-amber-800 underline break-all font-mono"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            {resetResponse.reset_link}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <form onSubmit={handleForgotPassword} className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="forgot-email" className="font-manrope">Email address</Label>
                                    <Input
                                      id="forgot-email"
                                      type="email"
                                      placeholder="you@example.com"
                                      value={forgotEmail}
                                      onChange={(e) => setForgotEmail(e.target.value)}
                                      required
                                      className="font-manrope"
                                    />
                                  </div>

                                  <Button
                                    type="submit"
                                    className="w-full font-manrope"
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
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            disabled={isLoading}
                            autoComplete="current-password"
                            className="h-12 bg-gray-100 border-0 rounded-lg pr-12 font-manrope"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-manrope font-medium"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Login"
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}

                {/* Create New Account Form - Replaces email form when shown */}
                {showSignupPrompt && rightColumnContent === 'email-form' && !verificationSent && (
                  <motion.div
                    key="create-account-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Error Alert */}
                    {displayError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{displayError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 font-manrope">
                          Create New Account
                        </h3>
                        <p className="text-sm text-gray-600 font-manrope">
                          This email is not registered. Create an account to continue.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="font-manrope">Email Address</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Enter email address"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          required
                          disabled={verificationLoading}
                          autoComplete="email"
                          className="h-12 bg-gray-100 border-0 rounded-lg font-manrope"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="font-manrope">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            required
                            minLength={8}
                            disabled={verificationLoading}
                            autoComplete="new-password"
                            className="h-12 bg-gray-100 border-0 rounded-lg pr-12 font-manrope"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={verificationLoading}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-username" className="font-manrope">Username</Label>
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="Choose a username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          disabled={verificationLoading}
                          className="h-12 bg-gray-100 border-0 rounded-lg font-manrope"
                        />
                      </div>

                      <div className="flex space-x-3">
                        <Button
                          onClick={handleSignupConfirmation}
                          className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-manrope font-medium"
                          disabled={verificationLoading}
                        >
                          {verificationLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                        <Button
                          onClick={resetSignupFlow}
                          variant="outline"
                          className="flex-1 h-12 rounded-lg font-manrope"
                          disabled={verificationLoading}
                        >
                          Back to Login
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Email Verification - Replaces all other forms when shown */}
                {verificationSent && rightColumnContent === 'email-form' && (
                  <motion.div
                    key="email-verification"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Error Alert */}
                    {displayError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{displayError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 font-manrope">
                          Verify Your Email
                        </h3>
                        <p className="text-sm text-gray-600 font-manrope">
                          We've sent a 6-digit verification code to {newUserEmail}
                        </p>
                      </div>

                      <form onSubmit={handleEmailVerification} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="verification-code" className="font-manrope">Verification Code</Label>
                          <Input
                            id="verification-code"
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            maxLength={6}
                            disabled={signupLoading}
                            className="h-12 bg-gray-100 border-0 rounded-lg font-manrope text-center text-lg tracking-widest"
                          />
                        </div>

                        <div className="text-center text-xs text-gray-500 font-manrope">
                          Code expires in 5 minutes
                        </div>

                        <div className="flex space-x-3">
                          <Button
                            type="submit"
                            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-manrope font-medium"
                            disabled={signupLoading || verificationCode.length !== 6}
                          >
                            {signupLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              "Verify & Complete Signup"
                            )}
                          </Button>
                          <Button
                            onClick={resetSignupFlow}
                            variant="outline"
                            className="flex-1 h-12 rounded-lg font-manrope"
                            disabled={signupLoading}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}

                {/* Wallet Search Interface */}
                {rightColumnContent === 'wallet-search' && (
                  <motion.div
                    key="wallet-search"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Header with Back Arrow */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToEmailForm}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-xl font-semibold font-manrope text-gray-900">Select Wallet</h2>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search Wallet"
                        value={walletSearchTerm}
                        onChange={(e) => setWalletSearchTerm(e.target.value)}
                        className="pl-10 h-12 bg-gray-100 border-0 rounded-lg font-manrope"
                      />
                    </div>

                    {/* Wallet Results */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredWallets.map((wallet) => (
                        <motion.button
                          key={wallet.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleWalletSearchSelect(wallet)}
                          disabled={connectingWallet === wallet.id}
                          className={cn(
                            "w-full flex items-center gap-4 p-3 rounded-lg border border-gray-200",
                            "hover:border-gray-300 hover:bg-gray-50 transition-all duration-200",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            connectingWallet === wallet.id && "opacity-75 cursor-not-allowed"
                          )}
                        >
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                            {wallet.iconPath ? (
                              <img
                                src={wallet.iconPath}
                                alt={wallet.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <span className="text-lg">{wallet.icon}</span>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium font-manrope text-gray-900">{wallet.name}</p>
                            {wallet.detected && (
                              <p className="text-xs text-green-600 font-manrope">Detected</p>
                            )}
                          </div>
                          {connectingWallet === wallet.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          )}
                        </motion.button>
                      ))}

                      {filteredWallets.length === 0 && walletSearchTerm && (
                        <div className="text-center py-8 text-gray-500 font-manrope">
                          No wallets found for "{walletSearchTerm}"
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Wallet Installation Interface */}
                {rightColumnContent === 'wallet-install' && selectedWallet && (
                  <motion.div
                    key="wallet-install"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Header with Back Arrow */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToEmailForm}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-xl font-semibold font-manrope text-gray-900">
                        {selectedWallet.wallet.name}
                      </h2>
                    </div>

                    {/* Installation Options */}
                    <div className="space-y-4">
                      {/* Chrome Extension */}
                      <Button
                        variant="outline"
                        className="w-full h-14 justify-start gap-4 font-manrope"
                        onClick={() => window.open(selectedWallet.wallet.installUrl, '_blank')}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-lg">🌐</span>
                        </div>
                        <span>Download Chrome Extension</span>
                        <ExternalLink className="w-4 h-4 ml-auto" />
                      </Button>

                      {/* App Store */}
                      <Button
                        variant="outline"
                        className="w-full h-14 justify-start gap-4 font-manrope"
                        onClick={() => window.open("https://apps.apple.com/", '_blank')}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                          <img
                            src="/docs/pages/v2/signin/apple-store.png"
                            alt="App Store"
                            className="w-6 h-6 object-contain"
                          />
                        </div>
                        <span>Download on App Store</span>
                        <ExternalLink className="w-4 h-4 ml-auto" />
                      </Button>

                      {/* Google Play */}
                      <Button
                        variant="outline"
                        className="w-full h-14 justify-start gap-4 font-manrope"
                        onClick={() => window.open("https://play.google.com/", '_blank')}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-lg">📱</span>
                        </div>
                        <span>Download on Google PlayStore</span>
                        <ExternalLink className="w-4 h-4 ml-auto" />
                      </Button>
                    </div>

                    {/* Instructions */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 font-manrope">
                        After installing {selectedWallet.wallet.name}, refresh this page and try connecting again.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Wallet Connecting State */}
                {rightColumnContent === 'wallet-connecting' && selectedWallet && (
                  <motion.div
                    key="wallet-connecting"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center h-96"
                  >
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                        {selectedWallet.wallet.icon}
                      </div>
                      <h3 className="text-lg font-semibold font-manrope text-gray-900 mb-2">
                        Connecting to {selectedWallet.wallet.name}
                      </h3>
                      <p className="text-sm text-gray-600 font-manrope mb-4">
                        Please approve the connection in your wallet
                      </p>
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}