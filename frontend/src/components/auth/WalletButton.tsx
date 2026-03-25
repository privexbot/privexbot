/**
 * WalletButton Component
 *
 * Reusable wallet connection button with proper branding,
 * detection status, and installation guidance.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle } from "lucide-react";
import { WalletInfo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

interface WalletButtonProps {
  wallet: WalletInfo;
  onClick: () => void;
  isLoading?: boolean;
  isConnected?: boolean;
  className?: string;
}

export function WalletButton({
  wallet,
  onClick,
  isLoading = false,
  isConnected = false,
  className,
}: WalletButtonProps) {
  const handleClick = () => {
    if (wallet.detected) {
      onClick();
    } else {
      // Open installation page in new tab
      window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      type="button"
      variant={isConnected ? "default" : "outline"}
      className={cn(
        "w-full justify-between h-auto py-3 px-4",
        "hover:scale-[1.02] transition-all duration-200",
        className
      )}
      onClick={handleClick}
      disabled={isLoading}
    >
      <div className="flex items-center gap-3 flex-1">
        <span className="text-2xl" role="img" aria-label={wallet.name}>
          {wallet.icon}
        </span>
        <div className="flex flex-col items-start">
          <span className="font-medium">{wallet.name}</span>
          {wallet.isDefault && (
            <span className="text-xs text-muted-foreground">Recommended</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isConnected ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : wallet.detected ? (
          <Badge variant="secondary" className="text-xs">
            Detected
          </Badge>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Install</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        )}
      </div>
    </Button>
  );
}