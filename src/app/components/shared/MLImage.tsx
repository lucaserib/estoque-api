"use client";

import Image from "next/image";
import { useState } from "react";

interface MLImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

const MLImage = ({ src, alt, width, height, className = "" }: MLImageProps) => {
  const [imageError, setImageError] = useState(false);

  const fixImageUrl = (url: string): string => {
    if (!url) return "";

    let fixedUrl = url.trim();

    // Remover http:// duplicado
    if (fixedUrl.startsWith("http://http")) {
      fixedUrl = fixedUrl.replace("http://http", "http");
    }

    // Remover https:// duplicado
    if (fixedUrl.startsWith("https://https")) {
      fixedUrl = fixedUrl.replace("https://https", "https");
    }

    // Se a URL ainda não tem protocolo mas tem um domínio válido, adicionar https://
    if (!fixedUrl.startsWith("http://") && !fixedUrl.startsWith("https://")) {
      if (fixedUrl.includes(".") && !fixedUrl.startsWith("//")) {
        fixedUrl = `https://${fixedUrl}`;
      }
    }

    // Garantir que URLs do Mercado Livre usem HTTPS
    if (fixedUrl.includes("mlstatic.com") && fixedUrl.startsWith("http://")) {
      fixedUrl = fixedUrl.replace("http://", "https://");
    }

    return fixedUrl;
  };

  if (imageError || !src) {
    return (
      <div
        className={`bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500 ${className}`}
        style={{ width, height }}
      >
        ML
      </div>
    );
  }

  return (
    <Image
      src={fixImageUrl(src)}
      alt={alt || "Produto Mercado Livre"}
      width={width}
      height={height}
      className={`rounded object-cover ${className}`}
      onError={() => setImageError(true)}
      unoptimized={fixImageUrl(src).includes("mlstatic.com")}
    />
  );
};

export default MLImage;
