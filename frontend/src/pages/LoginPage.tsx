/**
 * Login Page
 *
 * WHY: Allow users to authenticate via email/password or wallet
 * HOW: Form with email/password + wallet connect buttons
 *
 * SUPPORTS:
 * - Email/password login
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, Mail, AlertCircle, Loader2 } from "lucide-react";
import { uint8ArrayToBase58 } from "@/utils/encoding";

export function LoginPage() {
  const navigate = useNavigate();
  const { emailLogin, walletLogin, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    try {
      await emailLogin({ email, password });
      navigate("/dashboard");
    } catch (err) {
      // Error is already set in AuthContext
      console.error("Login failed:", err);
    }
  };

  const handleWalletLogin = async (provider: "evm" | "solana" | "cosmos") => {
    clearError();
    setLocalError(null);

    try {
      if (provider === "evm") {
        await handleMetaMaskLogin();
      } else if (provider === "solana") {
        await handlePhantomLogin();
      } else if (provider === "cosmos") {
        await handleKeplrLogin();
      }
    } catch (err: any) {
      setLocalError(err.message || "Wallet authentication failed");
    }
  };

  /**
   * MetaMask (EVM) Login
   */
  const handleMetaMaskLogin = async () => {
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
      throw new Error("MetaMask not installed. Please install MetaMask extension.");
    }

    try {
      // Request account access from MetaMask specifically
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0];

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("evm", { address });

      // Sign message with MetaMask (use specific provider, not window.ethereum)
      const signature = await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });

      // Verify signature with backend
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
      // Check if wallet not registered
      if (err.response?.status === 401 || err.response?.data?.detail?.includes("not found")) {
        throw new Error("Wallet not registered. Please sign up first.");
      }
      throw err;
    }
  };

  /**
   * Phantom (Solana) Login
   */
  const handlePhantomLogin = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      throw new Error("Phantom wallet not installed. Please install Phantom extension.");
    }

    try {
      // Connect to Phantom
      const resp = await window.solana.connect();
      const address = resp.publicKey.toString();

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("solana", { address });

      // Sign message with Phantom
      const encodedMessage = new TextEncoder().encode(challenge.message);
      const signedMessage = await window.solana.signMessage(encodedMessage, "utf8");
      const signature = uint8ArrayToBase58(signedMessage.signature);

      // Verify signature with backend
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
      // Check if wallet not registered
      if (err.response?.status === 401 || err.response?.data?.detail?.includes("not found")) {
        throw new Error("Wallet not registered. Please sign up first.");
      }
      throw err;
    }
  };

  /**
   * Keplr (Cosmos) Login
   */
  const handleKeplrLogin = async () => {
    if (!window.keplr) {
      throw new Error("Keplr wallet not installed. Please install Keplr extension.");
    }

    try {
      // Enable Keplr for Secret Network (or Cosmos Hub)
      const chainId = "secret-4"; // Secret Network mainnet
      await window.keplr.enable(chainId);

      // Get account
      const key = await window.keplr.getKey(chainId);
      const address = key.bech32Address;

      // Request challenge from backend
      const { authApi } = await import("@/api/auth");
      const challenge = await authApi.requestWalletChallenge("cosmos", { address });

      // Sign message with Keplr
      const signatureResponse = await window.keplr.signArbitrary(chainId, address, challenge.message);

      // Use the public key from the signature response
      // signatureResponse.pub_key.value is the base64-encoded public key
      const publicKey = signatureResponse.pub_key.value;
      const signatureBase64 = signatureResponse.signature;

      console.log("[DEBUG] Keplr Login:", {
        address,
        publicKeyLength: publicKey.length,
        signatureLength: signatureBase64.length,
        messageLength: challenge.message.length
      });

      // Verify signature with backend
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
      // Check if wallet not registered
      if (err.response?.status === 401 || err.response?.data?.detail?.includes("not found")) {
        throw new Error("Wallet not registered. Please sign up first.");
      }
      throw err;
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your PrivexBot account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {displayError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          {/* Email/Password Login */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
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

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Wallet Login Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletLogin("evm")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              MetaMask (EVM)
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletLogin("solana")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Phantom (Solana)
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleWalletLogin("cosmos")}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Keplr (Cosmos)
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
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
