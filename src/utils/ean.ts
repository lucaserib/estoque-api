export const stringToBigIntEAN = (
  ean: string | null | undefined
): bigint | null => {
  if (!ean) return null;
  if (ean === "") return null;

  const cleanEAN = String(ean).replace(/[^0-9]/g, "");

  if (!cleanEAN) return null;

  try {
    return BigInt(cleanEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};

export const bigIntToStringEAN = (ean: bigint | null | undefined): string => {
  if (!ean) return "";
  return ean.toString();
};

interface ProdutoComEAN {
  codigoEAN?: string;
  ean?: string | number | bigint;
  codigosDeBarras?: Array<{ tipo: string; codigo: string }>;
  [key: string]: unknown;
}

export const getEANFromProduct = (
  produto: ProdutoComEAN
): string | undefined => {
  if (produto?.codigoEAN) {
    return produto.codigoEAN;
  }

  if (produto?.ean) {
    return produto.ean.toString();
  }

  if (produto?.codigosDeBarras && Array.isArray(produto.codigosDeBarras)) {
    const codigoEAN = produto.codigosDeBarras.find(
      (codigo) => codigo.tipo === "EAN" || codigo.tipo === "GTIN"
    );
    if (codigoEAN?.codigo) return codigoEAN.codigo;
  }

  return undefined;
};

export const normalizeProductEAN = <
  T extends { ean?: string | number | bigint; codigoEAN?: string }
>(
  produto: T
): T => {
  if (!produto) return produto;

  const normalizedProduct = { ...produto };

  if (!normalizedProduct.codigoEAN && normalizedProduct.ean) {
    normalizedProduct.codigoEAN = normalizedProduct.ean.toString();
  }

  return normalizedProduct;
};

export const normalizeProductsEAN = <
  T extends { ean?: string | number | bigint; codigoEAN?: string }
>(
  produtos: T[]
): T[] => {
  if (!produtos || !Array.isArray(produtos)) return produtos;

  return produtos.map(normalizeProductEAN);
};

export const validateEAN13 = (ean: string): boolean => {
  if (!ean || ean.length !== 13) return false;
  if (!/^\d+$/.test(ean)) return false;

  const digits = ean.split("").map(Number);
  const checkDigit = digits[12];
  const calculatedSum = digits.slice(0, 12).reduce((sum, digit, index) => {
    const multiplier = index % 2 === 0 ? 1 : 3;
    return sum + digit * multiplier;
  }, 0);

  const calculatedCheckDigit = (10 - (calculatedSum % 10)) % 10;
  return checkDigit === calculatedCheckDigit;
};
