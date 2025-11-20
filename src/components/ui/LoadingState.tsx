import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  fullscreen?: boolean;
}

export const LoadingState = ({ message = "Loading...", fullscreen = false }: LoadingStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground",
        fullscreen ? "min-h-[60vh]" : "py-10",
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default LoadingState;
