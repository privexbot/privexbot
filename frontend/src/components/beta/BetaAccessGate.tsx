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
import { betaApi } from "@/api/beta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Construction, KeyRound, AlertTriangle, CheckCircle } from "lucide-react";

interface BetaAccessGateProps {
  children: React.ReactNode;
}

export function BetaAccessGate({ children }: BetaAccessGateProps) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if user has beta access
  const hasBetaAccess = user?.is_staff || user?.has_beta_access;

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
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to redeem code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRedeem();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Early Access Program</CardTitle>
          <CardDescription className="text-base">
            PrivexBot is currently in active development
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Beta Warning */}
          <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              As an early tester, you may encounter bugs or incomplete features.
              We're working hard to make it production-ready!
            </AlertDescription>
          </Alert>

          {/* Invite Code Form */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4" />
              <span>Enter your invite code to continue</span>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="PRIV-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="font-mono text-center tracking-wider"
                maxLength={20}
              />
              <Button onClick={handleRedeem} disabled={isLoading || !code.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Redeem"
                )}
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Access granted! Redirecting...
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Contact Info */}
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Need an invite code? Contact the PrivexBot team.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BetaAccessGate;
