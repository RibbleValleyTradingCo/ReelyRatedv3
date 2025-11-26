import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import ReportButton from "@/components/ReportButton";
import { getProfilePath } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";
import { useRateLimit, formatResetTime } from "@/hooks/useRateLimit";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";
import { useCatchComments, ThreadedComment } from "@/hooks/useCatchComments";

interface CatchCommentsProps {
  catchId: string;
  catchOwnerId: string;
  catchTitle?: string;
  currentUserId?: string | null;
  isAdmin?: boolean;
  targetCommentId?: string;
}

const highlightMentions = (text: string) => {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={index} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const INITIAL_VISIBLE_ROOTS = 10;
const LOAD_MORE_COUNT = 10;
const MAX_INDENT_LEVEL = 4;
const INDENT_PER_LEVEL = 12;

export const CatchComments = memo(
  ({ catchId, catchOwnerId, catchTitle, currentUserId, isAdmin = false, targetCommentId }: CatchCommentsProps) => {
    const { user } = useAuth();
    const { commentsTree, isLoading, refetch, addLocalComment, markLocalCommentDeleted } = useCatchComments(catchId);
    const [newComment, setNewComment] = useState("");
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [activeReply, setActiveReply] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
    const [visibleRootCount, setVisibleRootCount] = useState(INITIAL_VISIBLE_ROOTS);

    const { checkLimit, isLimited, attemptsRemaining, resetIn } = useRateLimit({
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
      storageKey: "comment-submit-limit",
      onLimitExceeded: () => {
        const resetTime = formatResetTime(resetIn);
        toast.error(`Rate limit exceeded. You can only post 30 comments per hour. Try again in ${resetTime}.`);
      },
    });

    const mentionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const handleCreateComment = useCallback(
      async (body: string, parentCommentId: string | null) => {
        if (!currentUserId) {
          toast.error("You need to sign in to comment.");
          return false;
        }
        const trimmed = body.trim();
        if (!trimmed) return false;

        if (!checkLimit()) {
          return false;
        }

        setIsPosting(true);
        const { data: insertedCommentId, error } = await supabase.rpc("create_comment_with_rate_limit", {
          p_catch_id: catchId,
          p_body: trimmed,
          p_parent_comment_id: parentCommentId,
        });

        if (error) {
          if (isRateLimitError(error)) {
            toast.error(getRateLimitMessage(error));
          } else if (error.message?.includes("Catch is not accessible")) {
            toast.error("You don't have access to comment on this catch");
          } else if (error.message?.includes("Parent comment")) {
            toast.error("Unable to reply to that comment");
          } else {
            toast.error("Failed to post comment");
          }
          setIsPosting(false);
          return false;
        }

        const nowIso = new Date().toISOString();
        addLocalComment({
          id: insertedCommentId ?? crypto.randomUUID(),
          catch_id: catchId,
          user_id: currentUserId,
          body: trimmed,
          parent_comment_id: parentCommentId,
          created_at: nowIso,
          updated_at: nowIso,
          deleted_at: null,
          profiles: {
            id: currentUserId,
            username: user?.user_metadata?.username ?? user?.email ?? "Someone",
            avatar_path: user?.user_metadata?.avatar_path ?? null,
            avatar_url: user?.user_metadata?.avatar_url ?? null,
          },
        });

        void refetch();
        setIsPosting(false);
        return true;
      },
      [addLocalComment, catchId, checkLimit, currentUserId, refetch, user?.user_metadata?.avatar_path, user?.user_metadata?.avatar_url, user?.user_metadata?.username]
    );

    const handleDelete = useCallback(
      async (commentId: string) => {
        setDeleteLoadingId(commentId);
        const { error } = await supabase.rpc("soft_delete_comment", {
          p_comment_id: commentId,
        });
        if (error) {
          toast.error("Failed to delete comment");
        } else {
          markLocalCommentDeleted(commentId);
          void refetch();
        }
        setDeleteLoadingId(null);
      },
      [markLocalCommentDeleted, refetch]
    );

    const topLevelSubmit = async () => {
      const success = await handleCreateComment(newComment, null);
      if (success) {
        setNewComment("");
      }
    };

    const replySubmit = async (commentId: string) => {
      const body = replyDrafts[commentId] ?? "";
      const success = await handleCreateComment(body, commentId);
      if (success) {
        setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
        setActiveReply(null);
      }
    };

    const renderComment = (comment: ThreadedComment, depth = 0): JSX.Element => {
      const isOwner = currentUserId === comment.user_id;
      const canDelete = (isOwner || isAdmin) && !comment.deleted_at;
      const isDeleted = Boolean(comment.deleted_at);
      const replyDraft = replyDrafts[comment.id] ?? "";
      const indentLevel = Math.min(depth, MAX_INDENT_LEVEL);
      const indentPx = indentLevel * INDENT_PER_LEVEL;

      return (
        <div key={comment.id} id={`comment-${comment.id}`} className="flex w-full min-w-0 py-2">
          <div className="flex gap-3 w-full min-w-0" style={{ paddingLeft: indentPx }}>
            <Link
              to={getProfilePath({ username: comment.profiles?.username, id: comment.user_id })}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full shrink-0"
              aria-label={`View ${comment.profiles?.username ?? "angler"}'s profile`}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={
                    resolveAvatarUrl({
                      path: comment.profiles?.avatar_path ?? null,
                      legacyUrl: comment.profiles?.avatar_url ?? null,
                    }) ?? ""
                  }
                />
                <AvatarFallback>{comment.profiles?.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Link
                  to={getProfilePath({ username: comment.profiles?.username, id: comment.user_id })}
                  className="font-semibold text-foreground hover:text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                >
                  {comment.profiles?.username ?? "Unknown angler"}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {isDeleted && <span className="text-xs text-muted-foreground">(deleted)</span>}
              </div>
              <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-foreground">
                {isDeleted ? (
                  isAdmin ? (
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">(deleted)</span>
                      <div className="text-foreground">{highlightMentions(comment.body)}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Comment deleted</span>
                  )
                ) : (
                  highlightMentions(comment.body)
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {!isDeleted && (
                  <button
                    type="button"
                    className="hover:text-foreground transition"
                    onClick={() => setActiveReply((prev) => (prev === comment.id ? null : comment.id))}
                  >
                    Reply
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="hover:text-destructive transition disabled:opacity-50"
                    onClick={() => void handleDelete(comment.id)}
                    disabled={deleteLoadingId === comment.id}
                  >
                    {deleteLoadingId === comment.id ? "Removing…" : "Delete"}
                  </button>
                )}
                <ReportButton
                  targetType="comment"
                  targetId={comment.id}
                  label="Report"
                  className="text-destructive hover:text-destructive"
                />
              </div>
              {activeReply === comment.id && !isDeleted && (
                <div className="space-y-2">
                  <Textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                    rows={3}
                    className="w-full"
                    placeholder={`Reply to ${comment.profiles?.username ?? "this comment"}…`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void replySubmit(comment.id)} disabled={isPosting}>
                      {isPosting ? "Posting…" : "Post reply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveReply(null);
                        setReplyDrafts((prev) => ({ ...prev, [comment.id]: "" }));
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {comment.children.length > 0 && (
                <div className="space-y-3">
                  {comment.children.map((child) => renderComment(child, depth + 1))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    const topLevelComments = useMemo(() => commentsTree, [commentsTree]);
    const visibleRoots = useMemo(
      () => topLevelComments.slice(0, visibleRootCount),
      [topLevelComments, visibleRootCount]
    );

    useEffect(() => {
      if (!targetCommentId) return;
      const rootIndex = topLevelComments.findIndex((root) => {
        const stack = [root];
        while (stack.length) {
          const node = stack.pop()!;
          if (node.id === targetCommentId) return true;
          stack.push(...node.children);
        }
        return false;
      });
      if (rootIndex >= 0 && rootIndex >= visibleRootCount) {
        setVisibleRootCount((count) => Math.max(count, rootIndex + 1));
      }
    }, [targetCommentId, topLevelComments, visibleRootCount]);

    const hasScrolledRef = useRef<string | null>(null);

    useEffect(() => {
      if (!targetCommentId) {
        hasScrolledRef.current = null;
        return;
      }
      const el = document.getElementById(`comment-${targetCommentId}`);
      if (el && hasScrolledRef.current !== targetCommentId) {
        hasScrolledRef.current = targetCommentId;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring",
          "ring-primary/30",
          "ring-offset-2",
          "ring-offset-background",
          "bg-primary/5",
          "rounded-lg",
          "shadow-sm",
          "transition"
        );
        const timeout = setTimeout(() => {
          el.classList.remove(
            "ring",
            "ring-primary/30",
            "ring-offset-2",
            "ring-offset-background",
            "bg-primary/5",
            "rounded-lg",
            "shadow-sm",
            "transition"
          );
        }, 2500);
        return () => clearTimeout(timeout);
      }
    }, [targetCommentId, commentsTree, visibleRootCount, visibleRoots.length]);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentUserId && (
            <div className="space-y-3">
              <Textarea
                ref={mentionTextareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void topLevelSubmit()}
                  disabled={isPosting || isLimited}
                  title={isLimited ? `Rate limited. Reset in ${formatResetTime(resetIn)}` : ""}
                >
                  {isPosting
                    ? "Posting…"
                    : isLimited
                    ? `Limited (${formatResetTime(resetIn)})`
                    : attemptsRemaining < 30
                    ? `Post Comment (${attemptsRemaining} left)`
                    : "Post Comment"}
                </Button>
              </div>
            </div>
          )}

          {isLoading && commentsTree.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          ) : topLevelComments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to share one!</p>
          ) : (
            <div className="space-y-4 overflow-x-hidden">
              {visibleRoots.map((comment) => renderComment(comment))}
              {visibleRootCount < topLevelComments.length && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleRootCount((count) => count + LOAD_MORE_COUNT)}
                  >
                    Load more comments
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

CatchComments.displayName = "CatchComments";
