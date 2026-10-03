"use client";

import { useState } from "react";
import Image from "next/image";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}

function getInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "?";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  name,
  email,
  image,
  size = 34,
  className,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const normalized = normalizeImageUrl(image);

  const containerClass = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-accent-foreground",
    className
  );

  if (!normalized || failed) {
    return (
      <div
        className={containerClass}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        <span className="font-medium">{getInitials(name, email)}</span>
      </div>
    );
  }

  return (
    <div className={containerClass} style={{ width: size, height: size }}>
      <Image
        src={normalized}
        alt={name || email || "Avatar do usuário"}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
