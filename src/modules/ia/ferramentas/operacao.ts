import { z } from "zod";
import { podeEditar } from "@/lib/permissoes";
import { membrosDaConta, type ContextoOperacao } from "@/modules/operacao/contexto";
import { listarTarefas, resumoOperacao } from "@/modules/operacao/consultas";
import { normalizar } from "@/modules/operacao/dominio/capturaRapida";
import { ROTULOS_PRIORIDADE } from "@/modules/operacao/dominio/esquemas";
import { definirFerramenta } from "./tipos";

const SITUACAO: Record<string, "atrasadas" | "hoje" | "semana" | "abertas" | "concluidas" | "sem-prazo"> = {
  atrasadas: "atrasadas",
  hoje: "hoje",
  proximos_7_dias: "semana",
  sem_prazo: "sem-prazo",
  abertas: "abertas",
  concluidas: "concluidas",
};

export const tarefasDaEquipe = definirFerramenta({
  nome: "tarefas_da_equipe",
  rotulo: "Consultando as tarefas da equipe",
  descricao:
    "Tarefas da área Operação (quadros da loja): o que está atrasado, vence hoje ou nos próximos 7 dias, sem prazo, abertas ou concluídas, com responsável, prazo, prioridade e etiquetas, mais o resumo por pessoa (para administradores). Use para 'o que está atrasado na equipe', 'o que a Ana tem para hoje', 'o que foi feito esta semana'. Só lê: nunca cria nem muda tarefas.",
  esquema: z.object({
    situacao: z
      .enum(["atrasadas", "hoje", "proximos_7_dias", "sem_prazo", "abertas", "concluidas"])
      .default("abertas")
      .describe("Quais tarefas devolver."),
    pessoa: z.string().max(60).optional().describe("Nome (ou parte) de quem é responsável. Use 'eu' para as do próprio usuário."),
    limite: z.number().int().min(1).max(30).default(15).describe("Quantas tarefas devolver (máx. 30)."),
  }),
  permissao: "TAREFAS_EDITAR",
  async executar(contexto, entrada) {
    const operacao: ContextoOperacao = {
      contaId: contexto.contaId,
      userId: contexto.userId,
      nome: "",
      papel: contexto.papel,
      podeEditar: podeEditar(contexto.papel, "TAREFAS_EDITAR"),
      podeAdministrar: podeEditar(contexto.papel, "TAREFAS_ADMINISTRAR"),
    };
    let responsavelId: string | undefined;
    if (entrada.pessoa) {
      if (normalizar(entrada.pessoa) === "eu") responsavelId = contexto.userId;
      else {
        const alvo = normalizar(entrada.pessoa);
        const membro = (await membrosDaConta(contexto.contaId)).find((m) => normalizar(m.nome).includes(alvo));
        if (!membro) return { fonte: "Operação", aviso: `Ninguém da equipe se chama "${entrada.pessoa}".`, itens: [] };
        responsavelId = membro.id;
      }
    }
    const situacao = SITUACAO[entrada.situacao];
    const [pagina, resumo] = await Promise.all([
      listarTarefas(
        operacao,
        {
          escopo: "equipe",
          situacao,
          responsavelId,
          ordem: situacao === "concluidas" ? "conclusao" : "prazo",
          pagina: 1,
          porPagina: entrada.limite,
        },
        contexto.agora
      ),
      resumoOperacao(operacao, contexto.agora),
    ]);
    return {
      fonte: "Operação (tarefas)",
      resumoDoUsuario: resumo.minhas,
      semResponsavel: resumo.semResponsavel,
      equipe: resumo.equipe?.map((p) => ({ nome: p.nome, abertas: p.abertas, atrasadas: p.atrasadas, concluidasEm7Dias: p.concluidasSemana })) ?? null,
      totalFiltrado: pagina.total,
      itens: pagina.itens.map((t) => ({
        numero: t.numero,
        titulo: t.titulo,
        situacao: t.situacao,
        prazo: t.prazoData ? `${t.prazoData}${t.prazoHora ? ` ${t.prazoHora}` : ""}` : null,
        responsavel: t.responsavel?.nome ?? null,
        prioridade: ROTULOS_PRIORIDADE[t.prioridade],
        etiquetas: t.etiquetas.map((e) => e.nome),
        checklist: t.checklist.total ? `${t.checklist.feitos}/${t.checklist.total}` : null,
        concluidaEm: t.concluidaEm,
        tela: `/operacao?tarefa=${t.id}`,
      })),
    };
  },
});
