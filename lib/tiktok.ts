/**
 * TikTok Shop — Partner API, lado do criador (afiliado)
 * Documentação: https://partner.tiktokshop.com/docv2
 *
 * ATENÇÃO: integração NÃO TESTADA. Foi escrita a partir da documentação pública,
 * sem credenciais para validar. O formato do corpo e da resposta pode precisar
 * de ajuste — quando a API responder com erro, a mensagem original aparece na tela.
 *
 * O que a API oferece: busca de produtos com colaboração aberta (os que
 * afiliados podem divulgar), com preço e comissão. Não existe endpoint público
 * de "mais vendidos do TikTok Shop".
 *
 * Exige: app aprovado no Partner Center (app key + secret) e o access token de
 * uma conta de criador que autorizou o app.
 */
import { cfg } from "./config";
import { createHmac } from "crypto";
import type { Produto } from "./types";

const HOST = process.env.TIKTOK_API_HOST || "https://open-api.tiktokglobalshop.com";
const CAMINHO =
  process.env.TIKTOK_SEARCH_PATH ||
  "/affiliate_creator/202405/open_collaborations/products/search";

export function tiktokConfigurado(): boolean {
  return Boolean(
    cfg("TIKTOK_APP_KEY") &&
      cfg("TIKTOK_APP_SECRET") &&
      cfg("TIKTOK_ACCESS_TOKEN")
  );
}

/** Assinatura padrão da API 202309+: HMAC-SHA256(secret, secret + caminho + params ordenados + corpo + secret) */
function assinar(caminho: string, params: Record<string, string>, corpo: string, secret: string) {
  const ordenado = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHmac("sha256", secret)
    .update(`${secret}${caminho}${ordenado}${corpo}${secret}`)
    .digest("hex");
}

type Bruto = Record<string, unknown>;

const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function buscar(termo: string, limite = 20): Promise<Produto[]> {
  const secret = cfg("TIKTOK_APP_SECRET") || "";
  const params: Record<string, string> = {
    app_key: cfg("TIKTOK_APP_KEY") || "",
    timestamp: String(Math.floor(Date.now() / 1000)),
    page_size: String(Math.min(limite, 20)),
  };
  const corpo = JSON.stringify(termo ? { title_keywords: [termo] } : {});
  const sign = assinar(CAMINHO, params, corpo, secret);

  const url = `${HOST}${CAMINHO}?${new URLSearchParams({ ...params, sign })}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": cfg("TIKTOK_ACCESS_TOKEN") || "",
    },
    body: corpo,
    cache: "no-store",
  });

  const json = (await resp.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
    data?: { products?: Bruto[] };
  };
  if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(
      `TikTok Shop recusou a consulta (${json.code ?? resp.status}): ${json.message || "erro"}`
    );
  }

  const lista = json.data?.products || [];
  return lista.map((p, i) => {
    const preco = (p.original_price || p.sale_price || {}) as Bruto;
    const comissao = (p.commission || {}) as Bruto;
    const taxa = numero(comissao.rate);
    return {
      plataforma: "tiktok" as const,
      id: String(p.id ?? i),
      nome: texto(p.title) || "(sem nome)",
      preco: numero(preco.minimum_amount ?? preco.amount),
      vendas: numero(p.units_sold),
      avaliacao: null,
      // A API devolve a taxa em pontos-base (1000 = 10%).
      comissaoPct: taxa === null ? null : taxa / 100,
      posicao: null,
      imagem: texto(p.main_image_url),
      link: texto(p.detail_link),
      loja: texto((p.shop as Bruto | undefined)?.name),
    };
  });
}

export type PedidoAfiliadoTikTok = {
  chave: string;
  quando: string;
  produto: string;
  valor: number;
  comissao: number;
  status: string;
};

const CAMINHO_PEDIDOS =
  process.env.TIKTOK_ORDERS_PATH || "/affiliate_creator/202410/orders/search";

/**
 * Suas vendas como afiliado no TikTok Shop (Search Creator Affiliate Orders).
 * ATENÇÃO: NÃO TESTADO. A documentação pública confirma o endereço, mas não
 * consegui conferir o formato exato da resposta; os campos abaixo são lidos de
 * forma tolerante e podem precisar de ajuste com uma conta real.
 */
export async function pedidosAfiliado(inicio: Date, fim: Date): Promise<PedidoAfiliadoTikTok[]> {
  const secret = cfg("TIKTOK_APP_SECRET");
  const saida: PedidoAfiliadoTikTok[] = [];
  let pagina = "";

  for (let volta = 0; volta < 6; volta++) {
    const params: Record<string, string> = {
      app_key: cfg("TIKTOK_APP_KEY"),
      timestamp: String(Math.floor(Date.now() / 1000)),
      page_size: "50",
      ...(pagina ? { page_token: pagina } : {}),
    };
    const corpo = JSON.stringify({
      create_time_ge: Math.floor(inicio.getTime() / 1000),
      create_time_lt: Math.floor(fim.getTime() / 1000),
    });
    const sign = assinar(CAMINHO_PEDIDOS, params, corpo, secret);
    const resp = await fetch(`${HOST}${CAMINHO_PEDIDOS}?${new URLSearchParams({ ...params, sign })}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tts-access-token": cfg("TIKTOK_ACCESS_TOKEN") },
      body: corpo,
      cache: "no-store",
    });
    const json = (await resp.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      data?: { orders?: Bruto[]; next_page_token?: string };
    };
    if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
      throw new Error(`TikTok Shop recusou a consulta de vendas (${json.code ?? resp.status}): ${json.message || "erro"}`);
    }

    for (const o of json.data?.orders || []) {
      const itens = (Array.isArray(o.skus) ? o.skus : Array.isArray(o.line_items) ? o.line_items : [o]) as Bruto[];
      itens.forEach((it, posicao) => {
        const preco = (it.price || it.sale_price || {}) as Bruto;
        const com = (it.estimated_commission || it.actual_commission || it.commission || {}) as Bruto;
        const qtd = numero(it.quantity) ?? 1;
        saida.push({
          chave: `${o.id ?? o.order_id ?? volta}:${posicao}`,
          quando: new Date((numero(o.create_time) ?? 0) * 1000).toISOString(),
          produto: texto(it.product_name) || texto(it.title) || `Produto ${it.product_id ?? ""}`.trim(),
          valor: (numero(preco.amount ?? it.price) ?? 0) * qtd,
          comissao: numero(com.amount ?? it.estimated_commission) ?? 0,
          status: texto(o.status) || "",
        });
      });
    }
    pagina = json.data?.next_page_token || "";
    if (!pagina) break;
  }
  return saida;
}
