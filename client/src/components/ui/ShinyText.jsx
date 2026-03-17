import { cn } from "@/lib/utils";

export default function ShinyText({ children, className, speed = 3, ...props }) {
  return (
    <span
      className={cn("inline-block", className)}
      style={{
        backgroundImage:
          "linear-gradient(120deg, #1a1a1a 0%, #888888 40%, #1a1a1a 60%, #aaaaaa 80%, #1a1a1a 100%)",
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: `shine ${speed}s linear infinite`,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
