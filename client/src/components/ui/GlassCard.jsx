import { cn } from "@/lib/utils";

export default function GlassCard({ className, children, ...props }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}
