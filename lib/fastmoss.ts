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
import {
  REGIOES,
  type Ordem,
  type OrdemVideo,
  type Produto,
  type Regiao,
  type VideoProduto,
} from "./types";

const BASE = process.env.FASTMOSS_URL || "https://openapi.fastmoss.com";

export { REGIOES, ehOrdem, ehOrdemVideo, ehRegiao } from "./types";
export type { Ordem, OrdemVideo, Regiao, VideoProduto } from "./types";

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
  total_gmv?: number;
  growth_rate?: number;
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
    faturamento: numero(item.gmv) ?? numero(item.total_gmv),
  };
}

/**
 * Os produtos mais vendidos da região, do dia anterior, em ordem de unidades.
 *
 * O limite padrão é 10 de propósito: a FastMoss cobra por lote de 10
 * (cota = ceil(pagesize / 10)), então pedir 20 custa o dobro. Busca sem
 * resultado não é cobrada.
 */
export async function maisVendidos(
  regiao: Regiao,
  ordem: Ordem = "gmv",
  limite = 10
): Promise<Produto[]> {
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
      orderby: [{ field: ordem, order: "desc" }],
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

type ItemVideo = {
  video_id?: string | number;
  play_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  units_sold?: number;
  gmv?: number;
  is_ad?: number;
  create_time?: number | string;
  create_date?: string;
  video?: {
    tiktok_url?: string;
    fastmoss_url?: string;
    cover?: string;
    video_desc?: string;
  };
};

/**
 * Os vídeos que venderam um produto, para estudar o gancho e modelar.
 *
 * `somenteAnuncio` usa o filtro `is_ad` da FastMoss: 1 traz só os vídeos
 * impulsionados com anúncio pago, 0 só os orgânicos. Sem ele, vêm os dois.
 */
export async function videosDoProduto(
  produtoId: string,
  opcoes: {
    ordem?: OrdemVideo;
    dias?: number;
    somenteAnuncio?: boolean;
    moeda?: string;
    limite?: number;
  } = {}
): Promise<VideoProduto[]> {
  const token = cfg("FASTMOSS_TOKEN");
  if (!token) throw new Error("Falta a chave FASTMOSS_TOKEN.");

  const { ordem = "gmv", dias = 30, somenteAnuncio, moeda = "BRL", limite = 10 } = opcoes;

  const filtro: Record<string, unknown> = { product_id: produtoId, days: dias };
  if (somenteAnuncio !== undefined) filtro.is_ad = somenteAnuncio ? 1 : 0;

  const resp = await fetch(`${BASE}/product/v1/videoList`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filter: filtro,
      // Aqui orderby é objeto, não lista: o formato difere do topSelling.
      orderby: { field: ordem, order: "desc" },
      page: 1,
      pagesize: Math.min(Math.max(limite, 1), 50),
    }),
    cache: "no-store",
  });

  const texto = await resp.text();
  let json: { code?: number; msg?: string; data?: { list?: ItemVideo[] } };
  try {
    json = JSON.parse(texto) as typeof json;
  } catch {
    throw new Error(`FastMoss devolveu uma resposta inesperada (HTTP ${resp.status}).`);
  }

  if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || `FastMoss recusou a consulta (HTTP ${resp.status}).`);
  }

  return (json.data?.list || [])
    .map((v): VideoProduto | null => {
      const id = v.video_id ? String(v.video_id) : "";
      if (!id) return null;
      const publicado = numero(v.create_time);
      return {
        id,
        descricao: v.video?.video_desc?.trim() || "Sem legenda",
        capa: v.video?.cover?.trim() || null,
        link: v.video?.tiktok_url?.trim() || v.video?.fastmoss_url?.trim() || null,
        views: numero(v.play_count),
        curtidas: numero(v.digg_count),
        comentarios: numero(v.comment_count),
        compartilhamentos: numero(v.share_count),
        vendas: numero(v.units_sold),
        faturamento: numero(v.gmv),
        moeda,
        anuncio: Number(v.is_ad) === 1,
        // A doc oscila entre segundos e milissegundos; normaliza para ms.
        publicadoEm: publicado === null ? null : publicado > 1e11 ? publicado : publicado * 1000,
      };
    })
    .filter((v): v is VideoProduto => v !== null);
}
