/**
 * TikTok Shop — Affiliate Creator API (oficial)
 *
 * Endereços conferidos na API Reference do Partner Center:
 *   POST /affiliate_creator/202405/open_collaborations/products/search
 *        escopo creator.affiliate_collaboration.read
 *        aceita sort_field = units_sold | commission_rate | commission |
 *        product_sales_price, e sort_order = ASC | DESC. É daqui que sai a
 *        lista de "mais vendidos" entre os produtos que você pode divulgar.
 *   POST /affiliate_creator/202505/affiliate_sharing_links/general_publishers/generate_batch
 *        escopo creator.affiliate.share_link.read — gera o link de divulgação.
 *
 * Os dois endereços abaixo vêm da mesma referência, pela versão que a página
 * de cada um declara; se algum responder 404, ajuste pela variável de ambiente
 * correspondente sem mexer no código.
 *   GET  /affiliate_creator/202508/profiles          (Get Creator Profile)
 *   POST /affiliate_creator/202410/orders/search     (Search Creator Affiliate Orders)
 *
 * Toda chamada vai assinada e com o access token da conta de criador
 * (x-tts-access-token). Os tokens ficam em lib/tiktokContas.ts.
 */
import { createHmac } from "crypto";
import { cfg } from "./config";
import {
  contas,
  guardarNome,
  tiktokAppConfigurado,
  tokenDaConta,
  type Conta,
} from "./tiktokContas";
import type { Produto } from "./types";

const HOST = process.env.TIKTOK_API_HOST || "https://open-api.tiktokglobalshop.com";
const P_BUSCA =
  process.env.TIKTOK_PATH_BUSCA || "/affiliate_creator/202405/open_collaborations/products/search";
const P_LINK =
  process.env.TIKTOK_PATH_LINK ||
  "/affiliate_creator/202505/affiliate_sharing_links/general_publishers/generate_batch";
const P_PERFIL = process.env.TIKTOK_PATH_PERFIL || "/affiliate_creator/202508/profiles";
const P_PEDIDOS = process.env.TIKTOK_PATH_PEDIDOS || "/affiliate_creator/202410/orders/search";

type Bruto = Record<string, unknown>;

const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};
const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Produtos e links: precisa do app configurado e de pelo menos uma conta conectada. */
export function tiktokConfigurado(): boolean {
  return tiktokAppConfigurado();
}

export { tiktokAppConfigurado };

/** Vendas: mesma exigência; mantido separado porque o painel trata as fontes uma a uma. */
export function tiktokVendasConfigurado(): boolean {
  return tiktokAppConfigurado();
}

/**
 * Assinatura da API 202309+:
 * HMAC-SHA256(secret, secret + caminho + params ordenados + corpo + secret).
 * `sign` e `access_token` ficam de fora dos params assinados.
 */
function assinar(caminho: string, params: Record<string, string>, corpo: string): string {
  const secret = cfg("TIKTOK_APP_SECRET");
  const ordenado = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHmac("sha256", secret)
    .update(`${secret}${caminho}${ordenado}${corpo}${secret}`)
    .digest("hex");
}

/** Faz uma chamada assinada em nome de uma conta de criador. */
async function chamar<T = Bruto>(
  caminho: string,
  openId: string,
  opcoes: { metodo?: "GET" | "POST"; query?: Record<string, string>; corpo?: unknown } = {}
): Promise<T> {
  if (!tiktokAppConfigurado()) throw new Error("Faltam a chave e o segredo do app do TikTok.");
  const token = await tokenDaConta(openId);

  const metodo = opcoes.metodo || "POST";
  const corpo = metodo === "POST" ? JSON.stringify(opcoes.corpo ?? {}) : "";
  const params: Record<string, string> = {
    app_key: cfg("TIKTOK_APP_KEY"),
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(opcoes.query || {}),
  };
  const sign = assinar(caminho, params, corpo);

  const resp = await fetch(`${HOST}${caminho}?${new URLSearchParams({ ...params, sign })}`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": token,
    },
    ...(metodo === "POST" ? { body: corpo } : {}),
    cache: "no-store",
  });

  const json = (await resp.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
    data?: T;
  };
  if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(
      `TikTok Shop recusou a chamada (${json.code ?? resp.status}): ${json.message || "sem detalhe"}`
    );
  }
  return (json.data ?? ({} as T)) as T;
}

/** A conta usada para buscar produtos: a primeira conectada, ou a pedida. */
async function contaAtiva(openId?: string): Promise<Conta> {
  const lista = await contas();
  if (!lista.length) {
    throw new Error(
      "Nenhuma conta de criador conectada. Abra o painel, clique em Conectar conta do TikTok e autorize."
    );
  }
  const c = openId ? lista.find((x) => x.openId === openId) : lista[0];
  if (!c) throw new Error("Conta não encontrada.");
  return c;
}

type ProdutoBruto = {
  id?: string;
  title?: string;
  main_image_url?: string;
  detail_link?: string;
  units_sold?: number;
  sales_price?: Bruto;
  original_price?: Bruto;
  commission?: Bruto;
  shop?: Bruto;
};

function montar(p: ProdutoBruto, posicao: number): Produto {
  const venda = (p.sales_price || p.original_price || {}) as Bruto;
  const com = (p.commission || {}) as Bruto;
  const taxa = numero(com.rate);
  return {
    plataforma: "tiktok",
    id: texto(p.id) || String(posicao),
    nome: texto(p.title) || "(sem nome)",
    preco: numero(venda.minimum_amount ?? venda.amount),
    vendas: numero(p.units_sold),
    avaliacao: null,
    // A API devolve a taxa em pontos-base: 1234 = 12,34%.
    comissaoPct: taxa === null ? null : taxa / 100,
    posicao,
    imagem: texto(p.main_image_url),
    link: texto(p.detail_link),
    loja: texto((p.shop as Bruto | undefined)?.name),
  };
}

/**
 * Produtos com colaboração aberta, ordenados pelos mais vendidos.
 * `termo` vira palavra-chave de busca; vazio traz o ranking geral.
 */
export async function buscar(termo = "", limite = 20, openId?: string): Promise<Produto[]> {
  const conta = await contaAtiva(openId);
  const tamanho = Math.min(Math.max(limite, 1), 20);

  const data = await chamar<{ products?: ProdutoBruto[]; next_page_token?: string }>(P_BUSCA, conta.openId, {
    metodo: "POST",
    query: {
      page_size: String(tamanho),
      sort_field: process.env.TIKTOK_ORDENAR_POR || "units_sold",
      sort_order: "DESC",
    },
    corpo: termo.trim() ? { title_keywords: [termo.trim()] } : {},
  });

  return (data.products || []).map((p, i) => montar(p, i + 1));
}

/**
 * Gera o link de divulgação (afiliado) de um produto, em nome da conta.
 * O tipo de material tem de ser PRODUCT, conforme a documentação.
 */
export async function gerarLinkAfiliado(produtoId: string, openId?: string): Promise<string | null> {
  const conta = await contaAtiva(openId);
  const data = await chamar<{ sharing_links?: Bruto[]; links?: Bruto[] }>(P_LINK, conta.openId, {
    metodo: "POST",
    corpo: { materials: [{ type: "PRODUCT", id: produtoId }] },
  });
  const lista = (data.sharing_links || data.links || []) as Bruto[];
  for (const item of lista) {
    const url =
      texto(item.sharing_link) ||
      texto(item.share_link) ||
      texto(item.link) ||
      texto(item.url);
    if (url) return url;
  }
  return null;
}

/** Preenche os links de afiliado de uma lista de produtos, um a um. */
export async function comLinkAfiliado(produtos: Produto[], openId?: string): Promise<Produto[]> {
  const saida: Produto[] = [];
  for (const p of produtos) {
    try {
      const link = await gerarLinkAfiliado(p.id, openId);
      saida.push(link ? { ...p, link } : p);
    } catch {
      // Sem o link de afiliado, o produto ainda aparece, com o link comum.
      saida.push(p);
    }
  }
  return saida;
}

/** Perfil da conta de criador; guarda o nome para aparecer no painel. */
export async function perfil(openId: string): Promise<{ nome: string | null; regiao: string | null }> {
  const data = await chamar<Bruto>(P_PERFIL, openId, { metodo: "GET" });
  const nome = texto(data.username);
  if (nome) await guardarNome(openId, nome);
  return { nome, regiao: texto(data.register_region) };
}

export type PedidoAfiliadoTikTok = {
  chave: string;
  quando: string;
  produto: string;
  valor: number;
  comissao: number;
  status: string;
};

/** Suas vendas de afiliado, somando todas as contas conectadas. */
export async function pedidosAfiliado(inicio: Date, fim: Date): Promise<PedidoAfiliadoTikTok[]> {
  const lista = await contas();
  if (!lista.length) throw new Error("Nenhuma conta de criador conectada.");

  const saida: PedidoAfiliadoTikTok[] = [];
  const falhas: string[] = [];

  for (const conta of lista) {
    let pagina = "";
    try {
      for (let volta = 0; volta < 6; volta++) {
        const data = await chamar<{ orders?: Bruto[]; next_page_token?: string }>(P_PEDIDOS, conta.openId, {
          metodo: "POST",
          query: { page_size: "50", ...(pagina ? { page_token: pagina } : {}) },
          corpo: {
            create_time_ge: Math.floor(inicio.getTime() / 1000),
            create_time_lt: Math.floor(fim.getTime() / 1000),
          },
        });

        for (const o of data.orders || []) {
          const itens = (Array.isArray(o.skus) ? o.skus : Array.isArray(o.line_items) ? o.line_items : [o]) as Bruto[];
          itens.forEach((it, pos) => {
            const preco = (it.price || it.sale_price || {}) as Bruto;
            const com = (it.estimated_commission || it.actual_commission || it.commission || {}) as Bruto;
            const qtd = numero(it.quantity) ?? 1;
            saida.push({
              chave: `${conta.openId}:${o.id ?? o.order_id ?? volta}:${pos}`,
              quando: new Date((numero(o.create_time) ?? 0) * 1000).toISOString(),
              produto: texto(it.product_name) || texto(it.title) || `Produto ${it.product_id ?? ""}`.trim(),
              valor: (numero(preco.amount ?? it.price) ?? 0) * qtd,
              comissao: numero(com.amount ?? it.estimated_commission) ?? 0,
              status: texto(o.status) || "",
            });
          });
        }

        pagina = texto(data.next_page_token) || "";
        if (!pagina) break;
      }
    } catch (e) {
      falhas.push(`${conta.nome || conta.openId}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  // Se nenhuma conta respondeu, o erro precisa chegar à tela em vez de "0 vendas".
  if (!saida.length && falhas.length === lista.length) throw new Error(falhas.join(" | "));
  return saida;
}
