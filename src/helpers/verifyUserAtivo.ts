import type { NextRequest } from "next/server";
import { verifyUser, type VerifiedUser } from "@/helpers/verifyUser";
import { AssinaturaInativaError } from "@/modules/conta/erros";
import { obterSituacaoContaEmCache, type SituacaoConta } from "@/modules/conta/situacao";

export interface VerifiedUserAtivo extends VerifiedUser {
  situacao: SituacaoConta;
}

export async function verifyUserAtivo(req: NextRequest): Promise<VerifiedUserAtivo> {
  const usuario = await verifyUser(req);
  const situacao = await obterSituacaoContaEmCache(usuario.contaId);
  if (!situacao.podeUsar) throw new AssinaturaInativaError(situacao.status);
  return { ...usuario, situacao };
}
