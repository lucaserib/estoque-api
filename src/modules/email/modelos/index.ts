import { confirmarEmail } from "./confirmar-email";
import { redefinirSenha } from "./redefinir-senha";
import { conviteEquipe } from "./convite-equipe";
import { conviteAceito } from "./convite-aceito";
import { membroRemovido } from "./membro-removido";
import { reciboAssinatura } from "./recibo-assinatura";
import { reciboCreditos } from "./recibo-creditos";
import { avisoReajuste } from "./aviso-reajuste";
import { avisoResponsavel } from "./aviso-responsavel";
import { automacao } from "./automacao";
import { campanha } from "./campanha";
import { resumoTarefas, tarefaAtribuida, tarefaMencao } from "./tarefas";
import type { ModeloEmail } from "./tipos";

export const MODELOS_EMAIL = {
  "confirmar-email": confirmarEmail,
  "redefinir-senha": redefinirSenha,
  "convite-equipe": conviteEquipe,
  "convite-aceito": conviteAceito,
  "membro-removido": membroRemovido,
  "recibo-assinatura": reciboAssinatura,
  "recibo-creditos": reciboCreditos,
  "aviso-reajuste": avisoReajuste,
  "aviso-responsavel": avisoResponsavel,
  "automacao": automacao,
  "campanha": campanha,
  "tarefa-atribuida": tarefaAtribuida,
  "tarefa-mencao": tarefaMencao,
  "resumo-tarefas": resumoTarefas,
} as const;

export type ChaveModeloEmail = keyof typeof MODELOS_EMAIL;

export type DadosDoModelo<C extends ChaveModeloEmail> = (typeof MODELOS_EMAIL)[C] extends ModeloEmail<infer D> ? D : never;

export function obterModeloEmail(chave: string): ModeloEmail<Record<string, unknown>> | null {
  return (MODELOS_EMAIL as Record<string, ModeloEmail<Record<string, unknown>>>)[chave] ?? null;
}
