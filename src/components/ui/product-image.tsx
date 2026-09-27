"use client";

import { useState } from "react";
import Image from "next/image";
import { CubeMark } from "@/components/brand/Logo";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  size?: number;
  rounded?: "md" | "lg" | "full";
  className?: string;
}

const roundedClass: Record<NonNullable<ProductImageProps["rounded"]>, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export function ProductImage({
  src,
  alt,
  size = 40,
  rounded = "md",
  className,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const normalized = normalizeImageUrl(src);

  const containerClass = cn(
    "relative shrink-0 overflow-hidden border border-border bg-muted",
    roundedClass[rounded],
    className
  );

  if (!normalized || failed) {
    return (
      <div
        className={cn(containerClass, "flex items-center justify-center")}
        style={{ width: size, height: size }}
      >
        <CubeMark className="h-1/2 w-1/2 opacity-40" />
      </div>
    );
  }

  return (
    <div className={containerClass} style={{ width: size, height: size }}>
      <Image
        src={normalized}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
