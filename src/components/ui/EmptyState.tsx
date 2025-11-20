import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onActionClick?: () => void;
  className?: string;
}

export const EmptyState = ({ title, message, actionLabel, onActionClick, className }: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center text-sm text-muted-foreground py-10", className)}>
      {title ? <h3 className="text-base font-semibold text-foreground">{title}</h3> : null}
      <p className="max-w-md leading-relaxed">{message}</p>
      {actionLabel && onActionClick ? (
        <Button onClick={onActionClick} variant="ocean" className="mt-2" size="sm">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;
