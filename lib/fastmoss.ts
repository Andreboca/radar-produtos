/**
 * FastMoss OpenAPI — produtos mais vendidos do TikTok Shop.
 *
 * Usada porque a API oficial de criador afiliado do TikTok ainda não libera o
 * Brasil. A FastMoss cobre BR, US e GB (entre outros) e devolve o ranking de
 * mais vendidos com foto, preço, unidades e comissão.
 *
 * Documentação: POST https://openapi.fastmoss.com/product/v1/rank/topSelling
 * Autenticação: cabeçalho Authorization: Bearer <token>
 */
import { cfg } from "./config";
import { REGIOES, type Produto, type Regiao } from "./types";

const BASE = process.env.FASTMOSS_URL || "https://openapi.fastmoss.com";

export { REGIOES, ehRegiao } from "./types";
export type { Regiao } from "./types";

function moedaDa(regiao: Regiao): string {
  return REGIOES.find((r) => r.id === regiao)?.moeda || "BRL";
}

export function fastmossConfigurado(): boolean {
  return Boolean(cfg("FASTMOSS_TOKEN"));
}

/** Ontem em AAAA-MM-DD (UTC). O dia de hoje ainda está sendo fechado pela FastMoss. */
function ontem(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10);
}

type ItemFastMoss = {
  product_id?: string | number;
  title?: string;
  region?: string;
  cover?: string;
  commission_rate?: number;
  real_price?: string | number;
  units_sold?: number;
  gmv?: number;
  total_units_sold?: number;
  shop?: { name?: string };
};

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.,-]/g, "").replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A FastMoss documenta commission_rate como inteiro. Vem em centésimos de ponto
 * percentual (1234 = 12,34%) quando passa de 100; abaixo disso já é a própria
 * porcentagem. Normaliza para porcentagem.
 */
function comissao(v: unknown): number | null {
  const n = numero(v);
  if (n === null || n <= 0) return null;
  return n > 100 ? n / 100 : n;
}

function montar(item: ItemFastMoss, regiao: Regiao, posicao: number): Produto | null {
  const id = item.product_id ? String(item.product_id) : "";
  if (!id) return null;
  return {
    plataforma: "tiktok",
    id,
    nome: item.title?.trim() || "Produto sem título",
    preco: numero(item.real_price),
    vendas: numero(item.units_sold) ?? numero(item.total_units_sold),
    avaliacao: null,
    comissaoPct: comissao(item.commission_rate),
    posicao,
    imagem: item.cover?.trim() || null,
    // A FastMoss não devolve link. O endereço público do produto no TikTok Shop
    // segue sempre este formato; não é link de afiliado.
    link: `https://shop.tiktok.com/view/product/${id}?region=${regiao}`,
    loja: item.shop?.name?.trim() || null,
    moeda: moedaDa(regiao),
  };
}

/** Os produtos mais vendidos da região, do dia anterior, em ordem de unidades. */
export async function maisVendidos(regiao: Regiao, limite = 20): Promise<Produto[]> {
  const token = cfg("FASTMOSS_TOKEN");
  if (!token) throw new Error("Falta a chave FASTMOSS_TOKEN.");

  const resp = await fetch(`${BASE}/product/v1/rank/topSelling`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filter: {
        region: regiao,
        date_info: { type: "day", value: ontem() },
      },
      orderby: [{ field: "units_sold", order: "desc" }],
      page: 1,
      pagesize: Math.min(Math.max(limite, 1), 50),
    }),
    cache: "no-store",
  });

  const texto = await resp.text();
  let json: { code?: number; msg?: string; data?: { list?: ItemFastMoss[] } };
  try {
    json = JSON.parse(texto) as typeof json;
  } catch {
    throw new Error(`FastMoss devolveu uma resposta inesperada (HTTP ${resp.status}).`);
  }

  if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || `FastMoss recusou a consulta (HTTP ${resp.status}).`);
  }

  const lista = json.data?.list || [];
  return lista
    .map((item, i) => montar(item, regiao, i + 1))
    .filter((p): p is Produto => p !== null);
}
