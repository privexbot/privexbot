/**
 * Referrals page — show the user's referral code, share link, and invites.
 *
 * Backed by `backend/src/app/api/v1/routes/referrals.py`. The code is
 * lazily generated on first load by the backend.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Gift,
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Users,
  CheckCircle,
  Hourglass,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { referralsApi, type ReferralRow } from "@/api/referrals";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-gray-600 dark:text-gray-400 flex-shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-manrope">{label}</p>
            <p className="text-2xl font-semibold font-manrope">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ReferralRow["status"] }) {
  if (status === "converted") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">Converted</Badge>;
  }
  if (status === "registered") {
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">Registered</Badge>;
  }
  return <Badge variant="outline">Pending</Badge>;
}

export function ReferralsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["referrals-me"],
    queryFn: () => referralsApi.getMine(),
  });

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["referrals-list"],
    queryFn: () => referralsApi.list(),
  });

  const copyShareLink = async () => {
    if (!summary?.share_url) return;
    try {
      await navigator.clipboard.writeText(summary.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({
        title: "Copied",
        description: "Your share link is on the clipboard.",
      });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Clipboard access denied.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="-ml-2 text-gray-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-start gap-4">
          <Gift className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-manrope">Referral program</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Share your link with friends and teammates. We'll track sign-ups
              automatically — when someone joins through your code, you'll see
              them below.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your share link</CardTitle>
            <CardDescription>
              Send this anywhere — DMs, email, your bio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryLoading || !summary ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-xs bg-gray-50 dark:bg-gray-900 border rounded px-3 py-2 truncate">
                    {summary.share_url}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyShareLink}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Code: <span className="font-mono">{summary.code}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total invites"
            value={summary?.total_invites ?? 0}
          />
          <StatCard
            icon={<Hourglass className="h-5 w-5" />}
            label="Pending"
            value={summary?.pending ?? 0}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5" />}
            label="Registered"
            value={summary?.registered ?? 0}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Converted"
            value={summary?.converted ?? 0}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invites</CardTitle>
            <CardDescription>
              Each row is a sign-up that came through your code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rowsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : !rows || rows.items.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No invites yet. Share your link to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.referred_username ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {r.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
