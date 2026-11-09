import type { StatusConta } from "./tipos";

export class AssinaturaInativaError extends Error {
  readonly code = "ASSINATURA_INATIVA";

  constructor(readonly status: StatusConta) {
    super(
      status === "BLOQUEADA"
        ? "O acesso desta conta está bloqueado. Fale com o suporte."
        : "A assinatura da loja não está ativa. Renove para continuar usando o Skubo."
    );
    this.name = "AssinaturaInativaError";
  }
}

export class NaoAutenticadoError extends Error {
  readonly code = "NAO_AUTENTICADO";

  constructor(mensagem = "Acesso não autorizado. Faça login de novo.") {
    super(mensagem);
    this.name = "NaoAutenticadoError";
  }
}

export class UsuarioBloqueadoError extends Error {
  readonly code = "USUARIO_BLOQUEADO";

  constructor() {
    super("Acesso não autorizado. Usuário bloqueado.");
    this.name = "UsuarioBloqueadoError";
  }
}
