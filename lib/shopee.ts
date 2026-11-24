/**
 * Shopee — Affiliate Open API (GraphQL)
 * Endpoint Brasil: https://open-api.affiliate.shopee.com.br/graphql
 *
 * Exige conta aprovada no programa de afiliados (affiliate.shopee.com.br).
 * O App ID e o Secret ficam na seção "Open API" do painel de afiliado.
 *
 * Assinatura: SHA256(appId + timestamp + corpo + secret)
 */
import { cfg } from "./config";
import { createHash } from "crypto";
import type { Produto } from "./types";

const ENDPOINT =
  process.env.SHOPEE_ENDPOINT || "https://open-api.affiliate.shopee.com.br/graphql";

export function shopeeConfigurada(): boolean {
  return Boolean(cfg("SHOPEE_APP_ID") && cfg("SHOPEE_SECRET"));
}

/** 1 = relevância, 2 = mais vendidos, 3 = maior preço, 4 = menor preço, 5 = maior comissão */
export type OrdemShopee = 1 | 2 | 3 | 4 | 5;

type No = {
  itemId?: number | string;
  productName?: string;
  priceMin?: string;
  priceMax?: string;
  sales?: number;
  ratingStar?: string;
  commissionRate?: string;
  imageUrl?: string;
  shopName?: string;
  productLink?: string;
  offerLink?: string;
};

type RespostaShopee = { data?: Record<string, any>; errors?: { message?: string }[] };

/** Faz uma consulta GraphQL assinada à API de afiliados. */
async function consultaShopee(query: string): Promise<RespostaShopee> {
  const appId = cfg("SHOPEE_APP_ID");
  const secret = cfg("SHOPEE_SECRET");
  const corpo = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const assinatura = createHash("sha256").update(`${appId}${ts}${corpo}${secret}`).digest("hex");

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${assinatura}`,
    },
    body: corpo,
    cache: "no-store",
  });
  const json = (await resp.json().catch(() => ({}))) as RespostaShopee;
  if (!resp.ok || json.errors?.length) {
    throw new Error(`Shopee recusou a consulta: ${json.errors?.[0]?.message || `HTTP ${resp.status}`}`);
  }
  return json;
}

const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

export async function buscar(
  termo: string,
  ordem: OrdemShopee = 2,
  limite = 20,
  pagina = 1
): Promise<Produto[]> {
  const filtros = [
    termo ? `keyword: ${JSON.stringify(termo)}` : "",
    `sortType: ${ordem}`,
    `page: ${pagina}`,
    `limit: ${limite}`,
  ]
    .filter(Boolean)
    .join(", ");

  const query = `{ productOfferV2(${filtros}) { nodes { itemId productName priceMin priceMax sales ratingStar commissionRate imageUrl shopName productLink offerLink } } }`;

  const json = await consultaShopee(query);

  const nos: No[] = json.data?.productOfferV2?.nodes || [];
  return nos.map((n, i) => {
    const comissao = numero(n.commissionRate);
    return {
      plataforma: "shopee" as const,
      id: String(n.itemId ?? i),
      nome: n.productName || "(sem nome)",
      preco: numero(n.priceMin),
      vendas: numero(n.sales),
      avaliacao: numero(n.ratingStar),
      comissaoPct: comissao === null ? null : Math.round(comissao * 1000) / 10,
      posicao: ordem === 2 ? (pagina - 1) * limite + i + 1 : null,
      imagem: n.imageUrl || null,
      link: n.offerLink || n.productLink || null,
      loja: n.shopName || null,
    };
  });
}

/**
 * Várias páginas dos mais vendidos, sem repetir produto. Uma página só (20
 * itens) acaba em 4 envios; com mais páginas o grupo tem oferta nova o dia todo.
 * Se uma página falhar depois da primeira, fica o que já veio.
 */
export async function maisVendidosVariasPaginas(termo: string, paginas = 5): Promise<Produto[]> {
  const todos: Produto[] = [];
  const vistos = new Set<string>();
  for (let p = 1; p <= paginas; p++) {
    let lote: Produto[];
    try {
      lote = await buscar(termo, 2, 20, p);
    } catch (e) {
      if (p === 1) throw e;
      break;
    }
    for (const item of lote) {
      if (vistos.has(item.id)) continue;
      vistos.add(item.id);
      todos.push(item);
    }
    if (lote.length < 20) break;
  }
  return todos;
}

export type ConversaoShopee = {
  /** Identificador estável do item vendido (pedido + posição do item). */
  chave: string;
  pedido: string;
  quando: string;
  produto: string;
  valor: number;
  comissao: number;
  status: string;
};

/**
 * Suas vendas como afiliado (relatório de conversões da Shopee).
 * ATENÇÃO: escrito pela documentação e ainda não testado com conta real; se a
 * Shopee recusar algum campo, a mensagem dela aparece no painel.
 */
export async function conversoes(inicio: Date, fim: Date): Promise<ConversaoShopee[]> {
  const de = Math.floor(inicio.getTime() / 1000);
  const ate = Math.floor(fim.getTime() / 1000);
  const saida: ConversaoShopee[] = [];
  let scroll = "";

  for (let pagina = 0; pagina < 6; pagina++) {
    const filtros = [
      `purchaseTimeStart: ${de}`,
      `purchaseTimeEnd: ${ate}`,
      "limit: 500",
      scroll ? `scrollId: ${JSON.stringify(scroll)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const query = `{ conversionReport(${filtros}) { nodes { purchaseTime conversionId orders { orderId orderStatus items { itemName itemPrice qty actualAmount itemTotalCommission } } } pageInfo { hasNextPage scrollId } } }`;
    const json = await consultaShopee(query);
    const rel = json.data?.conversionReport;
    for (const n of rel?.nodes || []) {
      for (const o of n.orders || []) {
        for (const [posicao, it] of (o.items || []).entries()) {
          const qtd = numero(it.qty) ?? 1;
          saida.push({
            chave: `${o.orderId ?? n.conversionId ?? ""}:${posicao}`,
            pedido: String(o.orderId ?? n.conversionId ?? ""),
            quando: new Date((numero(n.purchaseTime) ?? 0) * 1000).toISOString(),
            produto: String(it.itemName || "(sem nome)"),
            valor: numero(it.actualAmount) ?? (numero(it.itemPrice) ?? 0) * qtd,
            comissao: numero(it.itemTotalCommission) ?? 0,
            status: String(o.orderStatus || ""),
          });
        }
      }
    }
    if (!rel?.pageInfo?.hasNextPage || !rel.pageInfo.scrollId) break;
    scroll = rel.pageInfo.scrollId;
  }
  return saida;
}
