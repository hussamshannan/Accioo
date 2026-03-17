import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

// Check if a user has a real avatar (not empty/null)
export function hasCustomAvatar(url) {
  return !!url;
}

// Deterministic color from name — always produces a readable pair
const AVATAR_COLORS = [
  { bg: "#00A884", fg: "#ffffff" }, // green
  { bg: "#5B5EA6", fg: "#ffffff" }, // indigo
  { bg: "#E06C75", fg: "#ffffff" }, // coral
  { bg: "#D19A66", fg: "#ffffff" }, // amber
  { bg: "#56B6C2", fg: "#ffffff" }, // teal
  { bg: "#C678DD", fg: "#ffffff" }, // purple
  { bg: "#E5C07B", fg: "#1a1a1a" }, // gold
  { bg: "#61AFEF", fg: "#ffffff" }, // blue
];

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function UserAvatar({
  user,
  size = "md",
  className,
  showOnline = true,
}) {
  const name = user?.displayName || user?.username || "?";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const color = useMemo(
    () => AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length],
    [name],
  );

  const sizeClasses = {
    xs: "w-7 h-7 text-xs",
    sm: "w-9 h-9 text-sm",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
    "2xl": "w-28 h-28 text-2xl",
  };

  const dotSizes = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
    xl: "w-3.5 h-3.5",
    "2xl": "w-4 h-4",
  };

  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!user?.avatarUrl && !imgFailed;

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-semibold",
          sizeClasses[size] || sizeClasses.md,
        )}
        style={!showImage ? { background: color.bg, color: color.fg } : undefined}
      >
        {showImage ? (
          <img
            src={user.avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {showOnline && user?.isOnline && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-background",
            dotSizes[size] || dotSizes.md,
          )}
        />
      )}
    </div>
  );
}
