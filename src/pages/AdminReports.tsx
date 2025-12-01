import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getProfilePath } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SeverityOption = "warning" | "temporary_suspension" | "permanent_ban";
type ReportStatus = "open" | "resolved" | "dismissed";

interface Reporter {
  id: string;
  username: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
}

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter: Reporter | null;
}

interface ModerationLogEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: Record<string, unknown> | null;
  created_at: string;
  admin: { id: string | null; username: string | null } | null;
}

interface UserWarningEntry {
  id: string;
  reason: string;
  severity: SeverityOption;
  duration_hours: number | null;
  created_at: string;
  admin: { id: string | null; username: string | null } | null;
}

interface ReportDetails {
  targetUserId: string | null;
  parentCatchId: string | null;
  deletedAt: string | null;
  warnCount: number;
  moderationStatus: string;
  suspensionUntil: string | null;
  userWarnings: UserWarningEntry[];
  modHistory: ModerationLogEntry[];
  targetProfile: { id: string; username: string | null } | null;
  targetMissing: boolean;
}

interface WarningQueryRow {
  id: string;
  reason: string;
  severity: string;
  duration_hours: number | null;
  created_at: string;
  details: string | null;
  admin: { id: string | null; username: string | null } | null;
}

interface ModerationLogQueryRow {
  id: string;
  action: string;
  user_id: string | null;
  catch_id: string | null;
  comment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin: { id: string | null; username: string | null } | null;
}

const severityOptions: { value: SeverityOption; label: string }[] = [
  { value: "warning", label: "Warning" },
  { value: "temporary_suspension", label: "Temporary suspension" },
  { value: "permanent_ban", label: "Permanent ban" },
];

const statusBadgeVariants: Record<ReportStatus, string> = {
  open: "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-yellow-100 text-yellow-800",
};

const formatRelative = (value: string | null | undefined) => {
  if (!value) return "N/A";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
};

const AdminReports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "catch" | "comment" | "profile">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "dismissed">("open");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [pageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"24h" | "7d" | "30d" | "all">("7d");

  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [details, setDetails] = useState<ReportDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filteredUserId, setFilteredUserId] = useState<string | null>(null);
  const [filteredUsername, setFilteredUsername] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWarnDialog, setShowWarnDialog] = useState(false);
  const [warnReason, setWarnReason] = useState("");
  const [warnSeverity, setWarnSeverity] = useState<SeverityOption>("warning");
  const [warnDuration, setWarnDuration] = useState("24");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const fetchReports = useCallback(
    async (options: { silently?: boolean } = {}) => {
      if (!user || !isAdmin) return;
      if (!options.silently) {
        setIsLoading(true);
      }

      const dateDays =
        dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : null;
      const since = dateDays ? new Date(Date.now() - dateDays * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data, error } = await supabase.rpc("admin_list_reports", {
        p_status: statusFilter === "all" ? null : statusFilter,
        p_type: filter === "all" ? null : filter,
        p_reported_user_id: filteredUserId ?? null,
        p_from: since,
        p_to: null,
        p_sort_direction: sortOrder === "oldest" ? "asc" : "desc",
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });

      if (error) {
        toast.error("Unable to load reports");
      } else if (data) {
        const normalized = (data as any[]).map((row) => ({
          id: row.id,
          target_type: row.target_type,
          target_id: row.target_id,
          reason: row.reason,
          status: row.status,
          created_at: row.created_at,
          reporter: row.reporter_id
            ? {
                id: row.reporter_id,
                username: row.reporter_username,
                avatar_path: row.reporter_avatar_path,
                avatar_url: row.reporter_avatar_url,
              }
            : null,
        })) as ReportRow[];
        setReports(normalized);
      }

      setIsLoading(false);
    },
    [user, isAdmin, sortOrder, pageSize, page, statusFilter, filter, filteredUserId, dateRange]
  );

  useEffect(() => {
    const state = (location.state as { filterUserId?: string; filterUsername?: string } | null) ?? null;
    const stateUserId = state?.filterUserId ?? null;
    const stateUsername = state?.filterUsername ?? null;
    const queryUserId = new URLSearchParams(location.search).get("reportedUserId") ?? new URLSearchParams(location.search).get("userId");
    const nextFilter = stateUserId ?? queryUserId ?? null;
    setFilteredUserId(nextFilter);
    setFilteredUsername(stateUsername ?? null);
    setPage(1);
  }, [location]);

  useEffect(() => {
    if (isAdmin) {
      void fetchReports();
    }
  }, [fetchReports, isAdmin]);

  useEffect(() => {
    const resolveUsername = async () => {
      if (!isAdmin || !filteredUserId) {
        setFilteredUsername(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", filteredUserId)
        .maybeSingle();
      if (error || !data) {
        setFilteredUsername(null);
        return;
      }
      setFilteredUsername(data.username ?? null);
    };
    void resolveUsername();
  }, [filteredUserId, isAdmin, user]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-reports-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchReports, isAdmin, user]);

  useEffect(() => {
    if (!selectedReport) return;

    const updated = reports.find((report) => report.id === selectedReport.id);
    if (!updated) {
      setSelectedReport(null);
      setDetails(null);
      return;
    }

    if (
      updated.status !== selectedReport.status ||
      updated.reason !== selectedReport.reason ||
      updated.target_type !== selectedReport.target_type ||
      updated.target_id !== selectedReport.target_id
    ) {
      setSelectedReport(updated);
    }
  }, [reports, selectedReport]);

  const fetchReportDetails = useCallback(
    async (report: ReportRow): Promise<ReportDetails> => {
      if (!user || !isAdmin) {
        throw new Error("Admin privileges required");
      }

      let targetUserId: string | null = null;
      let parentCatchId: string | null = null;
      let deletedAt: string | null = null;
      let targetMissing = false;
      let targetProfile: { id: string; username: string | null } | null = null;
      let warnCount = 0;
      let moderationStatus = "active";
      let suspensionUntil: string | null = null;

      if (report.target_type === "catch") {
        const { data, error } = await supabase
          .from("catches")
          .select("id, user_id, deleted_at")
          .eq("id", report.target_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          parentCatchId = data.id;
          targetUserId = data.user_id ?? null;
          deletedAt = data.deleted_at ?? null;
        } else {
          targetMissing = true;
          parentCatchId = report.target_id;
        }
      } else if (report.target_type === "comment") {
        const { data, error } = await supabase
          .from("catch_comments")
          .select("id, catch_id, user_id, deleted_at")
          .eq("id", report.target_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          parentCatchId = data.catch_id;
          targetUserId = data.user_id ?? null;
          deletedAt = data.deleted_at ?? null;
        } else {
          targetMissing = true;
          parentCatchId = null;
        }
      } else {
        targetUserId = report.target_id;
        parentCatchId = null;
      }

      if (targetUserId) {
        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, warn_count, moderation_status, suspension_until")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profileRow) {
          targetProfile = { id: profileRow.id, username: profileRow.username };
          warnCount = profileRow.warn_count ?? 0;
          moderationStatus = profileRow.moderation_status ?? "active";
          suspensionUntil = profileRow.suspension_until ?? null;
        } else {
          targetMissing = true;
        }
      }

      const warningsResponse = targetUserId
        ? await supabase
            .from("user_warnings")
            .select(
              "id, reason, details, severity, duration_hours, created_at, admin:issued_by (id, username)",
            )
            .eq("user_id", targetUserId)
            .order("created_at", { ascending: false })
        : { data: [] as unknown[], error: null };

      if (warningsResponse.error) throw warningsResponse.error;

      let historyQuery = supabase
        .from("moderation_log")
        .select("id, action, user_id, catch_id, comment_id, metadata, created_at, admin:admin_id (id, username)")
        .order("created_at", { ascending: false });

      if (report.target_type === "catch") {
        historyQuery = historyQuery.eq("catch_id", report.target_id);
      } else if (report.target_type === "comment") {
        historyQuery = historyQuery.eq("comment_id", report.target_id);
      } else if (targetUserId) {
        historyQuery = historyQuery.eq("user_id", targetUserId);
      }

      const historyResponse = await historyQuery;

      if (historyResponse.error) throw historyResponse.error;

      const warningRows = (warningsResponse.data ?? []) as WarningQueryRow[];
      const historyRows = (historyResponse.data ?? []) as ModerationLogQueryRow[];

      const userWarnings = warningRows.map((entry) => {
        const severityValue = entry.severity as SeverityOption;
        const normalizedSeverity = severityOptions.some((option) => option.value === severityValue)
          ? severityValue
          : "warning";
        const displayedReason = entry.reason || entry.details || "Moderator action";

        return {
          id: entry.id,
          reason: displayedReason,
          severity: normalizedSeverity,
          duration_hours: entry.duration_hours ?? null,
          created_at: entry.created_at,
          admin: entry.admin ?? null,
        } satisfies UserWarningEntry;
      });

      const modHistory = historyRows.map((entry) => {
        const metadata = entry.metadata ?? null;
        const metadataReason =
          metadata && typeof metadata["reason"] === "string"
            ? (metadata["reason"] as string)
            : "No reason provided";
        const targetType = entry.comment_id
          ? "comment"
          : entry.catch_id
            ? "catch"
            : entry.user_id
              ? "profile"
              : report.target_type;
        const targetId = entry.comment_id ?? entry.catch_id ?? entry.user_id ?? report.target_id;

        return {
          id: entry.id,
          action: entry.action,
          target_type: targetType,
          target_id: targetId ?? report.target_id,
          reason: metadataReason,
          details: metadata,
          created_at: entry.created_at,
          admin: entry.admin ?? null,
        } satisfies ModerationLogEntry;
      });

      return {
        targetUserId,
        parentCatchId,
        deletedAt,
        warnCount: warnCount || userWarnings.length,
        moderationStatus,
        suspensionUntil,
        userWarnings,
        modHistory,
        targetProfile,
        targetMissing,
      };
    },
    [user, isAdmin]
  );

  const handleSelectReport = useCallback(
    async (report: ReportRow) => {
      setSelectedReport(report);
      setDetails(null);
      setWarnReason("");
      setWarnSeverity("warning");
      setWarnDuration("24");
      setShowDeleteConfirm(false);
      setShowWarnDialog(false);

      if (!isAdmin) return;

      setDetailsLoading(true);
      try {
        const context = await fetchReportDetails(report);
        setDetails(context);
      } catch (error) {
        console.error(error);
        toast.error("Unable to load moderation details");
      } finally {
        setDetailsLoading(false);
      }
    },
    [fetchReportDetails, isAdmin]
  );

  const handleUpdateStatus = useCallback(
    async (reportId: string, status: ReportStatus) => {
      if (!user || !isAdmin) return;
      setUpdatingId(reportId);

      const { error } = await supabase.rpc("admin_update_report_status", {
        p_report_id: reportId,
        p_status: status,
        p_resolution_notes: null,
      });

      if (error) {
        toast.error("Unable to update report status");
      } else {
        setReports((prev) => prev.map((report) => (report.id === reportId ? { ...report, status } : report)));
        setSelectedReport((prev) => (prev && prev.id === reportId ? { ...prev, status } : prev));
        toast.success(`Report marked as ${status}`);
      }

      setUpdatingId(null);
    },
    [user, isAdmin]
  );

  const handleViewTarget = useCallback(
    async (report: ReportRow, catchIdFromDetails?: string | null) => {
      if (report.target_type === "catch") {
        navigate(`/catch/${report.target_id}`);
        return;
      }

      if (report.target_type === "profile") {
        const candidateUsername =
          selectedReport?.id === report.id ? details?.targetProfile?.username ?? null : null;
        navigate(getProfilePath({ username: candidateUsername, id: report.target_id }));
        return;
      }

      if (report.target_type === "comment") {
        const catchId = catchIdFromDetails;
        if (catchId) {
          navigate(`/catch/${catchId}`);
          return;
        }

        const { data, error } = await supabase
          .from("catch_comments")
          .select("catch_id")
          .eq("id", report.target_id)
          .maybeSingle();

        if (error || !data) {
          toast.error("Unable to open reported comment");
          return;
        }

        navigate(`/catch/${data.catch_id}`);
      }
    },
    [details, navigate, selectedReport]
  );

  const handleDeleteContent = useCallback(async () => {
    if (!selectedReport || !details) return;
    if (!["catch", "comment"].includes(selectedReport.target_type)) return;
    if (details.targetMissing) {
      toast.error("Content record not found");
      return;
    }

    setIsProcessingAction(true);
    try {
      const deleteReason = selectedReport.reason || "Moderator content removal";

      if (selectedReport.target_type === "catch") {
        const { error } = await supabase.rpc("admin_delete_catch", {
          p_catch_id: selectedReport.target_id,
          p_reason: deleteReason,
        });
        if (error) throw error;
      } else {
        console.debug("admin_delete_comment payload", {
          reportId: selectedReport.id,
          targetId: selectedReport.target_id,
        });
        const { error } = await supabase.rpc("admin_delete_comment", {
          p_comment_id: selectedReport.target_id,
          p_reason: deleteReason,
        });
        if (error) throw error;
      }

      toast.success("Content deleted and user notified");
      await handleUpdateStatus(selectedReport.id, "resolved");
      await fetchReports({ silently: true });
      const refreshed = await fetchReportDetails(selectedReport);
      setDetails(refreshed);
    } catch (error) {
      console.error("admin_delete_comment failed", error);
      const errorMessage =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Unable to delete content";
      toast.error(errorMessage);
    } finally {
      setIsProcessingAction(false);
      setShowDeleteConfirm(false);
    }
  }, [details, fetchReportDetails, fetchReports, handleUpdateStatus, selectedReport]);

  const handleRestoreContent = useCallback(async () => {
    if (!selectedReport || !details) return;
    if (!details.deletedAt) return;

    if (!["catch", "comment"].includes(selectedReport.target_type)) return;

    setIsProcessingAction(true);
    try {
      if (selectedReport.target_type === "catch") {
        const { error } = await supabase.rpc("admin_restore_catch", {
          p_catch_id: selectedReport.target_id,
          p_reason: "Decision overturned",
        });
        if (error) throw error;
      } else {
        console.debug("admin_restore_comment payload", {
          reportId: selectedReport.id,
          targetId: selectedReport.target_id,
        });
        const { error } = await supabase.rpc("admin_restore_comment", {
          p_comment_id: selectedReport.target_id,
          p_reason: "Decision overturned",
        });
        if (error) throw error;
      }

      toast.success("Content restored");
      await fetchReports({ silently: true });
      const refreshed = await fetchReportDetails(selectedReport);
      setDetails(refreshed);
    } catch (error) {
      console.error("admin_restore_comment failed", error);
      const errorMessage =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Unable to restore content";
      toast.error(errorMessage);
    } finally {
      setIsProcessingAction(false);
    }
  }, [details, fetchReportDetails, fetchReports, selectedReport]);

  const handleWarnUser = useCallback(async () => {
    if (!selectedReport || !details || !details.targetUserId) {
      toast.error("Target user unavailable for moderation");
      return;
    }

    const trimmedReason = warnReason.trim();
    if (!trimmedReason) {
      toast.error("Please provide a reason for the warning");
      return;
    }

    let duration: number | null = null;
    if (warnSeverity === "temporary_suspension") {
      const parsed = parseInt(warnDuration, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        toast.error("Enter a valid suspension duration in hours");
        return;
      }
      duration = parsed;
    }

    setIsProcessingAction(true);
    try {
      const payload: Record<string, unknown> = {
        p_user_id: details.targetUserId,
        p_reason: trimmedReason,
        p_severity: warnSeverity,
      };
      if (duration !== null) {
        payload.p_duration_hours = duration;
      }

      const { error } = await supabase.rpc("admin_warn_user", payload);
      if (error) throw error;

      toast.success("User moderation action recorded");
      setWarnReason("");
      setWarnSeverity("warning");
      setWarnDuration("24");
      setShowWarnDialog(false);

      await handleUpdateStatus(selectedReport.id, "resolved");
      await fetchReports({ silently: true });
      const refreshed = await fetchReportDetails(selectedReport);
      setDetails(refreshed);
    } catch (error) {
      console.error(error);
      toast.error("Unable to submit warning");
    } finally {
      setIsProcessingAction(false);
    }
  }, [details, fetchReportDetails, fetchReports, handleUpdateStatus, selectedReport, warnDuration, warnReason, warnSeverity]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const typeMatches = filter === "all" ? true : report.target_type === filter;
      const statusMatches =
        statusFilter === "all" ? true : report.status.toLowerCase() === statusFilter;
      const userMatches = filteredUserId ? report.target_id === filteredUserId : true;
      return typeMatches && statusMatches && userMatches;
    });
  }, [reports, filter, statusFilter, filteredUserId]);

  const canLoadMore = reports.length === pageSize * page;

  const handleCloseDetails = () => {
    setSelectedReport(null);
    setDetails(null);
    setShowDeleteConfirm(false);
    setShowWarnDialog(false);
    setWarnReason("");
    setWarnSeverity("warning");
    setWarnDuration("24");
  };

  // Show loading spinner while checking admin status
  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect handled by useAdminAuth hook
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Review and act on user reports.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            {(["all", "catch", "comment", "profile"] as const).map((type) => (
              <Button
                key={type}
                variant={filter === type ? "ocean" : "outline"}
                onClick={() => setFilter(type)}
              >
                {type === "all" ? "All reports" : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
            <div className="h-8 w-px bg-border/60" aria-hidden />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Date</span>
              <div className="flex rounded-md border border-border/70 overflow-hidden">
                {(["24h", "7d", "30d", "all"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "ocean" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => {
                      setDateRange(range);
                      setPage(1);
                    }}
                  >
                    {range === "24h" ? "24h" : range === "7d" ? "7 days" : range === "30d" ? "30 days" : "All"}
                  </Button>
                ))}
              </div>
            </div>
            {(["all", "open", "resolved", "dismissed"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "ocean" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all"
                  ? "All statuses"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
            <div className="h-8 w-px bg-border/60" aria-hidden />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sort</span>
              <div className="flex rounded-md border border-border/70 overflow-hidden">
                {(["newest", "oldest"] as const).map((order) => (
                  <Button
                    key={order}
                    variant={sortOrder === order ? "ocean" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => {
                      setSortOrder(order);
                      setPage(1);
                    }}
                  >
                    {order === "newest" ? "Newest first" : "Oldest first"}
                  </Button>
                ))}
              </div>
            </div>
            {filteredUserId ? (
              <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <span>
                  {filteredUsername ? `Reports about @${filteredUsername}` : "Reports about this user"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setFilteredUserId(null);
                    setFilteredUsername(null);
                    navigate("/admin/reports", { replace: true });
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading reports…</p>
            ) : filteredReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filteredUserId
                  ? `No reports about ${filteredUsername ? `@${filteredUsername}` : "this user"} match these filters.`
                  : "No reports match these filters."}
              </p>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedReport?.id === report.id;
                const currentDetails = isSelected ? details : null;
                const isStatusUpdating = updatingId === report.id;
                const canDelete =
                  isSelected &&
                  currentDetails &&
                  !currentDetails.targetMissing &&
                  ["catch", "comment"].includes(report.target_type);
                const canWarn = Boolean(currentDetails?.targetUserId);
                const canRestore =
                  isSelected &&
                  currentDetails &&
                  Boolean(currentDetails.deletedAt) &&
                  ["catch", "comment"].includes(report.target_type);

                return (
                  <div key={report.id} className="rounded-lg border border-border/60 bg-card/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary" className="uppercase tracking-wide">
                          {report.target_type}
                        </Badge>
                        <Select
                          value={report.status}
                          onValueChange={(value) => handleUpdateStatus(report.id, value as ReportStatus)}
                          disabled={isStatusUpdating}
                        >
                          <SelectTrigger className="w-[150px] h-8">
                            <SelectValue placeholder={report.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {(["open", "resolved", "dismissed"] as const).map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(report.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary"
                          onClick={() => void handleViewTarget(report, currentDetails?.parentCatchId)}
                        >
                          View target
                        </Button>
                        {isSelected ? (
                          <Button variant="ghost" size="sm" onClick={handleCloseDetails}>
                            Close
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => void handleSelectReport(report)}>
                            Moderation actions
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{report.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reported by {report.reporter?.username ?? report.reporter?.id ?? "Unknown"}
                    </p>

                    {isSelected && (
                      <div className="mt-3 space-y-3">
                        {detailsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading moderation context…</p>
                        ) : currentDetails ? (
                          <>
                            {currentDetails.targetProfile?.id ? (
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>
                                  Target user: {currentDetails.targetProfile.username ?? currentDetails.targetProfile.id}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary"
                                  onClick={() =>
                                    navigate(`/admin/users/${currentDetails.targetProfile?.id}/moderation`, {
                                      state: { from: "reports" },
                                    })
                                  }
                                >
                                  View moderation history
                                </Button>
                              </div>
                            ) : null}

                            {currentDetails.targetMissing && (
                              <div className="rounded border border-dashed border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
                                The reported content is no longer available.
                              </div>
                            )}

                            {currentDetails.deletedAt && (
                              <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                                Content deleted {formatRelative(currentDetails.deletedAt)}.
                              </div>
                            )}

                            <div className="flex items-center justify-between rounded bg-gray-50 p-3">
                              <span className="font-medium">Status:</span>
                              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeVariants[report.status]}`}>
                                {report.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="rounded bg-slate-50 p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span>Moderation status</span>
                                <span className="font-medium capitalize">{currentDetails.moderationStatus}</span>
                              </div>
                              {currentDetails.suspensionUntil && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Suspended until {new Date(currentDetails.suspensionUntil).toLocaleString()}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2 rounded bg-blue-50 p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span>Prior warnings</span>
                                <span>
                                  <strong>{currentDetails.warnCount}</strong>/3
                                </span>
                              </div>
                              {currentDetails.userWarnings.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No prior warnings.</p>
                              ) : (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {currentDetails.userWarnings.map((warning) => (
                                    <div key={warning.id} className="rounded border border-blue-200 bg-white/60 p-2">
                                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-blue-700">
                                        <span>{warning.severity.replace("_", " ")}</span>
                                        <span>{formatRelative(warning.created_at)}</span>
                                      </div>
                                      <div className="mt-1 text-[13px] text-foreground">{warning.reason}</div>
                                      {warning.duration_hours && (
                                        <div className="text-[11px] text-muted-foreground">
                                          Duration: {warning.duration_hours}h
                                        </div>
                                      )}
                                      {warning.admin && (
                                        <div className="text-[11px] text-muted-foreground">
                                          By {warning.admin.username ?? warning.admin.id ?? "admin"}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {canDelete && (
                                <Button
                                  onClick={() => setShowDeleteConfirm(true)}
                                  disabled={isProcessingAction || isStatusUpdating}
                                  className="px-3 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  Delete {report.target_type === "catch" ? "post" : "comment"}
                                </Button>
                              )}
                              <Button
                                onClick={() => setShowWarnDialog(true)}
                                disabled={!canWarn || isProcessingAction || isStatusUpdating}
                                className="px-3 py-2 bg-orange-600 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                              >
                                Warn user
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => void handleUpdateStatus(report.id, "dismissed")}
                                disabled={isProcessingAction || isStatusUpdating || report.status === "dismissed"}
                              >
                                Dismiss
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => void handleUpdateStatus(report.id, "resolved")}
                                disabled={isProcessingAction || isStatusUpdating || report.status === "resolved"}
                              >
                                Resolve
                              </Button>
                              {report.status !== "open" && (
                                <Button
                                  variant="ghost"
                                  onClick={() => void handleUpdateStatus(report.id, "open")}
                                  disabled={isProcessingAction || isStatusUpdating}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>

                            {canRestore && (
                              <Button
                                onClick={() => void handleRestoreContent()}
                                disabled={isProcessingAction}
                                className="w-full px-3 py-2 bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                              >
                                Restore {report.target_type === "catch" ? "post" : "comment"}
                              </Button>
                            )}

                            <details className="rounded bg-gray-50 p-3">
                              <summary className="cursor-pointer font-medium">Moderation history</summary>
                              <div className="mt-3 space-y-2 text-sm">
                                {currentDetails.modHistory.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No moderation actions recorded.</p>
                                ) : (
                                  currentDetails.modHistory.map((entry) => (
                                    <div key={entry.id} className="border-l-2 border-gray-300 pl-3">
                                      <div className="font-medium">
                                        {entry.admin?.username ?? entry.admin?.id ?? "Unknown admin"} – {entry.action}
                                      </div>
                                      <div className="text-gray-600">{entry.reason}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatRelative(entry.created_at)}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </details>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Unable to load moderation context.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!isLoading && filteredReports.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  {`Showing ${filteredReports.length} report${filteredReports.length === 1 ? "" : "s"}`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (canLoadMore) {
                        setPage((prev) => prev + 1);
                      }
                    }}
                    disabled={!canLoadMore || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !isProcessingAction && setShowDeleteConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this content?</AlertDialogTitle>
            <AlertDialogDescription>
              This action hides the content from all users and the owner will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDeleteContent();
              }}
              disabled={isProcessingAction}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showWarnDialog} onOpenChange={(open) => !isProcessingAction && setShowWarnDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warn user</DialogTitle>
            <DialogDescription>
              Issue a warning or suspension. This user currently has
              {" "}
              <strong>{details?.warnCount ?? 0}</strong>
              {" "}/3 warnings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warn-reason">Reason</Label>
              <Textarea
                id="warn-reason"
                value={warnReason}
                onChange={(event) => setWarnReason(event.target.value)}
                placeholder="Explain why this action is being taken"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warn-severity">Severity</Label>
              <Select value={warnSeverity} onValueChange={(value) => setWarnSeverity(value as SeverityOption)}>
                <SelectTrigger id="warn-severity">
                  <SelectValue placeholder="Select a severity" />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {warnSeverity === "temporary_suspension" && (
              <div className="space-y-2">
                <Label htmlFor="warn-duration">Suspension length (hours)</Label>
                <Input
                  id="warn-duration"
                  type="number"
                  min={1}
                  value={warnDuration}
                  onChange={(event) => setWarnDuration(event.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarnDialog(false)} disabled={isProcessingAction}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleWarnUser();
              }}
              disabled={isProcessingAction}
            >
              Send warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReports;
