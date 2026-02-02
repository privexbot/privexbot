/**
 * AvatarUpload Component
 *
 * Reusable avatar upload/delete for users, organizations, workspaces, and chatbots.
 * Displays current avatar with initials fallback, hover overlay for upload,
 * and an "X" button to remove.
 */

import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { filesApi, type AvatarEntityType } from "@/api/files";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface AvatarUploadProps {
  entityType: AvatarEntityType;
  entityId: string;
  currentAvatarUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  onAvatarChange?: (newUrl: string | null) => void;
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-16 w-16",
  lg: "h-24 w-24",
} as const;

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

const removeButtonSizes = {
  sm: "h-4 w-4 -top-0.5 -right-0.5",
  md: "h-5 w-5 -top-1 -right-1",
  lg: "h-6 w-6 -top-1 -right-1",
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarUpload({
  entityType,
  entityId,
  currentAvatarUrl,
  name,
  size = "md",
  onAvatarChange,
  disabled = false,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = isUploading || isDeleting || disabled;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 2MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      const { avatar_url } = await filesApi.uploadAvatar(entityType, entityId, file);
      onAvatarChange?.(avatar_url);
      toast({ title: "Avatar updated" });
    } catch (err: unknown) {
      const message =
        err instanceof Error && "response" in err
          ? ((err as any).response?.data?.detail as string) ?? err.message
          : "Failed to upload avatar";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the upload click
    try {
      setIsDeleting(true);
      await filesApi.deleteAvatar(entityType, entityId);
      onAvatarChange?.(null);
      toast({ title: "Avatar removed" });
    } catch {
      toast({ title: "Failed to remove avatar", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative inline-block group">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => { void handleFileSelect(e); }}
        disabled={busy}
      />

      {/* Clickable avatar */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className={cn(
          "relative rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
          busy && "cursor-not-allowed opacity-70"
        )}
      >
        <Avatar className={cn(sizeClasses[size])}>
          {currentAvatarUrl && (
            <AvatarImage src={currentAvatarUrl} alt={name} className="object-cover" />
          )}
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-xs">
            {getInitials(name || "?")}
          </AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {isUploading || isDeleting ? (
            <Loader2 className={cn(iconSizes[size], "text-white animate-spin")} />
          ) : (
            <Camera className={cn(iconSizes[size], "text-white")} />
          )}
        </div>
      </button>

      {/* Remove button (only when avatar exists and not busy) */}
      {currentAvatarUrl && !busy && (
        <button
          type="button"
          onClick={(e) => { void handleDelete(e); }}
          className={cn(
            "absolute bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors focus:outline-none",
            removeButtonSizes[size]
          )}
          title="Remove avatar"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
