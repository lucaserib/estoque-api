import { z } from "zod";

type EsquemaJson = Record<string, unknown>;

function comDescricao(esquema: EsquemaJson, tipo: z.ZodTypeAny): EsquemaJson {
  return tipo.description ? { ...esquema, description: tipo.description } : esquema;
}

function opcional(tipo: z.ZodTypeAny): boolean {
  return tipo instanceof z.ZodOptional || tipo instanceof z.ZodDefault;
}

export function zodParaJsonSchema(tipo: z.ZodTypeAny): EsquemaJson {
  if (tipo instanceof z.ZodOptional || tipo instanceof z.ZodNullable) {
    const interno = zodParaJsonSchema(tipo.unwrap());
    return tipo.description ? { ...interno, description: tipo.description } : interno;
  }
  if (tipo instanceof z.ZodDefault) {
    const interno = zodParaJsonSchema(tipo._def.innerType);
    return comDescricao({ ...interno, default: tipo._def.defaultValue() }, tipo);
  }
  if (tipo instanceof z.ZodEffects) return comDescricao(zodParaJsonSchema(tipo.innerType()), tipo);
  if (tipo instanceof z.ZodObject) {
    const forma = tipo.shape as Record<string, z.ZodTypeAny>;
    const obrigatorios = Object.entries(forma)
      .filter(([, campo]) => !opcional(campo))
      .map(([chave]) => chave);
    return comDescricao(
      {
        type: "object",
        properties: Object.fromEntries(Object.entries(forma).map(([chave, campo]) => [chave, zodParaJsonSchema(campo)])),
        ...(obrigatorios.length > 0 ? { required: obrigatorios } : {}),
        additionalProperties: false,
      },
      tipo
    );
  }
  if (tipo instanceof z.ZodEnum) return comDescricao({ type: "string", enum: [...tipo.options] }, tipo);
  if (tipo instanceof z.ZodString) {
    const padrao = tipo._def.checks.find((c) => c.kind === "regex");
    const minimo = tipo.minLength;
    const maximo = tipo.maxLength;
    return comDescricao(
      {
        type: "string",
        ...(padrao && padrao.kind === "regex" ? { pattern: padrao.regex.source } : {}),
        ...(minimo !== null ? { minLength: minimo } : {}),
        ...(maximo !== null ? { maxLength: maximo } : {}),
      },
      tipo
    );
  }
  if (tipo instanceof z.ZodNumber) {
    return comDescricao(
      {
        type: tipo.isInt ? "integer" : "number",
        ...(tipo.minValue !== null ? { minimum: tipo.minValue } : {}),
        ...(tipo.maxValue !== null ? { maximum: tipo.maxValue } : {}),
      },
      tipo
    );
  }
  if (tipo instanceof z.ZodBoolean) return comDescricao({ type: "boolean" }, tipo);
  if (tipo instanceof z.ZodArray) return comDescricao({ type: "array", items: zodParaJsonSchema(tipo.element) }, tipo);
  return comDescricao({}, tipo);
}
