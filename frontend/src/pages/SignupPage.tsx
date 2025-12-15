/**
 * Signup Page
 *
 * WHY: Allow new users to create account via email/password or wallet
 * HOW: Registration form with email/password + wallet connect buttons
 *
 * SUPPORTS:
 * - Email/password signup
 * - MetaMask (EVM) wallet
 * - Phantom (Solana) wallet
 * - Keplr (Cosmos) wallet
 */

import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, Mail, AlertCircle, Loader2, CheckCircle2, Check } from "lucide-react";
import { uint8ArrayToBase58 } from "@/utils/encoding";

export function SignupPage() {
  const navigate = useNavigate();
  const { emailSignup, walletLogin, isLoading, error, clearError } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    // Validate password strength (basic check)
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    try {
      await emailSignup({ username, email, password });
      // Show success message briefly before redirecting
      setSignupSuccess(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 5000); // 3 second delay to show success
    } catch (err) {
      // Error is already set in AuthContext
      console.error("Signup failed:", err);
    }
  };

  const handleWalletSignup = async (provider: "evm" | "solana" | "cosmos") => {
    clearError();
    setLocalError(null);

    try {
      if (provider === "evm") {
        await handleMetaMaskSignup();
      } else if (provider === "solana") {
        await handlePhantomSignup();
      } else if (provider === "cosmos") {
        await handleKeplrSignup();
      }
    } catch (err: any) {
      setLocalError(err.message || "Wallet authentication failed");
    }
  };

  /**
   * MetaMask (EVM) Signup
   */
  const handleMetaMaskSignup = async () => {
    // Detect MetaMask specifically (not Phantom or other wallets)
    let provider = null;

    if (window.ethereum) {
      // If multiple wallets installed, find MetaMask in providers array
      if (window.ethereum.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask);
      }
      // Single wallet - check if it's MetaMask
      else if (window.ethereum.isMetaMask) {
        provider = window.ethereum;
      }
    }

    if (!provider) {
      throw new Error(
        "MetaMask not installed. Please install MetaMask extension."
      );
    }

    try {
      // Request account access from MetaMask specifically
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0];

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("evm", {
        address,
      });

      // Sign message with MetaMask (use specific provider, not window.ethereum)
      const signature = await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });

      // Verify signature with backend (creates account if new)
      await walletLogin("evm", {
        address,
        signed_message: challenge.message,
        signature,
      });

      navigate("/dashboard");
    } catch (err: any) {
      if (err.code === 4001) {
        throw new Error("MetaMask signature request was rejected");
      }
      throw err;
    }
  };

  /**
   * Phantom (Solana) Signup
   */
  const handlePhantomSignup = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      throw new Error(
        "Phantom wallet not installed. Please install Phantom extension."
      );
    }

    try {
      // Connect to Phantom
      const resp = await window.solana.connect();
      const address = resp.publicKey.toString();

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("solana", {
        address,
      });

      // Sign message with Phantom
      const encodedMessage = new TextEncoder().encode(challenge.message);
      const signedMessage = await window.solana.signMessage(
        encodedMessage,
        "utf8"
      );
      const signature = uint8ArrayToBase58(signedMessage.signature);

      // Verify signature with backend (creates account if new)
      await walletLogin("solana", {
        address,
        signed_message: challenge.message,
        signature,
      });

      navigate("/dashboard");
    } catch (err: any) {
      if (err.code === 4001) {
        throw new Error("Phantom signature request was rejected");
      }
      throw err;
    }
  };

  /**
   * Keplr (Cosmos) Signup
   */
  const handleKeplrSignup = async () => {
    if (!window.keplr) {
      throw new Error(
        "Keplr wallet not installed. Please install Keplr extension."
      );
    }

    try {
      // Enable Keplr for Secret Network
      const chainId = "secret-4"; // Secret Network mainnet
      await window.keplr.enable(chainId);

      // Get account
      const key = await window.keplr.getKey(chainId);
      const address = key.bech32Address;

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("cosmos", {
        address,
      });

      // Sign message with Keplr
      const signatureResponse = await window.keplr.signArbitrary(
        chainId,
        address,
        challenge.message
      );

      // Use the public key from the signature response
      // signatureResponse.pub_key.value is the base64-encoded public key
      const publicKey = signatureResponse.pub_key.value;
      const signatureBase64 = signatureResponse.signature;

      console.log("[DEBUG] Keplr Signup:", {
        address,
        publicKeyLength: publicKey.length,
        signatureLength: signatureBase64.length,
        messageLength: challenge.message.length
      });

      // Verify signature with backend (creates account if new)
      await walletLogin("cosmos", {
        address,
        signed_message: challenge.message,
        signature: signatureBase64,
        public_key: publicKey,
      });

      navigate("/dashboard");
    } catch (err: any) {
      if (err.message.includes("Request rejected")) {
        throw new Error("Keplr signature request was rejected");
      }
      throw err;
    }
  };

  const displayError = error || localError;

  // Password strength indicator
  const getPasswordStrength = (
    pass: string
  ): { strength: string; color: string } => {
    if (pass.length === 0) return { strength: "", color: "" };
    if (pass.length < 8) return { strength: "Weak", color: "text-red-500" };
    if (pass.length < 12)
      return { strength: "Medium", color: "text-yellow-500" };
    return { strength: "Strong", color: "text-green-500" };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-center">
            Create Account
          </CardTitle>
          <CardDescription className="text-center">
            Start building privacy-first AI chatbots
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {signupSuccess && (
            <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400">
              <Check className="h-4 w-4" />
              <AlertDescription>
                Account created successfully! Redirecting to dashboard...
              </AlertDescription>
            </Alert>
          )}

          {displayError && !signupSuccess && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          {/* Email/Password Signup */}
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
              {password.length > 0 && (
                <p className={`text-xs ${passwordStrength.color}`}>
                  {passwordStrength.strength}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
              {confirmPassword.length > 0 && password === confirmPassword && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Passwords match
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || signupSuccess}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : signupSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Success!
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign up with Email
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Wallet Signup Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletSignup("evm")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              MetaMask (EVM)
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletSignup("solana")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Phantom (Solana)
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletSignup("cosmos")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Keplr (Cosmos)
            </Button>
          </div>

          {/* Terms */}
          <p className="text-xs text-muted-foreground text-center">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

// Type definitions for wallet providers
declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    keplr?: any;
  }
}
