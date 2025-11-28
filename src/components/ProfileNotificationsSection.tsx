import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { resolveNotificationPath } from "@/lib/notifications-utils";
import { isAdminUser } from "@/lib/admin";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface ProfileNotificationsSectionProps {
  userId: string | null;
}

export const ProfileNotificationsSection = ({ userId }: ProfileNotificationsSectionProps) => {
  const { user } = useAuth();
  const {
    notifications,
    loading,
    refresh,
    markOne,
    markAll,
    clearAll,
  } = useNotifications(userId, 50);
  const navigate = useNavigate();
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState<{
    moderation_status: string;
    warn_count: number;
    suspension_until: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [refresh, userId]);

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      if (!user) {
        setIsAdminViewer(false);
        return;
      }
      const result = await isAdminUser(user.id);
      if (active) {
        setIsAdminViewer(result);
      }
    };
    void checkAdmin();
    return () => {
      active = false;
    };
  }, [user, userId]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!userId) {
        setStatus(null);
        return;
      }
      setStatusLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("moderation_status, warn_count, suspension_until")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setStatus({
          moderation_status: data.moderation_status ?? "active",
          warn_count: data.warn_count ?? 0,
          suspension_until: data.suspension_until ?? null,
        });
      } else {
        setStatus(null);
      }
      setStatusLoading(false);
    };
    void fetchStatus();
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  if (!userId) {
    return null;
  }

  const statusState = status?.moderation_status ?? "active";
  const statusLabel = (() => {
    if (statusState === "suspended" && status?.suspension_until) {
      return `Suspended until ${new Date(status.suspension_until).toLocaleString()}`;
    }
    if (statusState === "suspended") return "Suspended";
    if (statusState === "banned") return "Banned";
    if (statusState === "warned" || (statusState === "active" && (status?.warn_count ?? 0) > 0)) return "Warned";
    return "Active";
  })();
  const statusMessage = (() => {
    if (statusState === "banned") {
      return "Your account is banned. You can’t post catches or comments.";
    }
    if (statusState === "suspended") {
      return "Your account is suspended and posting is blocked until the suspension ends.";
    }
    if (statusState === "warned" || (statusState === "active" && (status?.warn_count ?? 0) > 0)) {
      return "You’ve received a warning. Please follow community guidelines to avoid restrictions.";
    }
    return "You’re in good standing. Keep following the community guidelines.";
  })();

  const showStatusCard =
    !statusLoading &&
    status &&
    (statusState !== "active" || (status.warn_count ?? 0) > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {showStatusCard ? (
        <Card className="border border-slate-200 bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Account status</CardTitle>
            <CardDescription>Summary of moderation affecting your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{statusLabel}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                Warnings: {status?.warn_count ?? 0}/3
              </span>
            </div>
            {statusState === "suspended" && status?.suspension_until ? (
              <p className="text-sm text-slate-700">
                You’re currently suspended and can’t post new catches or comments until{" "}
                {new Date(status.suspension_until).toLocaleString()}.
              </p>
            ) : statusState === "banned" ? (
              <p className="text-sm text-slate-700">
                Your account is banned and you can’t post new catches or comments.
              </p>
            ) : statusState === "warned" || (statusState === "active" && (status?.warn_count ?? 0) > 0) ? (
              <p className="text-sm text-slate-700">
                You can keep posting, but please follow community guidelines.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 md:col-span-1" />
      )}

      <Card className="border border-slate-200 bg-white/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">Notifications</CardTitle>
            <CardDescription>Activity from anglers and admins related to your catches.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
              Unread: {unreadCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refresh();
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Refreshing
                </>
              ) : (
                "Refresh"
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (unreadCount > 0) {
                  void markAll();
                }
              }}
              disabled={unreadCount === 0}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                void clearAll();
              }}
              disabled={notifications.length === 0}
            >
              Clear all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No notifications yet. Activity on your catches will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onView={(current) => {
                    const destination = resolveNotificationPath(current);
                    if (destination) {
                      const extraData = (current.extra_data ?? {}) as Record<string, unknown>;
                      const targetId =
                        typeof extraData.target_id === "string" && extraData.target_id.length > 0
                          ? (extraData.target_id as string)
                          : null;
                      if (current.type === "admin_report") {
                        navigate(destination, { state: targetId ? { filterUserId: targetId } : undefined });
                      } else {
                        navigate(destination);
                      }
                    }
                    void markOne(current.id);
                  }}
                  onMarkRead={(current) => {
                    void markOne(current.id);
                  }}
                  isAdminViewer={isAdminViewer}
                  onModerationView={(moderationUserId) => navigate(`/admin/users/${moderationUserId}/moderation`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
