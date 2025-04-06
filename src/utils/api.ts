export const serializeWithEAN = (data: unknown): unknown => {
  const serialized = JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    })
  );

  const addEANField = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => addEANField(item));
    }

    if (obj.ean !== undefined && obj.codigoEAN === undefined) {
      return {
        ...obj,
        codigoEAN: obj.ean ? obj.ean.toString() : null,
      };
    }

    const result = { ...obj };
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = addEANField(result[key]);
      }
    }

    return result;
  };

  return addEANField(serialized);
};

export const cleanEANInput = (ean: string | null | undefined): string => {
  if (!ean) return "";

  return ean.replace(/[^0-9]/g, "");
};

export const prepareBigIntEAN = (
  ean: string | null | undefined
): bigint | null => {
  const cleanedEAN = cleanEANInput(ean);

  if (!cleanedEAN) return null;

  try {
    return BigInt(cleanedEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};
