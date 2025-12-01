import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveAvatarUrl } from "@/lib/storage";
import { getProfilePath } from "@/lib/profile";

type WarningRow = {
  id: string;
  reason: string;
  severity: string;
  duration_hours: number | null;
  created_at: string;
  admin: { id: string | null; username: string | null } | null;
};

type ModerationLogRow = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin: { id: string | null; username: string | null } | null;
};

const formatRelative = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true });
const truncate = (value: string, max = 120) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const AdminUserModeration = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  const [profileStatus, setProfileStatus] = useState<{
    username: string | null;
    warn_count: number;
    moderation_status: string;
    suspension_until: string | null;
    avatar_path: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [logRows, setLogRows] = useState<ModerationLogRow[]>([]);
  const [warningsPage, setWarningsPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [warningsHasMore, setWarningsHasMore] = useState(true);
  const [logHasMore, setLogHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showWarnDialog, setShowWarnDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showLiftDialog, setShowLiftDialog] = useState(false);
  const [warnReason, setWarnReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState("24");
  const [banReason, setBanReason] = useState("");
  const [liftReason, setLiftReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !isAdmin || !userId) return;
    setIsLoading(true);
    const warningsLimit = 20;
    const logLimit = 20;

    const [profileResp, warningsResp, logResp] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, warn_count, moderation_status, suspension_until, avatar_path, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_warnings")
        .select("id, reason, severity, duration_hours, created_at, admin:issued_by (id, username)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range((warningsPage - 1) * warningsLimit, warningsPage * warningsLimit - 1),
      supabase.rpc("admin_list_moderation_log", {
        p_user_id: userId,
        p_action: null,
        p_search: null,
        p_from: null,
        p_to: null,
        p_sort_direction: "desc",
        p_limit: logLimit,
        p_offset: (logPage - 1) * logLimit,
      }),
    ]);

    if (profileResp.error) {
      toast.error("Unable to load user moderation status");
    }
    if (warningsResp.error) {
      toast.error("Unable to load warnings");
    }
    if (logResp.error) {
      toast.error("Unable to load moderation history");
    }

    if (profileResp.data) {
      setProfileStatus({
        username: profileResp.data.username,
        warn_count: profileResp.data.warn_count ?? 0,
        moderation_status: profileResp.data.moderation_status ?? "active",
        suspension_until: profileResp.data.suspension_until ?? null,
        avatar_path: profileResp.data.avatar_path ?? null,
        avatar_url: profileResp.data.avatar_url ?? null,
      });
    } else {
      setProfileStatus(null);
    }

    const warningRows = (warningsResp.data as WarningRow[]) ?? [];
    setWarnings((prev) => (warningsPage === 1 ? warningRows : [...prev, ...warningRows]));
    setWarningsHasMore(warningRows.length === warningsLimit);

    const mappedLog = ((logResp.data as ModerationLogRow[]) ?? []).map((row) => {
      const metadata = row.metadata ?? {};
      const reason = typeof metadata["reason"] === "string" ? (metadata["reason"] as string) : "No reason provided";
      return { ...row, reason } satisfies ModerationLogRow;
    });
    setLogRows((prev) => (logPage === 1 ? mappedLog : [...prev, ...mappedLog]));
    setLogHasMore(mappedLog.length === logLimit);

    setIsLoading(false);
  }, [isAdmin, user, userId, warningsPage, logPage]);

  useEffect(() => {
    setWarningsPage(1);
    setLogPage(1);
    setWarningsHasMore(true);
    setLogHasMore(true);
  }, [userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const warningsTable = useMemo(() => {
    if (warnings.length === 0) {
      return <p className="text-sm text-muted-foreground">No warnings issued yet.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issued</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warnings.map((warning) => (
              <TableRow key={warning.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatRelative(warning.created_at)}
                </TableCell>
                <TableCell className="text-sm font-medium capitalize">{warning.severity.replace("_", " ")}</TableCell>
                <TableCell className="text-sm text-foreground">
                  <span title={warning.reason} className="block max-w-[24rem] truncate">
                    {truncate(warning.reason, 120)}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {warning.duration_hours ? `${warning.duration_hours}h` : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {warning.admin?.id ? (
                    <Link
                      to={`/admin/users/${warning.admin.id}/moderation`}
                      className="text-primary hover:underline"
                    >
                      {warning.admin.username ?? warning.admin.id}
                    </Link>
                  ) : (
                    warning.admin?.username ?? warning.admin?.id ?? "Unknown"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {warningsHasMore && (
          <div className="mt-3 text-right">
            <Button variant="outline" size="sm" onClick={() => setWarningsPage((prev) => prev + 1)}>
              Load more warnings
            </Button>
          </div>
        )}
      </div>
    );
  }, [warnings, warningsHasMore]);

  const logTable = useMemo(() => {
    if (logRows.length === 0) {
      return <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logRows.map((row) => {
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
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatRelative(row.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                      {row.action}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{targetLabel}</span>
                      {row.target_id ? (
                        <span className="font-mono text-[11px] text-muted-foreground">{row.target_id}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    <span title={row.reason} className="block max-w-[24rem] truncate">
                      {truncate(row.reason, 120)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.admin?.id ? (
                      <Link
                        to={`/admin/users/${row.admin.id}/moderation`}
                        className="text-primary hover:underline"
                      >
                        {row.admin.username ?? row.admin.id}
                      </Link>
                    ) : (
                      row.admin?.username ?? row.admin?.id ?? "Unknown"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {logHasMore && (
          <div className="mt-3 text-right">
            <Button variant="outline" size="sm" onClick={() => setLogPage((prev) => prev + 1)}>
              Load more history
            </Button>
          </div>
        )}
      </div>
    );
  }, [logRows, logHasMore]);

  const applyModerationAction = useCallback(
    async (params: {
      severity: "warning" | "temporary_suspension" | "permanent_ban";
      reason: string;
      durationHours?: number;
    }) => {
      if (!userId) {
        toast.error("User not found");
        return;
      }
      const trimmed = params.reason.trim();
      if (!trimmed) {
        toast.error("Please provide a reason");
        return;
      }
      if (params.severity === "temporary_suspension") {
        if (!params.durationHours || Number.isNaN(params.durationHours) || params.durationHours <= 0) {
          toast.error("Enter a valid suspension duration in hours");
          return;
        }
      }

      setActionLoading(true);
      try {
        const payload: Record<string, unknown> = {
          p_user_id: userId,
          p_reason: trimmed,
          p_severity: params.severity,
        };
        if (params.severity === "temporary_suspension" && params.durationHours) {
          payload.p_duration_hours = params.durationHours;
        }

        const { error } = await supabase.rpc("admin_warn_user", payload);
        if (error) throw error;

        const successMessage =
          params.severity === "warning"
            ? "Warning recorded"
            : params.severity === "temporary_suspension"
            ? "Temporary suspension applied"
            : "User banned";
        toast.success(successMessage);
        setShowWarnDialog(false);
        setShowSuspendDialog(false);
        setShowBanDialog(false);
        setWarnReason("");
        setSuspendReason("");
        setSuspendDuration("24");
        setBanReason("");
        await fetchData();
      } catch (error) {
        console.error(error);
        toast.error("Unable to apply moderation action");
      } finally {
        setActionLoading(false);
      }
    },
    [fetchData, userId]
  );

  const handleLiftRestrictions = useCallback(async () => {
    if (!userId) {
      toast.error("User not found");
      return;
    }
    const trimmed = liftReason.trim();
    if (!trimmed) {
      toast.error("Please provide a reason");
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("admin_clear_moderation_status", {
        p_user_id: userId,
        p_reason: trimmed,
      });
      if (error) throw error;
      toast.success("Restrictions lifted");
      setShowLiftDialog(false);
      setLiftReason("");
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Unable to lift restrictions");
    } finally {
      setActionLoading(false);
    }
  }, [fetchData, liftReason, userId]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const backDestination = (() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from === "reports") return "/admin/reports";
    if (from === "audit-log") return "/admin/audit-log";
    if (profileStatus?.username || userId) {
      return `/profile/${profileStatus?.username ?? userId}`;
    }
    return "/feed";
  })();

  const displayName = profileStatus?.username ? `@${profileStatus.username}` : userId ?? "user";
  const avatarUrl = resolveAvatarUrl({
    path: profileStatus?.avatar_path ?? null,
    legacyUrl: profileStatus?.avatar_url ?? null,
  });
  const currentStatus = profileStatus?.moderation_status ?? "active";
  const isSuspended = currentStatus === "suspended";
  const isBanned = currentStatus === "banned";
  const canApplyStandardActions = currentStatus === "active" || currentStatus === "warned";

  const moderationStatusLabel = (() => {
    if (currentStatus === "suspended" && profileStatus?.suspension_until) {
      return `Suspended until ${new Date(profileStatus.suspension_until).toLocaleString()}`;
    }
    if (currentStatus === "banned") return "Banned";
    if (currentStatus === "warned") return "Warned";
    return "Active";
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-3xl font-bold text-foreground">Moderation for {displayName}</h1>
            <p className="text-sm text-muted-foreground">
              Moderation overview and actions for this user.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(backDestination)}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarUrl ?? ""} alt={displayName} />
              <AvatarFallback>{profileStatus?.username?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <span>{profileStatus?.username ?? "Unknown user"}</span>
                <span className="text-xs font-normal text-muted-foreground">({userId})</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    (profileStatus?.moderation_status ?? "active") === "active"
                      ? "bg-muted text-foreground"
                      : (profileStatus?.moderation_status ?? "active") === "warned"
                      ? "bg-amber-50 text-amber-700"
                      : (profileStatus?.moderation_status ?? "active") === "suspended"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {moderationStatusLabel}
                </span>
                <span>Warnings: {profileStatus?.warn_count ?? 0}/3</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {profileStatus?.username || userId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={getProfilePath({ username: profileStatus?.username ?? null, id: userId ?? undefined })}>
                      View profile
                    </Link>
                  </Button>
                ) : null}
                {userId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/admin/reports?reportedUserId=${userId}`, {
                        state: { filterUserId: userId, filterUsername: profileStatus?.username ?? null },
                      })
                    }
                  >
                    View reports about this user
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Moderation actions</span>
                <div className="flex flex-wrap gap-2">
                  {canApplyStandardActions ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setShowWarnDialog(true)}
                        disabled={actionLoading || isLoading || !userId}
                      >
                        Warn user
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSuspendDialog(true)}
                        disabled={actionLoading || isLoading || !userId}
                      >
                        Temporary suspension
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowBanDialog(true)}
                        disabled={actionLoading || isLoading || !userId}
                      >
                        Ban user
                      </Button>
                    </>
                  ) : null}
                  {isSuspended ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowBanDialog(true)}
                        disabled={actionLoading || isLoading || !userId}
                      >
                        Escalate to ban
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowLiftDialog(true)}
                        disabled={actionLoading || isLoading || !userId}
                      >
                        Lift restrictions
                      </Button>
                    </>
                  ) : null}
                  {isBanned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLiftDialog(true)}
                      disabled={actionLoading || isLoading || !userId}
                    >
                      Lift restrictions
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : profileStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">User</span>
                  <span className="font-medium">{profileStatus.username ?? userId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Moderation status</span>
                  <span className="font-semibold capitalize">{profileStatus.moderation_status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Warnings</span>
                  <span className="font-semibold">{profileStatus.warn_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Suspension until</span>
                  <span className="font-semibold">
                    {profileStatus.suspension_until ? new Date(profileStatus.suspension_until).toLocaleString() : "—"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-destructive">User not found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              warningsTable
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moderation history</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              logTable
            )}
          </CardContent>
        </Card>

        <Dialog open={showWarnDialog} onOpenChange={(open) => !actionLoading && setShowWarnDialog(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Warn user</DialogTitle>
              <DialogDescription>Send a warning to this user with a brief reason.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="warn-reason">Reason</Label>
              <Textarea
                id="warn-reason"
                value={warnReason}
                onChange={(event) => setWarnReason(event.target.value)}
                rows={3}
                placeholder="Explain why this warning is being issued"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWarnDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={() => void applyModerationAction({ severity: "warning", reason: warnReason })}
                disabled={actionLoading}
              >
                Send warning
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSuspendDialog} onOpenChange={(open) => !actionLoading && setShowSuspendDialog(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Temporary suspension</DialogTitle>
              <DialogDescription>Temporarily suspend this user for a set number of hours.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">Reason</Label>
                <Textarea
                  id="suspend-reason"
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.target.value)}
                  rows={3}
                  placeholder="Explain why this suspension is being applied"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suspend-duration">Duration (hours)</Label>
                <Input
                  id="suspend-duration"
                  type="number"
                  min={1}
                  value={suspendDuration}
                  onChange={(event) => setSuspendDuration(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuspendDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  void applyModerationAction({
                    severity: "temporary_suspension",
                    reason: suspendReason,
                    durationHours: parseInt(suspendDuration, 10),
                  })
                }
                disabled={actionLoading}
              >
                Apply suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showBanDialog} onOpenChange={(open) => !actionLoading && setShowBanDialog(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ban user</DialogTitle>
              <DialogDescription>Permanently ban this user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="ban-reason">Reason</Label>
              <Textarea
                id="ban-reason"
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                rows={3}
                placeholder="Explain why this ban is being applied"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBanDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void applyModerationAction({ severity: "permanent_ban", reason: banReason })}
                disabled={actionLoading}
              >
                Ban user
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLiftDialog} onOpenChange={(open) => !actionLoading && setShowLiftDialog(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lift restrictions</DialogTitle>
              <DialogDescription>Clear the current suspension or ban and return the user to active status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="lift-reason">Reason</Label>
              <Textarea
                id="lift-reason"
                value={liftReason}
                onChange={(event) => setLiftReason(event.target.value)}
                rows={3}
                placeholder="Add a short note for the moderation log"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLiftDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={() => void handleLiftRestrictions()} disabled={actionLoading}>
                Confirm lift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminUserModeration;
