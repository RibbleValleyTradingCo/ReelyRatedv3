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
    "mention",
    "new_reaction",
    "new_rating",
  ]);

  const catchIdFromExtra =
    typeof extraData.catch_id === "string" && extraData.catch_id.length > 0
      ? extraData.catch_id
      : null;
  const commentIdFromExtra =
    typeof extraData.comment_id === "string" && extraData.comment_id.length > 0
      ? extraData.comment_id
      : null;

  if (notification.type === "admin_moderation") {
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
    return getProfilePath({ id: notification.user_id });
  }

  if (catchTypes.has(notification.type)) {
    const catchId = notification.catch_id ?? catchIdFromExtra;
    if (catchId) {
      return `/catch/${catchId}`;
    }
  }

  if (notification.actor_id) {
    const actorUsername =
      typeof extraData.actor_username === "string" ? extraData.actor_username : null;
    return getProfilePath({ username: actorUsername, id: notification.actor_id });
  }

  return null;
};
