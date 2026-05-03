/**
 * Global upgrade-prompt modal.
 *
 * Listens to the `quota-exceeded` CustomEvent dispatched by
 * `lib/api-client.ts` whenever the backend returns HTTP 402 with a
 * structured detail (either `error: "quota_exceeded"` or
 * `error: "feature_locked"`).
 *
 * Mounts once at the App root next to <Toaster /> so it's available on
 * every authenticated page. The pattern mirrors the existing
 * `no-organization-error` event channel (`api-client.ts:99`).
 *
 * Deliberately small. No tier-specific upsell copy, no animated
 * stepper — just an honest "you hit a limit, here's where to upgrade"
 * prompt. The tier upgrade itself happens on /billings.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Shape of the detail object dispatched on `quota-exceeded`. Matches
 *  the 402 detail produced by `billing_service.require_quota` /
 *  `require_feature` / `require_owned_orgs_quota` on the backend. */
interface QuotaExceededDetail {
  error?: "quota_exceeded" | "feature_locked";
  resource?: string;        // e.g. "chatbots", "owned_orgs", "kb_documents"
  feature?: string;         // e.g. "public_api_access" (when error=feature_locked)
  tier?: string;            // "free" | "starter" | "pro" | "enterprise"
  limit?: number;
  usage?: number;
  upgrade_url?: string;
}

const RESOURCE_LABEL: Record<string, string> = {
  chatbots: "Chatbots",
  chatflows: "Chatflows",
  knowledge_bases: "Knowledge bases",
  kb_documents: "Knowledge base documents",
  web_pages_per_month: "Web pages scraped this month",
  messages_per_month: "Messages this month",
  api_calls_per_month: "API calls this month",
  team_members: "Team members",
  workspaces: "Workspaces",
  owned_orgs: "Organizations you own",
};

const FEATURE_LABEL: Record<string, string> = {
  public_api_access: "Public REST API",
  custom_domain: "Custom domain",
  remove_branding: "Branding removal",
  sso_saml: "SSO / SAML",
};

function describeLimit(detail: QuotaExceededDetail): {
  title: string;
  body: string;
} {
  const tier = detail.tier ?? "free";
  if (detail.error === "feature_locked" && detail.feature) {
    const featureName = FEATURE_LABEL[detail.feature] ?? detail.feature;
    return {
      title: "Upgrade required",
      body: `${featureName} isn't included in the ${tier} plan. Upgrade to unlock it.`,
    };
  }
  if (detail.resource) {
    const resourceName = RESOURCE_LABEL[detail.resource] ?? detail.resource;
    const limit =
      typeof detail.limit === "number" ? detail.limit.toLocaleString() : "your";
    return {
      title: "You've hit your plan limit",
      body: `${resourceName}: you've reached the ${tier} plan's cap of ${limit}. Upgrade for more headroom.`,
    };
  }
  return {
    title: "Upgrade required",
    body: "Your current plan doesn't include this action. Upgrade to continue.",
  };
}

export function UpgradeModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<QuotaExceededDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const ce = event as CustomEvent<QuotaExceededDetail>;
      setDetail(ce.detail ?? {});
      setOpen(true);
    };
    window.addEventListener("quota-exceeded", handler);
    return () => window.removeEventListener("quota-exceeded", handler);
  }, []);

  const { title, body } = describeLimit(detail ?? {});
  const upgradeUrl = detail?.upgrade_url ?? "/billings";

  const goToUpgrade = () => {
    setOpen(false);
    navigate(upgradeUrl);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {detail?.tier ?? "Free"} plan
            </span>
          </div>
          <DialogTitle className="font-manrope">{title}</DialogTitle>
          <DialogDescription className="font-manrope">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-manrope"
          >
            Maybe later
          </Button>
          <Button onClick={goToUpgrade} className="font-manrope">
            See plans
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
