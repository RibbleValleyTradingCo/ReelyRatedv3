import type { Database } from "@/integrations/supabase/types";
import { getProfilePath } from "@/lib/profile";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const resolveNotificationPath = (notification: NotificationRow): string | null => {
  if (notification.type === "admin_report") {
    return "/admin/reports";
  }

  const extraData = (notification.extra_data ?? {}) as Record<string, unknown>;
  const catchTypes = new Set<NotificationRow["type"]>([
    "new_comment",
    "comment_reply",
    "mention",
    "new_reaction",
    "new_rating",
  ]);

  const catchIdFromExtra =
    (typeof extraData.catch_id === "string" && extraData.catch_id.length > 0
      ? extraData.catch_id
      : null) ??
    (typeof (extraData as Record<string, unknown>).catchId === "string" &&
    (extraData as Record<string, unknown>).catchId.length > 0
      ? ((extraData as Record<string, string>).catchId as string)
      : null);

  const commentIdFromExtra =
    (typeof extraData.comment_id === "string" && extraData.comment_id.length > 0
      ? extraData.comment_id
      : null) ??
    (typeof (extraData as Record<string, unknown>).commentId === "string" &&
    (extraData as Record<string, unknown>).commentId.length > 0
      ? ((extraData as Record<string, string>).commentId as string)
      : null);

  if (notification.type === "admin_moderation") {
    const action = typeof extraData.action === "string" ? extraData.action : null;
    if (action === "clear_moderation") {
      return `${getProfilePath({ id: notification.user_id })}#notifications`;
    }

    const targetCatchId = notification.catch_id ?? catchIdFromExtra;
    if (targetCatchId) {
      return `/catch/${targetCatchId}`;
    }

    const commentCatchId = catchIdFromExtra;
    if (commentCatchId) {
      return `/catch/${commentCatchId}`;
    }

    return getProfilePath({ id: notification.user_id });
  }

  if (notification.type === "admin_warning") {
    return `${getProfilePath({ id: notification.user_id })}#notifications`;
  }

  if (catchTypes.has(notification.type)) {
    const catchId = notification.catch_id ?? catchIdFromExtra;
    const commentId = notification.comment_id ?? commentIdFromExtra;
    if (catchId) {
      return commentId ? `/catch/${catchId}?commentId=${commentId}` : `/catch/${catchId}`;
    }
  }

  if (notification.actor_id) {
    const actorUsername =
      typeof extraData.actor_username === "string" ? extraData.actor_username : null;
    return getProfilePath({ username: actorUsername, id: notification.actor_id });
  }

  return null;
};
