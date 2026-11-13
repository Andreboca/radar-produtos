/**
 * Painel de afiliado: importa sozinho as suas vendas das plataformas que têm
 * API para isso (Shopee e TikTok Shop), calcula os totais do período e avisa
 * no Telegram quando entra uma venda nova.
 *
 * O Mercado Livre não oferece API pública para as vendas do programa de
 * afiliados; essas só existem no painel de afiliado do próprio site.
 */
import { promises as fs } from "fs";
import path from "path";
import { cfg } from "./config";
import * as shopee from "./shopee";
import { enviarTelegram, escapar, telegramConfigurado } from "./telegram";
import * as tiktok from "./tiktok";
import { NOMES, type IdPlataforma } from "./types";

export type Venda = {
  id: string;
  origem: "shopee" | "tiktok" | "manual";
  plataforma: IdPlataforma;
  quando: string;
  produto: string;
  valor: number;
  comissao: number;
  cancelada: boolean;
  status: string;
};

export type Fonte = { plataforma: IdPlataforma; nome: string; conectada: boolean; erro?: string; automatica: boolean };

export type ResumoVendas = {
  dias: number;
  vendido: number;
  comissao: number;
  pedidos: number;
  canceladas: number;
  taxaMedia: number | null;
  porDia: { rotulo: string; comissao: number; vendido: number; pedidos: number }[];
  /** Só as vendas de hoje (horário de Brasília), independentemente do período escolhido. */
  hoje: { comissao: number; vendido: number; pedidos: number };
  /** Média por dia no período, para comparar com hoje. */
  mediaDia: { comissao: number; vendido: number; pedidos: number };
  porPlataforma: { plataforma: IdPlataforma; nome: string; vendido: number; comissao: number; pedidos: number }[];
  topProdutos: { produto: string; comissao: number; vendido: number; pedidos: number }[];
  recentes: Venda[];
  fontes: Fonte[];
  atualizadoEm: string;
  intervaloSeg: number;
};

const PASTA = path.join(process.cwd(), "data");
const ARQ_MANUAIS = path.join(PASTA, "vendas.json");
const ARQ_VISTAS = path.join(PASTA, "vendas-vistas.json");
const FUSO = process.env.MONITOR_FUSO || "America/Sao_Paulo";

/** De quantos em quantos segundos o painel busca de novo (mínimo 15). */
export function intervaloSeg(): number {
  return Math.max(15, Number(cfg("PAINEL_ATUALIZAR_SEG")) || 60);
}

async function lerJSON<T>(arquivo: string, padrao: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(arquivo, "utf8")) as T;
  } catch {
    return padrao;
  }
}

async function gravarJSON(arquivo: string, dados: unknown) {
  await fs.mkdir(PASTA, { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados), "utf8");
}

const diaDe = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const cancelada = (status: string) => /cancel|refund|reembols|devolv/i.test(status);

type Coleta = { vendas: Venda[]; fontes: Fonte[] };
const cache = new Map<number, { ate: number; coleta: Coleta }>();

/** Busca as vendas nas plataformas conectadas, com cache curto para não estourar o limite das APIs. */
async function coletar(dias: number): Promise<Coleta> {
  const guardado = cache.get(dias);
  if (guardado && guardado.ate > Date.now()) return guardado.coleta;

  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const vendas: Venda[] = [];
  const fontes: Fonte[] = [];

  const fonte = async (
    plataforma: "shopee" | "tiktok",
    conectada: boolean,
    buscar: () => Promise<{ chave: string; quando: string; produto: string; valor: number; comissao: number; status: string }[]>
  ) => {
    const f: Fonte = { plataforma, nome: NOMES[plataforma], conectada, automatica: true };
    if (conectada) {
      try {
        for (const c of await buscar()) {
          vendas.push({
            id: `${plataforma}-${c.chave}`,
            origem: plataforma,
            plataforma,
            quando: c.quando,
            produto: c.produto,
            valor: c.valor,
            comissao: c.comissao,
            cancelada: cancelada(c.status),
            status: c.status,
          });
        }
      } catch (e) {
        f.erro = e instanceof Error ? e.message : "Falha na consulta.";
      }
    }
    fontes.push(f);
  };

  await fonte("shopee", shopee.shopeeConfigurada(), () => shopee.conversoes(inicio, fim));
  await fonte("tiktok", tiktok.tiktokVendasConfigurado(), () => tiktok.pedidosAfiliado(inicio, fim));
  fontes.push({ plataforma: "meli", nome: NOMES.meli, conectada: false, automatica: false });

  // Lançamentos antigos feitos à mão continuam contando, se existirem.
  const manuais = (await lerJSON<Venda[]>(ARQ_MANUAIS, [])).filter((v) => new Date(v.quando) >= inicio);
  const coleta = { vendas: [...vendas, ...manuais], fontes };
  cache.set(dias, { ate: Date.now() + (intervaloSeg() - 2) * 1000, coleta });
  return coleta;
}

/** Calcula o resumo a partir de uma lista de vendas (função pura, fácil de testar). */
export function resumir(vendas: Venda[], dias: number, agora = new Date()) {
  const validas = vendas.filter((v) => !v.cancelada);
  const vendido = validas.reduce((s, v) => s + v.valor, 0);
  const comissao = validas.reduce((s, v) => s + v.comissao, 0);

  const mapaDias = new Map<string, { comissao: number; vendido: number; pedidos: number }>();
  const ordem: string[] = [];
  for (let d = dias - 1; d >= 0; d--) {
    const k = diaDe(new Date(agora.getTime() - d * 86_400_000));
    mapaDias.set(k, { comissao: 0, vendido: 0, pedidos: 0 });
    ordem.push(k);
  }
  const plataformas = new Map<IdPlataforma, { vendido: number; comissao: number; pedidos: number }>();
  const produtos = new Map<string, { comissao: number; vendido: number; pedidos: number }>();
  for (const v of validas) {
    const alvo = mapaDias.get(diaDe(new Date(v.quando)));
    if (alvo) {
      alvo.comissao += v.comissao;
      alvo.vendido += v.valor;
      alvo.pedidos += 1;
    }
    const pl = plataformas.get(v.plataforma) || { vendido: 0, comissao: 0, pedidos: 0 };
    pl.vendido += v.valor;
    pl.comissao += v.comissao;
    pl.pedidos += 1;
    plataformas.set(v.plataforma, pl);
    const pr = produtos.get(v.produto) || { comissao: 0, vendido: 0, pedidos: 0 };
    pr.vendido += v.valor;
    pr.comissao += v.comissao;
    pr.pedidos += 1;
    produtos.set(v.produto, pr);
  }

  const hoje = mapaDias.get(diaDe(agora)) || { comissao: 0, vendido: 0, pedidos: 0 };

  return {
    dias,
    vendido,
    comissao,
    hoje,
    mediaDia: { comissao: comissao / dias, vendido: vendido / dias, pedidos: validas.length / dias },
    pedidos: validas.length,
    canceladas: vendas.length - validas.length,
    taxaMedia: vendido > 0 ? (comissao / vendido) * 100 : null,
    porDia: ordem.map((k) => ({ rotulo: `${k.slice(8, 10)}/${k.slice(5, 7)}`, ...mapaDias.get(k)! })),
    porPlataforma: Array.from(plataformas.entries())
      .map(([plataforma, t]) => ({ plataforma, nome: NOMES[plataforma], ...t }))
      .sort((a, b) => b.comissao - a.comissao),
    topProdutos: Array.from(produtos.entries())
      .map(([produto, t]) => ({ produto, ...t }))
      .sort((a, b) => b.comissao - a.comissao)
      .slice(0, 8),
    recentes: [...vendas].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 40),
  };
}

export async function painel(dias: number): Promise<ResumoVendas> {
  const { vendas, fontes } = await coletar(dias);
  return {
    ...resumir(vendas, dias),
    fontes,
    atualizadoEm: new Date().toISOString(),
    intervaloSeg: intervaloSeg(),
  };
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let vigiando = false;

/**
 * Chamado pelo agendador: olha as vendas dos últimos 7 dias e avisa no
 * Telegram as que ainda não tinham sido vistas. A primeira passada só registra.
 */
export async function vigiarVendas(): Promise<number> {
  if (vigiando) return 0;
  if (!shopee.shopeeConfigurada() && !tiktok.tiktokVendasConfigurado()) return 0;
  vigiando = true;
  try {
    const { vendas } = await coletar(7);
    const automaticas = vendas.filter((v) => v.origem !== "manual" && !v.cancelada);
    const vistas = await lerJSON<string[] | null>(ARQ_VISTAS, null);
    const conhecidas = new Set(vistas || []);
    const novas = automaticas.filter((v) => !conhecidas.has(v.id));
    if (!novas.length && vistas) return 0;

    await gravarJSON(ARQ_VISTAS, Array.from(new Set([...(vistas || []), ...automaticas.map((v) => v.id)])).slice(-5000));
    if (!vistas) return 0; // primeira passada

    if (telegramConfigurado()) {
      const total = novas.reduce((s, v) => s + v.comissao, 0);
      const linhas = novas
        .slice(0, 10)
        .map((v) => `• ${escapar(v.produto)} — ${brl(v.valor)} (comissão ${brl(v.comissao)}) · ${NOMES[v.plataforma]}`);
      await enviarTelegram(
        `💰 <b>${novas.length} venda(s) nova(s)</b> · comissão ${brl(total)}\n${linhas.join("\n")}`
      ).catch(() => undefined);
    }
    return novas.length;
  } finally {
    vigiando = false;
  }
}

export async function apagarManual(id: string): Promise<void> {
  const lista = await lerJSON<Venda[]>(ARQ_MANUAIS, []);
  await gravarJSON(ARQ_MANUAIS, lista.filter((v) => v.id !== id));
}
