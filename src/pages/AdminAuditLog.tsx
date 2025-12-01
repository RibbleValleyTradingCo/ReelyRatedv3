import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getProfilePath } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SortDirection = "asc" | "desc";
type DateRange = "24h" | "7d" | "30d" | "all";

interface AdminProfileSummary {
  id: string | null;
  username: string | null;
}

interface LogRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  user_id?: string;
  reason: string;
  details: Record<string, unknown> | null;
  created_at: string;
  admin: AdminProfileSummary | null;
}

interface ModerationLogFetchRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  user_id: string | null;
  catch_id: string | null;
  comment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_id: string | null;
  admin_username: string | null;
}

const formatRelative = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true });

const actionLabels: Record<string, string> = {
  delete_catch: "Deleted Catch",
  delete_comment: "Deleted Comment",
  warn_user: "Warned User",
  restore_catch: "Restored Catch",
  restore_comment: "Restored Comment",
  clear_moderation: "Restrictions lifted",
  suspend_user: "Suspended User",
};

const formatActionLabel = (action: string) => {
  if (actionLabels[action]) return actionLabels[action];
  const cleaned = action.replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const actionOptions = [{ label: "All actions", value: "all" as const }].concat(
  Object.entries(actionLabels).map(([value, label]) => ({ label, value }))
);

const AdminAuditLog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  const [logRows, setLogRows] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<(typeof actionOptions)[number]["value"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [page, setPage] = useState(1);
  const pageSize = 100;

  const fetchAuditLog = useCallback(async () => {
    if (!user || !isAdmin) return;
    setIsLoading(true);

    const range =
      dateRange === "24h"
        ? 1
        : dateRange === "7d"
        ? 7
        : dateRange === "30d"
        ? 30
        : null;

    const since = range ? new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString() : null;

    const { data, error } = await supabase.rpc("admin_list_moderation_log", {
      p_user_id: null,
      p_action: actionFilter === "all" ? null : actionFilter,
      p_search: searchTerm.trim() === "" ? null : searchTerm.trim(),
      p_from: since,
      p_to: null,
      p_sort_direction: sortDirection,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

    if (error) {
      toast.error("Unable to load moderation log");
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as ModerationLogFetchRow[];
    const normalized = rows.map((row) => {
      const metadata = row.metadata ?? null;
      const reason =
        metadata && typeof metadata["reason"] === "string" ? (metadata["reason"] as string) : "No reason provided";
      const targetType =
        row.target_type ??
        (row.comment_id ? "comment" : row.catch_id ? "catch" : row.user_id ? "user" : "unknown");
      const targetId = row.target_id ?? row.comment_id ?? row.catch_id ?? row.user_id ?? "";

      return {
        id: row.id,
        action: row.action,
        target_type: targetType,
        target_id: targetId,
        user_id: row.user_id ?? undefined,
        reason,
        details: metadata,
        created_at: row.created_at,
        admin:
          row.admin_id || row.admin_username
            ? { id: row.admin_id, username: row.admin_username }
            : null,
      } satisfies LogRow;
    });

    setLogRows(normalized);
    setIsLoading(false);
  }, [user, isAdmin, dateRange, page, pageSize, sortDirection]);

  useEffect(() => {
    if (isAdmin) {
      void fetchAuditLog();
    }
  }, [fetchAuditLog, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("moderation-log-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moderation_log",
        },
        () => {
          void fetchAuditLog();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAuditLog, isAdmin]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return logRows
      .filter((row) => (actionFilter === "all" ? true : row.action === actionFilter))
      .filter((row) => {
        if (!normalizedSearch) return true;

        const adminMatch = row.admin?.username?.toLowerCase().includes(normalizedSearch) ||
          row.admin?.id?.toLowerCase().includes(normalizedSearch);

        const reasonMatch = row.reason.toLowerCase().includes(normalizedSearch);
        const targetMatch = row.target_id.toLowerCase().includes(normalizedSearch);
        const detailsText = row.details ? JSON.stringify(row.details).toLowerCase() : "";
        const detailsMatch = detailsText.includes(normalizedSearch);

        return adminMatch || reasonMatch || targetMatch || detailsMatch;
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      });
  }, [actionFilter, logRows, searchTerm, sortDirection]);

  const canGoNext = logRows.length === pageSize;

  const handleViewTarget = useCallback(
    async (row: LogRow) => {
      if (row.target_type === "catch") {
        navigate(`/catch/${row.target_id}`);
        return;
      }

      if (row.target_type === "user") {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", row.target_id)
          .maybeSingle();

        navigate(getProfilePath({ username: profileRow?.username ?? null, id: row.target_id }));
        return;
      }

      if (row.target_type === "comment") {
        const { data, error } = await supabase
          .from("catch_comments")
          .select("catch_id")
          .eq("id", row.target_id)
          .maybeSingle();

        if (error || !data) {
          toast.error("Unable to open related comment");
          return;
        }

        navigate(`/catch/${data.catch_id}`);
      }
    },
    [navigate]
  );

  const resolveModerationUserId = (row: LogRow) => row.user_id ?? (row.target_type === "user" ? row.target_id : null);

  const handleViewUserModeration = useCallback(
    (row: LogRow) => {
      const targetUserId = resolveModerationUserId(row);
      if (!targetUserId) return;
      navigate(`/admin/users/${targetUserId}/moderation`, { state: { from: "audit-log" } });
    },
    [navigate]
  );

  const handleToggleSort = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
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

  const handleExportCsv = async () => {
    if (filteredRows.length === 0) {
      toast.error("No rows to export");
      return;
    }

    setIsExporting(true);
    try {
      const header = ["Timestamp", "Admin", "Action", "Target Type", "Target Id", "Reason", "Details"];
      const escapeValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

      const csv = [
        header.map(escapeValue).join(","),
        ...filteredRows.map((row) => {
          const timestamp = format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ssXXX");
          const adminName = row.admin?.username ?? row.admin?.id ?? "Unknown";
          const actionLabel = formatActionLabel(row.action);
          const reason = row.reason;
          const details = row.details ? JSON.stringify(row.details) : "";

          return [timestamp, adminName, actionLabel, row.target_type, row.target_id, reason, details]
            .map(escapeValue)
            .join(",");
        }),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moderation-log-${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Moderation log exported");
    } catch (error) {
      console.error(error);
      toast.error("Unable to export moderation log");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-3xl font-bold text-foreground">Audit log</h1>
            <p className="text-sm text-muted-foreground">
              History of moderation actions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button onClick={() => void fetchAuditLog()} disabled={isLoading} variant="ghost">
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
            <div className="w-full md:w-48">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Action</label>
              <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value as typeof actionFilter); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Date range</label>
              <Select value={dateRange} onValueChange={(value) => { setDateRange(value as DateRange); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Search</label>
              <Input
                placeholder="Search by admin, reason, target, or details"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleToggleSort}>
                Sort: {sortDirection === "asc" ? "Oldest first" : "Newest first"}
              </Button>
              <Button onClick={() => void handleExportCsv()} disabled={isExporting || filteredRows.length === 0}>
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {(dateRange !== "7d" || actionFilter !== "all" || searchTerm.trim()) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">
              {dateRange === "24h"
                ? "Last 24 hours"
                : dateRange === "7d"
                ? "Last 7 days"
                : dateRange === "30d"
                ? "Last 30 days"
                : "All time"}
            </span>
            {actionFilter !== "all" && (
              <span className="rounded-full bg-muted px-3 py-1">
                {actionFilter === "all" ? "All actions" : formatActionLabel(actionFilter)}
              </span>
            )}
            {searchTerm.trim() ? <span className="rounded-full bg-muted px-3 py-1">“{searchTerm.trim()}”</span> : null}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDateRange("7d");
                setActionFilter("all");
                setSearchTerm("");
                setPage(1);
              }}
            >
              Clear all
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading moderation log…</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moderation actions matched your filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Relative</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-24 text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const adminName = row.admin?.username ?? row.admin?.id ?? "Unknown";
                      const displayAction = formatActionLabel(row.action);
                      const detailsText = row.details ? JSON.stringify(row.details, null, 2) : "—";
                      const targetLabel =
                        row.target_type === "user"
                          ? `@${row.target_id ?? "user"}`
                          : row.target_type === "catch"
                          ? "Catch"
                          : row.target_type === "comment"
                          ? "Comment"
                          : "Unknown";

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatRelative(row.created_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-foreground">
                            {adminName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                              {displayAction}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            <div className="flex flex-col">
                              <span className="text-sm text-foreground">{targetLabel}</span>
                              {row.target_id ? <span className="font-mono text-[11px] text-muted-foreground">{row.target_id}</span> : null}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[14rem] text-sm text-foreground">
                            {row.reason}
                          </TableCell>
                          <TableCell className="max-w-[18rem] whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {detailsText}
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleViewTarget(row)}
                              disabled={row.target_type === "comment" && !row.target_id}
                            >
                              View
                            </Button>
                            {resolveModerationUserId(row) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewUserModeration(row)}
                              >
                                Moderation
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {`Showing ${filteredRows.length} action${filteredRows.length === 1 ? "" : "s"} (${dateRange === "24h" ? "Last 24 hours" : dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : "All time"}, ${actionFilter === "all" ? "All actions" : actionLabels[actionFilter] ?? actionFilter})`}
              </span>
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
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!canGoNext || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAuditLog;
