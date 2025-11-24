import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

export type NotificationPayload = {
  message: string;
  catchId?: string;
  commentId?: string;
  extraData?: Record<string, unknown>;
};

interface CreateNotificationParams {
  userId: string;
  actorId?: string | null;
  type: NotificationInsert["type"];
  payload: NotificationPayload;
}

const serializeExtraData = (input?: Record<string, unknown>): Json | null => {
  if (!input || Object.keys(input).length === 0) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(input)) as Json;
  } catch (error) {
    logger.error("Failed to serialise notification extra data", error);
    return null;
  }
};

export const createNotification = async ({ userId, actorId = null, type, payload }: CreateNotificationParams) => {
  try {
    if (!userId || !type || !payload?.message) {
      return;
    }

    const { data, error } = await supabase.rpc("create_notification", {
      p_user_id: userId,
      p_actor_id: actorId,
      p_type: type,
      p_message: payload.message,
      p_catch_id: payload.catchId ?? null,
      p_comment_id: payload.commentId ?? null,
      p_extra_data: serializeExtraData(payload.extraData),
    });

    if (error) {
      // Ignore duplicate key errors from dedupe upsert to avoid spamming logs/toasts.
      if (error.code === "23505") {
        return data;
      }
      console.error("Failed to create notification", error, { userId, type });
      logger.error("Failed to create notification", error, { userId, type });
    } else if (data && typeof data === "string") {
      return data;
    }
  } catch (error) {
    console.error("Unexpected error creating notification", error, { userId, type });
    logger.error("Unexpected error creating notification", error, { userId, type });
  }
};

export const fetchNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch notifications", error, { userId, limit });
    return [] as NotificationRow[];
  }

  return (data as NotificationRow[]) ?? [];
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to mark notification as read", error, { notificationId, userId });
  }
  return data as NotificationRow[] | null;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    logger.error("Failed to mark all notifications as read", error, { userId });
  }
  return data as NotificationRow[] | null;
};

export const clearAllNotifications = async (userId: string) => {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId);

  if (error) {
    logger.error("Failed to clear notifications", error, { userId });
  }
  return !error;
};

let cachedAdminIds: string[] | null = null;

const loadAdminUserIds = async () => {
  if (cachedAdminIds) {
    return cachedAdminIds;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Failed to load admin users", error);
    cachedAdminIds = [];
    return cachedAdminIds;
  }

  cachedAdminIds = (data ?? [])
    .map((row) => row.user_id)
    .filter((value): value is string => Boolean(value));

  return cachedAdminIds;
};

export const notifyAdmins = async (data: NotificationInsert["data"]) => {
  const adminIds = await loadAdminUserIds();

  if (adminIds.length === 0) {
    logger.warn("No admin users configured to receive notifications");
    return;
  }

  await Promise.all(
    adminIds.map((adminId) =>
      createNotification({
        userId: adminId,
        type: "admin_report",
        payload: {
          message: data?.message ?? "A new report has been submitted.",
          extraData: data ?? undefined,
        },
      })
    )
  );
};
