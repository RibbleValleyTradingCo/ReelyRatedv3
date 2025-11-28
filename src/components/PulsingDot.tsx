import { cn } from "@/lib/utils";

interface PulsingDotProps {
  className?: string;
}

export const PulsingDot = ({ className }: PulsingDotProps) => (
  <span className={cn("relative inline-flex h-2 w-2", className)}>
    <span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-ping" />
  </span>
);

export default PulsingDot;
