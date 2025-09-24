import React from 'react';
import Image from 'next/image';

interface MercadoLivreIconProps {
  className?: string;
  width?: number;
  height?: number;
}

export const MercadoLivreIcon: React.FC<MercadoLivreIconProps> = ({
  className = "w-6 h-6",
  width = 24,
  height = 24
}) => {
  return (
    <Image
      src="/ML.png"
      alt="Mercado Livre"
      width={width}
      height={height}
      className={className}
    />
  );
};