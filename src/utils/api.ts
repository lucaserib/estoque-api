export const serializeWithEAN = (data: unknown): unknown => {
  const serialized = JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    })
  );

  // Definir um tipo mais específico para os objetos
  type SerializedObject = {
    ean?: string | number | bigint;
    codigoEAN?: string;
    [key: string]: unknown;
  };

  const addEANField = (obj: unknown): unknown => {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => addEANField(item));
    }

    // Tratar como objeto serializado
    const typedObj = obj as SerializedObject;

    if (typedObj.ean !== undefined && typedObj.codigoEAN === undefined) {
      return {
        ...typedObj,
        codigoEAN: typedObj.ean ? typedObj.ean.toString() : null,
      };
    }

    const result = { ...typedObj };
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
