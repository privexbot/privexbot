/**
 * Profile Page (Protected)
 *
 * WHY: Manage user profile settings, preferences, and account information
 * HOW: Comprehensive profile management with update and delete functionality
 *
 * FEATURES:
 * - Profile information editing (username)
 * - Authentication methods display
 * - Account deletion with proper warnings
 * - Only visible in Personal organization
 * - Consistent with dashboard design
 * - Type-safe implementation
 * - Proper validation and error handling
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Save,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Mail,
  Wallet,
  Key,
  Calendar,
  ArrowLeft,
  UserCheck,
  Plus,
  Unlink,
  Eye,
  EyeOff
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { authApi } from "@/api/auth";
import type { UserProfile } from "@/types/auth";
import {
  updateProfileSchema,
  type UpdateProfileFormData,
  linkEmailSchema,
  type LinkEmailFormData
} from "@/api/schemas/user.schema";
import {
  detectWallets,
  connectEVMWallet,
  connectSolanaWallet,
  connectCosmosWallet,
  signEVMMessage,
  signSolanaMessage,
  signCosmosMessage,
  type WalletInfo,
  WALLET_CONFIGS
} from "@/lib/wallet-utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/components/ui/use-toast";

export function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentOrganization, currentWorkspace } = useApp();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Linking functionality state
  const [showLinkingOptions, setShowLinkingOptions] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkingType, setLinkingType] = useState<"email" | "wallet" | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletInfo[]>([]);

  // Email verification state
  const [emailVerificationStep, setEmailVerificationStep] = useState<"form" | "code" | null>(null);
  const [pendingEmailData, setPendingEmailData] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);

  // Unlink functionality state
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [methodToUnlink, setMethodToUnlink] = useState<{
    provider: string;
    providerId: string;
    label: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
  });

  // Email linking form
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
    reset: resetEmail,
  } = useForm<LinkEmailFormData>({
    resolver: zodResolver(linkEmailSchema),
  });

  // Check if user is in their personal organization (matches MainMenu logic)
  // Must match EXACTLY the same logic used in MainMenu.tsx
  const isPersonalOrg = React.useMemo(() => {
    // Both organization and workspace must be marked as default/personal
    // This is set by the backend during user signup and is permanent
    return currentOrganization?.is_default && currentWorkspace?.is_default;
  }, [currentOrganization?.is_default, currentWorkspace?.is_default]);

  // Load user profile and detect wallets
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        setError(null);

        const profile = await authApi.getCurrentUser();
        setUserProfile(profile);

        // Set form default values
        setValue("username", profile.username);
        reset({ username: profile.username });

        // Detect available wallets
        const walletDetection = detectWallets();
        setDetectedWallets([...walletDetection.installed, ...walletDetection.notInstalled]);
      } catch (err: any) {
        console.error("Failed to load profile:", err);
        setError("Failed to load profile information");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [setValue, reset]);

  // Handle profile update
  const handleProfileUpdate = async (data: UpdateProfileFormData) => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedProfile = await authApi.updateProfile({
        username: data.username,
      });

      setUserProfile(updatedProfile);
      reset(data); // Reset form state to mark as not dirty

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (err: any) {
      console.error("Profile update failed:", err);
      const errorMessage = err.response?.data?.detail || "Failed to update profile";
      setError(errorMessage);

      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle account deletion
  const handleAccountDelete = async () => {
    try {
      setIsDeleting(true);

      await authApi.deleteAccount();

      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
      });

      // Clear local storage and redirect to home
      localStorage.clear();
      window.location.href = "/";
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      const errorMessage = err.response?.data?.detail || "Failed to delete account";

      toast({
        title: "Deletion failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Handle email linking - Step 1: Send verification code
  const handleEmailLink = async (data: LinkEmailFormData) => {
    try {
      setIsLinking(true);
      setError(null);

      // Send verification code to email
      const response = await authApi.sendEmailLinkVerification(data);

      // Store the email data for later verification
      setPendingEmailData(data);
      setEmailVerificationStep("code");
      setCodeExpiry(Date.now() + response.expires_in * 1000);

      toast({
        title: "Verification code sent",
        description: `Check your email ${data.email} for the verification code.`,
      });
    } catch (err: any) {
      console.error("Failed to send verification code:", err);
      let errorMessage = "Failed to send verification code";

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle Pydantic validation errors (array format)
          errorMessage = err.response.data.detail.map((e: any) => e.msg).join(", ");
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      toast({
        title: "Failed to send code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Handle email verification - Step 2: Verify code and complete linking
  const handleEmailVerification = async () => {
    if (!pendingEmailData || !verificationCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    try {
      setIsLinking(true);
      setError(null);

      // Verify code and complete linking
      await authApi.verifyEmailAndLink({
        email: pendingEmailData.email,
        code: verificationCode.trim(),
      });

      // Refresh user profile to show new auth method
      const updatedProfile = await authApi.getCurrentUser();
      setUserProfile(updatedProfile);

      // Reset all state
      resetEmail();
      setEmailVerificationStep(null);
      setPendingEmailData(null);
      setVerificationCode("");
      setCodeExpiry(null);
      setLinkingType(null);
      setShowLinkingOptions(false);

      toast({
        title: "Email linked successfully",
        description: "You can now sign in with your email and password.",
      });
    } catch (err: any) {
      console.error("Email verification failed:", err);
      let errorMessage = "Invalid or expired verification code";

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle Pydantic validation errors (array format)
          errorMessage = err.response.data.detail.map((e: any) => e.msg).join(", ");
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Cancel email verification
  const handleCancelEmailVerification = () => {
    setEmailVerificationStep(null);
    setPendingEmailData(null);
    setVerificationCode("");
    setCodeExpiry(null);
    setError(null);
  };

  // Handle wallet linking
  const handleWalletLink = async (walletId: string) => {
    let walletConfig: any = null;

    try {
      setIsLinking(true);
      setError(null);
      setSelectedWallet(walletId);

      walletConfig = WALLET_CONFIGS[walletId];
      if (!walletConfig) {
        throw new Error("Wallet configuration not found");
      }

      // Step 1: Connect to wallet
      let address: string;
      let provider: any;
      let publicKey: string | undefined;

      if (walletConfig.provider === "evm") {
        const connection = await connectEVMWallet(walletId);
        address = connection.address;
        provider = connection.provider;
      } else if (walletConfig.provider === "solana") {
        const connection = await connectSolanaWallet(walletId);
        address = connection.address;
        provider = connection.provider;
      } else if (walletConfig.provider === "cosmos") {
        const connection = await connectCosmosWallet(walletId);
        address = connection.address;
        provider = connection.provider;
        publicKey = connection.publicKey;
      } else {
        throw new Error(`Unsupported wallet provider: ${walletConfig.provider}`);
      }

      // Step 2: Request challenge
      const challengeResponse = await authApi.requestWalletChallenge(
        walletConfig.provider,
        { address }
      );

      // Step 3: Sign message
      let signature: string;
      if (walletConfig.provider === "evm") {
        signature = await signEVMMessage(provider, address, challengeResponse.message);
      } else if (walletConfig.provider === "solana") {
        signature = await signSolanaMessage(provider, challengeResponse.message);
      } else if (walletConfig.provider === "cosmos") {
        const signed = await signCosmosMessage(
          provider,
          "secret-4", // Default chain ID
          address,
          challengeResponse.message
        );
        signature = signed.signature;
        publicKey = signed.publicKey;
      } else {
        throw new Error(`Unsupported wallet provider: ${walletConfig.provider}`);
      }

      // Step 4: Link wallet to account
      const linkData: any = {
        address,
        signed_message: challengeResponse.message,
        signature,
      };

      if (walletConfig.provider === "cosmos" && publicKey) {
        linkData.public_key = publicKey;
      }

      // Debug logging
      console.log("[ProfilePage] Linking wallet with data:", {
        provider: walletConfig.provider,
        linkData: {
          address: linkData.address,
          signed_message: linkData.signed_message ? "[PRESENT]" : "[MISSING]",
          signature: linkData.signature ? "[PRESENT]" : "[MISSING]",
          public_key: linkData.public_key ? "[PRESENT]" : "[NOT_REQUIRED]"
        }
      });

      await authApi.linkWallet(walletConfig.provider, linkData);

      // Refresh user profile to show new auth method
      const updatedProfile = await authApi.getCurrentUser();
      setUserProfile(updatedProfile);

      // Reset state
      setLinkingType(null);
      setSelectedWallet(null);
      setShowLinkingOptions(false);

      toast({
        title: `${walletConfig.name} linked successfully`,
        description: `You can now sign in with your ${walletConfig.name} wallet.`,
      });
    } catch (err: any) {
      console.error("Wallet linking failed:", err);

      // Extract detailed error information from backend response
      let errorMessage = "Failed to link wallet";
      let isWalletConflict = false;

      console.log("Raw error response:", err.response?.data);

      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
        // Detect wallet already linked to another account
        if (errorMessage.toLowerCase().includes("already linked to another account")) {
          isWalletConflict = true;
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.log("Parsed error message:", errorMessage);
      console.log("Is wallet conflict:", isWalletConflict);

      // Log detailed error for debugging
      console.error("Detailed error info:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          data: err.config?.data
        }
      });

      // Enhanced error messaging for wallet conflicts
      if (isWalletConflict) {
        const walletName = walletConfig?.name || "wallet";
        const conflictMessage = `This ${walletName} wallet is already linked to another account.`;
        console.log("Setting wallet conflict error:", conflictMessage);
        setError(conflictMessage);

        toast({
          title: "Wallet Already in Use",
          description: `This ${walletName} wallet is already linked to another account. You can either log in with that wallet or use a different wallet address.`,
          variant: "destructive",
        });
      } else {
        console.log("Setting general error:", errorMessage);
        setError(errorMessage);

        toast({
          title: "Linking failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLinking(false);
      setSelectedWallet(null);
    }
  };

  // Handle unlink confirmation
  const handleUnlinkConfirm = (method: any) => {
    const { label } = getAuthMethodInfo(method.provider);
    setMethodToUnlink({
      provider: method.provider,
      providerId: method.provider_id,
      label: label,
    });
    setUnlinkConfirmOpen(true);
  };

  // Handle auth method unlinking
  const handleUnlink = async () => {
    if (!methodToUnlink) return;

    try {
      setIsUnlinking(true);
      setError(null);

      await authApi.unlinkAuthMethod(methodToUnlink.provider, methodToUnlink.providerId);

      // Refresh user profile to remove the unlinked method
      const updatedProfile = await authApi.getCurrentUser();
      setUserProfile(updatedProfile);

      // Reset state
      setUnlinkConfirmOpen(false);
      setMethodToUnlink(null);

      toast({
        title: "Authentication method removed",
        description: `${methodToUnlink.label} has been successfully removed from your account.`,
      });
    } catch (err: any) {
      console.error("Unlinking failed:", err);
      const errorMessage = err.response?.data?.detail || "Failed to remove authentication method";
      setError(errorMessage);

      toast({
        title: "Removal failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Get auth method icon and label
  const getAuthMethodInfo = (provider: string) => {
    switch (provider) {
      case "email":
        return { icon: Mail, label: "Email" };
      case "evm":
        return { icon: Wallet, label: "EVM Wallet" };
      case "solana":
        return { icon: Wallet, label: "Solana Wallet" };
      case "cosmos":
        return { icon: Wallet, label: "Cosmos Wallet" };
      default:
        return { icon: Key, label: provider };
    }
  };

  // Get available linking options based on current auth methods
  const getAvailableLinkingOptions = () => {
    const currentProviders = new Set(userProfile?.auth_methods?.map(m => m.provider) || []);

    const available = {
      email: !currentProviders.has("email"),
      wallets: detectedWallets.filter(wallet => {
        // Don't show wallets that are already linked
        const walletProvider = wallet.provider;

        // For wallets, check if any auth method matches this provider
        return !userProfile?.auth_methods?.some(auth => auth.provider === walletProvider);
      })
    };

    return available;
  };

  const availableOptions = getAvailableLinkingOptions();

  // Redirect if not in personal organization
  if (!isPersonalOrg) {
    return (
      <DashboardLayout>
        <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
          <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-manrope">
              Profile settings are only available in your personal organization. Please switch to your personal organization to access this page.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate("/dashboard")} className="font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoadingProfile) {
    return (
      <DashboardLayout>
        <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
            </div>

            {/* Card Skeletons */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-manrope">
            Profile Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
            Manage your personal account settings and authentication methods
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Information */}
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-manrope">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Update your personal information and display name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                  Username
                </Label>
                <Input
                  id="username"
                  {...register("username")}
                  className="mt-1 h-10 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  disabled={isUpdating}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-manrope">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Account Information */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    User ID
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {userProfile?.id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    Account Status
                  </span>
                  <Badge variant="default" className="bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    Member Since
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {userProfile ? new Date(userProfile.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!isDirty || isUpdating}
                  className="font-manrope bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 rounded-lg"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Authentication Methods */}
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-manrope">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Authentication Methods
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Manage your login methods and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Current Auth Methods */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-3">
                  Connected Methods
                </h4>
                <div className="space-y-3">
                  {userProfile?.auth_methods?.length ? (
                    userProfile.auth_methods.map((method, index) => {
                      const { icon: Icon, label } = getAuthMethodInfo(method.provider);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                {label}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                                {method.provider_id}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-manrope">
                              Linked {new Date(method.linked_at).toLocaleDateString()}
                            </Badge>
                            {userProfile.auth_methods && userProfile.auth_methods.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlinkConfirm(method)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                                title="Remove this authentication method"
                                disabled={isUnlinking}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-manrope">
                      No authentication methods found
                    </p>
                  )}
                </div>
              </div>

              {/* Add New Auth Method */}
              {(availableOptions.email || availableOptions.wallets.length > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                      Add Authentication Method
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLinkingOptions(!showLinkingOptions)}
                      className="font-manrope text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Method
                    </Button>
                  </div>

                  {showLinkingOptions && (
                    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50 shadow-sm">
                      {/* Email Linking */}
                      {availableOptions.email && (
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => setLinkingType(linkingType === "email" ? null : "email")}
                            className="w-full justify-start font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                            disabled={isLinking}
                          >
                            <Mail className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                            Link Email & Password
                          </Button>

                          {linkingType === "email" && (
                            <div className="mt-3 space-y-3">
                              {emailVerificationStep === "code" ? (
                                // Step 2: Verification Code
                                <div className="space-y-3">
                                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                                    <p className="text-sm text-blue-800 dark:text-blue-200 font-manrope">
                                      We sent a verification code to <strong>{pendingEmailData?.email}</strong>
                                    </p>
                                  </div>

                                  <div>
                                    <Label htmlFor="verification-code" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                      Verification Code
                                    </Label>
                                    <Input
                                      id="verification-code"
                                      type="text"
                                      value={verificationCode}
                                      onChange={(e) => setVerificationCode(e.target.value)}
                                      className="mt-1 h-10 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                      placeholder="Enter 6-digit code"
                                      maxLength={6}
                                      disabled={isLinking}
                                      autoComplete="off"
                                    />
                                    {codeExpiry && (
                                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-manrope">
                                        Code expires in {Math.max(0, Math.ceil((codeExpiry - Date.now()) / 1000 / 60))} minutes
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      onClick={handleEmailVerification}
                                      disabled={isLinking || !verificationCode.trim()}
                                      className="font-manrope bg-blue-600 hover:bg-blue-700  text-white rounded-lg"
                                    >
                                      {isLinking ? (
                                        <>
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                          Verifying...
                                        </>
                                      ) : (
                                        <>
                                          <Shield className="h-4 w-4 mr-2" />
                                          Verify & Link
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={handleCancelEmailVerification}
                                      disabled={isLinking}
                                      className="font-manrope"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // Step 1: Email and Password Form
                                <form onSubmit={handleSubmitEmail(handleEmailLink)} className="space-y-3">
                                  <div>
                                    <Label htmlFor="link-email" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                      Email Address
                                    </Label>
                                    <Input
                                      id="link-email"
                                      type="email"
                                      {...registerEmail("email")}
                                      className="mt-1 h-10 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                      placeholder="Enter your email address"
                                      disabled={isLinking}
                                    />
                                    {emailErrors.email && (
                                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-manrope">
                                        {emailErrors.email.message}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <Label htmlFor="link-password" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                      Password
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        id="link-password"
                                        type={showPassword ? "text" : "password"}
                                        {...registerEmail("password")}
                                        className="mt-1 h-10 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                        placeholder="Create a secure password"
                                        disabled={isLinking}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                    {emailErrors.password && (
                                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-manrope">
                                        {emailErrors.password.message}
                                      </p>
                                    )}
                                  </div>

                                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-manrope">
                                      We'll send a verification code to this email address before linking it to your account.
                                    </p>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      type="submit"
                                      disabled={isLinking}
                                      className="font-manrope bg-blue-600 hover:bg-blue-700  text-white rounded-lg"
                                    >
                                      {isLinking ? (
                                        <>
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                          Sending Code...
                                        </>
                                      ) : (
                                        <>
                                          <Mail className="h-4 w-4 mr-2" />
                                          Send Verification Code
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setLinkingType(null);
                                        resetEmail();
                                        handleCancelEmailVerification();
                                      }}
                                      disabled={isLinking}
                                      className="font-manrope"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Wallet Linking */}
                      {availableOptions.wallets.length > 0 && (
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => setLinkingType(linkingType === "wallet" ? null : "wallet")}
                            className="w-full justify-start font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                            disabled={isLinking}
                          >
                            <Wallet className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                            Link Crypto Wallet
                          </Button>

                          {linkingType === "wallet" && (
                            <div className="mt-4 space-y-3">
                              {/* Wallet Options Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableOptions.wallets.map((wallet) => (
                                  <div
                                    key={wallet.id}
                                    className="relative group"
                                  >
                                    <Button
                                      variant="outline"
                                      onClick={() => handleWalletLink(wallet.id)}
                                      disabled={isLinking}
                                      className={`w-full p-4 h-auto justify-start font-manrope text-left border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 ${
                                        selectedWallet === wallet.id && isLinking
                                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                                          : wallet.detected
                                            ? 'border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600'
                                            : 'border-gray-200 dark:border-gray-600'
                                      }`}
                                    >
                                      <div className="flex items-center w-full">
                                        {/* Wallet Icon */}
                                        <div className="flex-shrink-0 mr-3">
                                          {wallet.iconPath ? (
                                            <img
                                              src={wallet.iconPath}
                                              alt={`${wallet.name} logo`}
                                              className="w-8 h-8 rounded-lg shadow-sm"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                              {wallet.name.charAt(0)}
                                            </div>
                                          )}
                                        </div>

                                        {/* Wallet Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <div className="font-semibold font-manrope text-gray-900 dark:text-gray-100 truncate">
                                              {wallet.name}
                                            </div>
                                            {/* Status Badge */}
                                            <div className="flex-shrink-0 ml-2">
                                              {wallet.detected ? (
                                                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                                                  Installed
                                                </div>
                                              ) : (
                                                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></div>
                                                  Not Found
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize font-manrope mt-1">
                                            {wallet.provider} Network
                                          </div>
                                        </div>
                                      </div>

                                      {/* Loading Spinner Overlay */}
                                      {selectedWallet === wallet.id && isLinking && (
                                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm">
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-transparent border-t-blue-600 dark:border-t-blue-400"></div>
                                            Connecting...
                                          </div>
                                        </div>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              {/* Helper Text */}
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                                <p className="text-sm text-blue-800 dark:text-blue-200 font-manrope">
                                  <strong>Note:</strong> Make sure your wallet extension is installed and unlocked before connecting.
                                </p>
                              </div>

                              {/* Error Display with Enhanced Messaging */}
                              {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-red-800 dark:text-red-200 font-manrope font-medium mb-2">
                                        {error}
                                      </p>
                                      {error.includes("already linked to another account") && (
                                        <div className="space-y-2">
                                          <p className="text-xs text-red-700 dark:text-red-300 font-manrope">
                                            <strong>What you can do:</strong>
                                          </p>
                                          <ul className="text-xs text-red-700 dark:text-red-300 font-manrope space-y-1 ml-4">
                                            <li className="flex items-start gap-2">
                                              <span className="text-red-500 mt-1">•</span>
                                              <span>
                                                <button
                                                  onClick={() => {
                                                    logout();
                                                    navigate("/signin");
                                                  }}
                                                  className="text-red-700 dark:text-red-300 underline hover:text-red-800 dark:hover:text-red-200 font-medium"
                                                >
                                                  Log out
                                                </button>
                                                {" "}and sign in with this wallet to access that account
                                              </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                              <span className="text-red-500 mt-1">•</span>
                                              <span>Use a different wallet address for this account</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                              <span className="text-red-500 mt-1">•</span>
                                              <span>Contact support if you believe this is an error</span>
                                            </li>
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Cancel Button */}
                              <div className="pt-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => setLinkingType(null)}
                                  disabled={isLinking}
                                  className="w-full font-manrope text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(!availableOptions.email && availableOptions.wallets.length === 0) && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                    All available authentication methods are already linked to your account.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200 font-manrope">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 font-manrope mb-2">
                Delete Account
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 font-manrope mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>

              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-manrope border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
                      Delete Account Permanently?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                      This action cannot be undone. This will permanently delete your account and all associated data including:
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                      <li>All organizations you created or belong to</li>
                      <li>All workspaces and their contents</li>
                      <li>All chatbots, chatflows, and knowledge bases</li>
                      <li>All authentication methods and login access</li>
                    </ul>

                    <Alert className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
                        <strong>Warning:</strong> This action is permanent and cannot be reversed.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={isDeleting}
                        className="font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAccountDelete}
                        disabled={isDeleting}
                        className="font-manrope bg-red-600 hover:bg-red-700  text-white rounded-lg"
                      >
                        {isDeleting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Unlink Confirmation Dialog */}
        <Dialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
                Remove Authentication Method?
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                {methodToUnlink ? (
                  <>
                    You are about to remove <strong>{methodToUnlink.label}</strong> from your account.
                    This will prevent you from using this method to sign in.
                  </>
                ) : (
                  "You are about to remove this authentication method from your account."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-manrope">
                  Make sure you have at least one other authentication method to access your account.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setUnlinkConfirmOpen(false)}
                  disabled={isUnlinking}
                  className="font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="font-manrope bg-red-600 hover:bg-red-700  text-white rounded-lg"
                >
                  {isUnlinking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Remove Method
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}