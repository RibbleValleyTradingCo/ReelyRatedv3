import { useCallback, useEffect, useMemo, useState } from "react";
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

  return roots;
};

export const useCatchComments = (catchId: string | undefined) => {
  const [comments, setComments] = useState<CatchComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!catchId) return;
    setIsLoading(true);
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
      setComments((data as CatchComment[]) ?? []);
    }

    setIsLoading(false);
  }, [catchId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const tree = useMemo(() => buildThread(comments), [comments]);

  return {
    comments,
    commentsTree: tree,
    isLoading,
    error,
    refetch: fetchComments,
  };
};
