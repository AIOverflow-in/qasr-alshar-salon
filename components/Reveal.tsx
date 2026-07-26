"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades + lifts children into view on scroll — as a progressive enhancement.
 * Content is VISIBLE by default (server render + no-JS), and only elements that are
 * still below the fold on mount get armed for the entrance animation. This guarantees
 * critical content (e.g. price lists) is never blank if JS is slow/disabled, and avoids
 * a hide→reveal flash for anything already on screen.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(true); // visible by default (SSR / no-JS safe)
  const [armed, setArmed] = useState(false); // only true once JS decides to animate this element

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return; // stays visible
    // Already on screen at mount → leave it shown, don't animate (no flash).
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;
    // Below the fold → hide it and animate in when scrolled to.
    setArmed(true);
    setShown(false);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = armed && !shown;

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        hidden ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0",
        className
      )}
    >
      {children}
    </Tag>
  );
}
