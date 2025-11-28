import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  Star,
  MessageCircle,
  UserPlus,
  ShieldCheck,
  Bell,
  Sparkles,
} from "lucide-react";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// User-facing labels and copy for moderation notifications (kept here to avoid exposing raw enums)

interface NotificationListItemProps {
  notification: NotificationRow;
  onView: (notification: NotificationRow) => void;
  onMarkRead: (notification: NotificationRow) => void;
  isAdminViewer?: boolean;
  onModerationView?: (userId: string) => void;
}

const mapSeverityLabel = (severity: string | null) => {
  if (!severity) return null;
  if (severity === "warning") return "Warning";
  if (severity === "temporary_suspension") return "Temporary suspension";
  if (severity === "permanent_ban") return "Permanent ban";
  return severity.replace("_", " ");
};

const getNotificationTitle = (notification: NotificationRow, extraData: Record<string, unknown>) => {
  const type = notification.type;
  if (type === "admin_warning") {
    const severity = typeof extraData.severity === "string" ? extraData.severity : null;
    if (severity === "temporary_suspension") return "Your account is temporarily suspended";
    if (severity === "permanent_ban") return "Your account has been banned";
    return "You’ve received a warning from the moderators";
  }

  if (type === "admin_moderation") {
    const action = typeof extraData.action === "string" ? extraData.action : null;
    if (action === "clear_moderation") {
      return "Your account restrictions have been lifted";
    }
    return "Admin moderation";
  }

  switch (type) {
    case "new_follower":
      return "New follower";
    case "new_comment":
      return "New comment";
    case "new_reaction":
      return "New like";
    case "new_rating":
      return "New rating";
    case "mention":
      return "Mention";
    case "comment_reply":
      return "Comment reply";
    case "admin_report":
      return "New report";
    default:
      return "Notification";
  }
};

const formatAdminDetails = (notification: NotificationRow, extraData: Record<string, unknown>) => {
  if (notification.type === "admin_warning") {
    const severityLabel = mapSeverityLabel(typeof extraData.severity === "string" ? extraData.severity : null);
    const duration =
      typeof extraData.duration_hours === "number" && extraData.duration_hours > 0
        ? `${extraData.duration_hours}h`
        : null;
    if (severityLabel && duration) {
      return `${severityLabel} · ${duration}`;
    }
    if (severityLabel) {
      return severityLabel;
    }
    if (duration) {
      return duration;
    }
  }

  if (notification.type === "admin_moderation") {
    const action = typeof extraData.action === "string" ? extraData.action : null;
    const reason = typeof extraData.reason === "string" ? extraData.reason : null;

    if (action === "clear_moderation") {
      return reason ? `Restrictions lifted · ${reason}` : "Restrictions lifted";
    }

    if (action && reason) {
      return `${action.replace("_", " ")}: ${reason}`;
    }
    if (reason) {
      return reason;
    }
  }

  return null;
};

export const NotificationListItem = ({
  notification,
  onView,
  onMarkRead,
  isAdminViewer = false,
  onModerationView,
}: NotificationListItemProps) => {
  const extraData = (notification.extra_data ?? {}) as Record<string, unknown>;
  const adminDetail = formatAdminDetails(notification, extraData);
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });
  const actorUsername =
    typeof extraData.actor_username === "string" && extraData.actor_username.trim().length > 0
      ? extraData.actor_username
      : null;
  const severity = typeof extraData.severity === "string" ? extraData.severity : null;
  const severityLabel = mapSeverityLabel(severity);
  const suspensionUntil =
    typeof extraData.suspension_until === "string" ? extraData.suspension_until : null;
  const moderationAction = typeof extraData.action === "string" ? extraData.action : null;
  const reason =
    typeof extraData.reason === "string" && extraData.reason.trim().length > 0
      ? extraData.reason
      : null;
  const typeIcon = (() => {
    if (notification.type === "new_rating") return <Star className="h-4 w-4" />;
    if (notification.type === "new_comment" || notification.type === "comment_reply" || notification.type === "mention") return <MessageCircle className="h-4 w-4" />;
    if (notification.type === "new_follower") return <UserPlus className="h-4 w-4" />;
    if (notification.type === "admin_warning" || notification.type === "admin_moderation") return <ShieldCheck className="h-4 w-4" />;
    if (notification.type === "admin_report") return <Bell className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  })();

  let message: string;
  if (notification.type === "admin_warning") {
    if (severity === "temporary_suspension") {
      message = `You can't post until ${
        suspensionUntil ? new Date(suspensionUntil).toLocaleString() : "your suspension ends"
      }.${reason ? ` Reason: ${reason}` : ""}`;
    } else if (severity === "permanent_ban") {
      message = `You can no longer post catches or comments.${reason ? ` Reason: ${reason}` : ""}`;
    } else {
      message = reason ? `Reason: ${reason}` : "Please follow community guidelines.";
    }
  } else if (notification.type === "admin_moderation" && moderationAction === "clear_moderation") {
    message = reason ? `You can post again. Reason: ${reason}` : "You can post again.";
  } else {
    message =
      typeof notification.message === "string" && notification.message.trim().length > 0
        ? notification.message
        : notification.type === "mention"
          ? `${actorUsername ? `@${actorUsername} ` : "Someone "}mentioned you in a comment.`
          : notification.type === "comment_reply"
            ? `${actorUsername ? `@${actorUsername} ` : "Someone "}replied to your comment.`
            : "You have a new notification.";
  }

  const moderatedUserId = notification.user_id ?? null;
  const showModerationLink =
    isAdminViewer &&
    moderatedUserId &&
    (notification.type === "admin_warning" || notification.type === "admin_moderation");

  const title = getNotificationTitle(notification, extraData);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/40 bg-card/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm",
        !notification.is_read && "border-primary/40 bg-primary/5"
      )}
      role="button"
      tabIndex={0}
      onClick={() => onView(notification)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(notification);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground")}>
          {typeIcon}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn("text-xs uppercase tracking-wide", !notification.is_read ? "text-foreground" : "text-muted-foreground")}>
                {title}
              </p>
              <p className="mt-1 text-sm text-foreground line-clamp-2">
                {actorUsername ? (
                  <span className="font-semibold text-foreground">@{actorUsername}</span>
                ) : null}
                {actorUsername ? " · " : null}
                {severityLabel && notification.type === "admin_warning" ? (
                  <span className="font-semibold text-foreground">{severityLabel}: </span>
                ) : null}
                {message}
              </p>
              {adminDetail ? (
                <p className="text-xs text-muted-foreground mt-1">{adminDetail}</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</p>
          </div>
          {showModerationLink ? (
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (moderatedUserId) {
                  onModerationView?.(moderatedUserId);
                }
              }}
            >
              View moderation
            </button>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary px-2"
            onClick={(e) => {
              e.stopPropagation();
              onView(notification);
            }}
          >
            View
          </Button>
          {notification.is_read ? (
            <span className="text-xs text-muted-foreground">Read</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification);
              }}
            >
              Mark read
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export type { NotificationRow };
