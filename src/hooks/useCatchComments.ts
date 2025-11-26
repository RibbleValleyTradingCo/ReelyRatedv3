import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CatchComment {
  id: string;
  catch_id: string;
  user_id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles: {
    id: string;
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ThreadedComment extends CatchComment {
  children: ThreadedComment[];
  totalChildrenCount?: number;
}

const buildThread = (flat: CatchComment[]): ThreadedComment[] => {
  const map = new Map<string, ThreadedComment>();
  const parentLookup = new Map<string, string | null>();

  flat.forEach((comment) => {
    map.set(comment.id, { ...comment, children: [] });
    parentLookup.set(comment.id, comment.parent_comment_id);
  });

  const hasCycle = (nodeId: string, parentId: string): boolean => {
    const visited = new Set<string>([nodeId]);
    let current: string | null | undefined = parentId;
    while (current) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = parentLookup.get(current) ?? null;
    }
    return false;
  };

  const roots: ThreadedComment[] = [];
  map.forEach((node) => {
    const parentId = node.parent_comment_id;
    const parentNode = parentId ? map.get(parentId) : undefined;
    // Attach to parent only if it exists and does not introduce a cycle; otherwise treat as root.
    if (parentId && parentNode && !hasCycle(node.id, parentId)) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort top-level: newest first; children: oldest first, and set counts
  const sortAsc = (a: ThreadedComment, b: ThreadedComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const sortDesc = (a: ThreadedComment, b: ThreadedComment) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const sortTree = (nodes: ThreadedComment[]) => {
    nodes.forEach((n) => {
      if (n.children.length > 0) {
        n.children.sort(sortAsc);
        n.totalChildrenCount = n.children.length;
        sortTree(n.children);
      } else {
        n.totalChildrenCount = 0;
      }
    });
  };

  sortTree(roots);
  roots.sort(sortDesc);
  return roots;
};

export const useCatchComments = (catchId: string | undefined) => {
  const [comments, setComments] = useState<CatchComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const replaceIfChanged = useCallback((next: CatchComment[]) => {
    setComments((prev) => {
      if (prev.length === next.length) {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        const changed = next.some((n) => {
          const p = prevById.get(n.id);
          if (!p) return true;
          const profileChanged =
            (p.profiles?.username ?? null) !== (n.profiles?.username ?? null) ||
            (p.profiles?.avatar_path ?? null) !== (n.profiles?.avatar_path ?? null) ||
            (p.profiles?.avatar_url ?? null) !== (n.profiles?.avatar_url ?? null);
          return (
            p.body !== n.body ||
            p.deleted_at !== n.deleted_at ||
            p.updated_at !== n.updated_at ||
            p.parent_comment_id !== n.parent_comment_id ||
            p.user_id !== n.user_id ||
            p.catch_id !== n.catch_id ||
            p.created_at !== n.created_at ||
            profileChanged
          );
        });
        if (!changed) return prev;
      }
      return next;
    });
  }, []);

  const fetchComments = useCallback(async () => {
    if (!catchId) return;
    const isInitial = !hasLoadedOnceRef.current;
    if (isInitial) {
      setIsLoading(true);
    }
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("catch_comments")
      .select(
        "id, catch_id, user_id, body, parent_comment_id, created_at, updated_at, deleted_at, profiles:user_id (id, username, avatar_path, avatar_url)"
      )
      .eq("catch_id", catchId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError("Failed to load comments");
      toast.error("Failed to load comments");
    } else {
      replaceIfChanged((data as CatchComment[]) ?? []);
    }

    if (isInitial) {
      setIsLoading(false);
    }
    hasLoadedOnceRef.current = true;
  }, [catchId, replaceIfChanged]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments, refreshToken]);

  const addLocalComment = useCallback((comment: CatchComment) => {
    setComments((prev) => {
      // Avoid duplicates by id
      if (prev.some((c) => c.id === comment.id)) return prev;
      return [...prev, comment];
    });
  }, []);

  const markLocalCommentDeleted = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, deleted_at: c.deleted_at ?? new Date().toISOString() } : c))
    );
  }, []);

  const tree = useMemo(() => buildThread(comments), [comments]);

  return {
    comments,
    commentsTree: tree,
    isLoading,
    error,
    refetch: () => setRefreshToken((prev) => prev + 1),
    addLocalComment,
    markLocalCommentDeleted,
  };
};
