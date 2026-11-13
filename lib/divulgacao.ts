/**
 * Divulgação automática: a cada checagem, escolhe os produtos em alta que
 * ainda não foram enviados e manda para o grupo do Telegram e do WhatsApp.
 */
import { cfg } from "./config";
import { enviarTelegram, escapar, telegramGrupoConfigurado } from "./telegram";
import { NOMES, type IdPlataforma, type Produto } from "./types";
import { enviarWhatsApp, whatsappConfigurado } from "./whatsapp";

export type ListaProdutos = { plataforma: IdPlataforma; produtos: Produto[] };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const chave = (p: Produto) => `${p.plataforma}:${p.id}`;

export function divulgacaoConfigurada(): boolean {
  return telegramGrupoConfigurado() || whatsappConfigurado();
}

/**
 * Intercala as plataformas (1º de cada, depois 2º de cada...) e pula o que já
 * foi enviado dentro da janela, para o grupo não receber a mesma oferta sempre.
 */
export function escolher(
  listas: ListaProdutos[],
  enviados: Record<string, number>,
  quantidade: number,
  janelaMs: number,
  agora = Date.now()
): Produto[] {
  const escolhidos: Produto[] = [];
  const vistos = new Set<string>();
  const maior = Math.max(0, ...listas.map((l) => l.produtos.length));
  for (let i = 0; i < maior && escolhidos.length < quantidade; i++) {
    for (const l of listas) {
      const p = l.produtos[i];
      if (!p || !p.link || escolhidos.length >= quantidade) continue;
      const k = chave(p);
      if (vistos.has(k)) continue;
      vistos.add(k);
      if (enviados[k] && agora - enviados[k] < janelaMs) continue;
      escolhidos.push(p);
    }
  }
  return escolhidos;
}

function dados(p: Produto): string {
  return [
    p.preco !== null ? `💰 ${brl(p.preco)}` : "",
    p.vendas !== null ? `🛒 ${p.vendas.toLocaleString("pt-BR")} vendidos` : "",
    p.posicao !== null && p.vendas === null ? `🏆 #${p.posicao} mais vendido` : "",
    p.avaliacao !== null ? `⭐ ${p.avaliacao.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function textoWhatsApp(produtos: Produto[]): string {
  return (
    "🔥 *PRODUTOS EM ALTA AGORA*\n\n" +
    produtos
      .map((p) => `*${p.nome}*\n${dados(p)}\n🏬 ${NOMES[p.plataforma]}\n👉 ${p.link}`)
      .join("\n\n")
  );
}

export function textoTelegram(produtos: Produto[]): string {
  return (
    "🔥 <b>PRODUTOS EM ALTA AGORA</b>\n\n" +
    produtos
      .map(
        (p) =>
          `<b>${escapar(p.nome)}</b>\n${escapar(dados(p))}\n🏬 ${NOMES[p.plataforma]}\n👉 <a href="${escapar(
            p.link || ""
          )}">Ver oferta</a>`
      )
      .join("\n\n")
  );
}

export type ResultadoDivulgacao = { enviados: Produto[]; falhas: string[] };

/** Envia aos grupos e marca em `enviados` o que saiu. */
export async function divulgar(
  listas: ListaProdutos[],
  enviados: Record<string, number>
): Promise<ResultadoDivulgacao> {
  const quantidade = Math.min(10, Math.max(1, Number(cfg("DIVULGACAO_ITENS") || 5)));
  const janelaMs = Math.max(1, Number(cfg("DIVULGACAO_REPETIR_HORAS") || 24)) * 3_600_000;
  const agora = Date.now();

  for (const k of Object.keys(enviados)) {
    if (agora - enviados[k] >= janelaMs) delete enviados[k];
  }

  const produtos = escolher(listas, enviados, quantidade, janelaMs, agora);
  if (!produtos.length) return { enviados: [], falhas: [] };

  const falhas: string[] = [];
  let algumEnvio = false;

  if (telegramGrupoConfigurado()) {
    try {
      await enviarTelegram(textoTelegram(produtos), "grupo");
      algumEnvio = true;
    } catch (e) {
      falhas.push(e instanceof Error ? e.message : "Falha no Telegram.");
    }
  }
  if (whatsappConfigurado()) {
    try {
      await enviarWhatsApp(textoWhatsApp(produtos));
      algumEnvio = true;
    } catch (e) {
      falhas.push(e instanceof Error ? e.message : "Falha no WhatsApp.");
    }
  }

  if (algumEnvio) for (const p of produtos) enviados[chave(p)] = agora;
  return { enviados: algumEnvio ? produtos : [], falhas };
}
