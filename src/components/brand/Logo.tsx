import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { icon: "h-5 w-5", text: "text-sm" },
  md: { icon: "h-7 w-7", text: "text-lg" },
  lg: { icon: "h-10 w-10", text: "text-2xl" },
};

function CubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <path d="M50 6 L86 27 L50 48 L14 27 Z" fill="hsl(var(--primary))" />
      <path d="M14 27 L50 48 L50 92 L14 71 Z" fill="#1F5C0B" />
      <path d="M86 27 L50 48 L50 92 L86 71 Z" fill="#8B96A3" />
      <path
        d="M50 6 L86 27 L50 48 L14 27 Z M14 27 L50 48 L50 92 L14 71 Z M86 27 L50 48 L50 92 L86 71 Z"
        stroke="hsl(var(--background))"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ variant = "full", size = "md", className }: LogoProps) {
  const s = sizes[size];

  if (variant === "mark") {
    return <CubeMark className={cn(s.icon, className)} />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CubeMark className={s.icon} />
      <span
        className={cn(
          s.text,
          "text-display uppercase tracking-[0.18em] text-foreground"
        )}
      >
        Leap Store
      </span>
    </span>
  );
}

export default Logo;
