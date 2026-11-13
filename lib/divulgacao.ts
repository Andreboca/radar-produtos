/**
 * Divulgação automática: a cada checagem, escolhe os produtos em alta que
 * ainda não foram enviados e manda para o grupo do Telegram e do WhatsApp.
 */
import { cfg, type Chave } from "./config";
import {
  enviarTelegram,
  enviarTelegramFoto,
  escapar,
  telegramGrupoConfigurado,
} from "./telegram";
import type { IdPlataforma, Produto } from "./types";
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

/** Link de cupons da plataforma (CUPONS_SHOPEE / CUPONS_MELI). Vazio = a linha não sai. */
function linkCupons(p: Produto): string {
  const chave: Chave | null =
    p.plataforma === "shopee" ? "CUPONS_SHOPEE" : p.plataforma === "meli" ? "CUPONS_MELI" : null;
  return chave ? cfg(chave) : "";
}

/** Oferta no formato do grupo, para o Telegram (HTML). */
export function textoOfertaTelegram(p: Produto): string {
  const linhas: string[] = [];
  linhas.push(`🛍️ <b>${escapar(p.nome)}</b>`);
  linhas.push("");
  if (p.preco !== null) linhas.push(`✅ <b>Por: ${escapar(brl(p.preco))}</b>`);
  linhas.push("");
  linhas.push(`🛒 <b>Compre aqui:</b> 👇`);
  linhas.push(escapar(p.link || ""));
  const cupons = linkCupons(p);
  if (cupons) {
    linhas.push("");
    linhas.push(`🎟️ <b>Cupons imperdíveis:</b> 👇`);
    linhas.push(escapar(cupons));
  }
  linhas.push("");
  linhas.push(`⚠️ Promoção sujeita a alteração a qualquer momento.`);
  return linhas.join("\n");
}

/** Mesma oferta para o WhatsApp (formatação com *negrito*). */
export function textoOfertaWhatsApp(p: Produto): string {
  const linhas: string[] = [];
  linhas.push(`🛍️ *${p.nome}*`);
  linhas.push("");
  if (p.preco !== null) linhas.push(`✅ *Por: ${brl(p.preco)}*`);
  linhas.push("");
  linhas.push(`🛒 *Compre aqui:* 👇`);
  linhas.push(p.link || "");
  const cupons = linkCupons(p);
  if (cupons) {
    linhas.push("");
    linhas.push(`🎟️ *Cupons imperdíveis:* 👇`);
    linhas.push(cupons);
  }
  linhas.push("");
  linhas.push(`⚠️ Promoção sujeita a alteração a qualquer momento.`);
  return linhas.join("\n");
}

export function textoWhatsApp(produtos: Produto[]): string {
  return produtos.map(textoOfertaWhatsApp).join("\n\n———\n\n");
}

/** Envia uma oferta ao grupo do Telegram: com foto quando houver, senão só texto. */
async function enviarOfertaTelegram(p: Produto): Promise<void> {
  const legenda = textoOfertaTelegram(p);
  const temFoto = Boolean(p.imagem && /^https?:\/\//.test(p.imagem));
  if (temFoto && legenda.length <= 1000) {
    try {
      await enviarTelegramFoto(p.imagem as string, legenda, "grupo");
      return;
    } catch {
      // Se a foto falhar (link quebrado, por exemplo), manda só o texto.
    }
  }
  await enviarTelegram(legenda, "grupo");
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
      for (const p of produtos) await enviarOfertaTelegram(p);
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
