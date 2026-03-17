import { useEffect, useState, useRef } from "react";

export default function AnimatedList({ children, className = "" }) {
  const childArray = Array.isArray(children) ? children : children ? [children] : [];
  const keysRef = useRef(new Set());
  const [animatingKeys, setAnimatingKeys] = useState(new Set());

  useEffect(() => {
    const currentKeys = new Set(childArray.map((c, i) => c?.key ?? i));
    const newKeys = new Set();
    currentKeys.forEach((k) => {
      if (!keysRef.current.has(k)) newKeys.add(k);
    });
    keysRef.current = currentKeys;
    if (newKeys.size > 0) {
      setAnimatingKeys(newKeys);
      const t = setTimeout(() => setAnimatingKeys(new Set()), 400);
      return () => clearTimeout(t);
    }
  }, [children]);

  return (
    <div className={className}>
      {childArray.map((child, i) => {
        const key = child?.key ?? i;
        return (
          <div
            key={key}
            style={
              animatingKeys.has(key)
                ? { animation: "slideInTop 0.3s ease forwards" }
                : undefined
            }
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
