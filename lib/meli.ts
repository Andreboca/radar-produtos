/**
 * Mercado Livre — API oficial (https://developers.mercadolivre.com.br)
 *
 * Recursos usados:
 *   /sites/MLB/categories               categorias do site
 *   /trends/MLB[/CATEGORIA]             50 buscas em tendência na semana
 *   /highlights/MLB/category/CATEGORIA  20 mais vendidos da categoria
 *   /products/search                    busca no catálogo de produtos
 *   /products/ID  e  /items/ID          detalhes (nome, preço, foto, link)
 */
import { cfg } from "./config";
import type { Categoria, Produto, Tendencia } from "./types";

const BASE = "https://api.mercadolibre.com";
const SITE = "MLB";

let cache: { token: string; expira: number; id: string } | null = null;

export function meliConfigurado(): boolean {
  return Boolean(
    cfg("MELI_ACCESS_TOKEN") ||
      (cfg("MELI_CLIENT_ID") && cfg("MELI_CLIENT_SECRET"))
  );
}

async function token(): Promise<string> {
  if (cfg("MELI_ACCESS_TOKEN")) return cfg("MELI_ACCESS_TOKEN");
  if (cache && cache.id === cfg("MELI_CLIENT_ID") && cache.expira > Date.now()) return cache.token;

  const resp = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg("MELI_CLIENT_ID") || "",
      client_secret: cfg("MELI_CLIENT_SECRET") || "",
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Mercado Livre recusou as credenciais (${resp.status}): ${
        json.message || json.error || "sem detalhe"
      }`
    );
  }
  cache = {
    id: cfg("MELI_CLIENT_ID"),
    token: json.access_token,
    expira: Date.now() + (Number(json.expires_in) || 3600) * 1000 - 60_000,
  };
  return cache.token;
}

async function get<T>(caminho: string): Promise<T> {
  const resp = await fetch(`${BASE}${caminho}`, {
    headers: { authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(
      `Mercado Livre ${resp.status} em ${caminho}: ${json.message || json.error || "erro"}`
    );
  }
  return json as T;
}

export async function categorias(): Promise<Categoria[]> {
  const lista = await get<{ id: string; name: string }[]>(`/sites/${SITE}/categories`);
  return lista.map((c) => ({ id: c.id, nome: c.name }));
}

export async function tendencias(categoria?: string): Promise<Tendencia[]> {
  const lista = await get<{ keyword: string; url: string }[]>(
    `/trends/${SITE}${categoria ? `/${categoria}` : ""}`
  );
  return lista.map((t) => ({ termo: t.keyword, url: t.url }));
}

type DetalheProduto = {
  name?: string;
  permalink?: string;
  pictures?: { url?: string }[];
  buy_box_winner?: { price?: number } | null;
};

type DetalheItem = {
  title?: string;
  price?: number;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  sold_quantity?: number;
};

function vazio(id: string, posicao: number | null): Produto {
  return {
    plataforma: "meli",
    id,
    nome: id,
    preco: null,
    vendas: null,
    avaliacao: null,
    comissaoPct: null,
    posicao,
    imagem: null,
    link: null,
    loja: null,
  };
}

async function detalhar(id: string, tipo: string, posicao: number | null): Promise<Produto> {
  const base = vazio(id, posicao);
  try {
    if (tipo === "ITEM") {
      const i = await get<DetalheItem>(`/items/${id}`);
      return {
        ...base,
        nome: i.title || id,
        preco: i.price ?? null,
        vendas: i.sold_quantity ?? null,
        imagem: i.secure_thumbnail || i.thumbnail || null,
        link: i.permalink || null,
      };
    }
    const p = await get<DetalheProduto>(`/products/${id}`);
    return {
      ...base,
      nome: p.name || id,
      preco: p.buy_box_winner?.price ?? null,
      imagem: p.pictures?.[0]?.url || null,
      link: p.permalink || `https://www.mercadolivre.com.br/p/${id}`,
    };
  } catch {
    // Mantém o item no ranking mesmo sem detalhes.
    return base;
  }
}

/** Top 20 mais vendidos de uma categoria, na ordem do ranking oficial. */
export async function maisVendidos(categoria: string): Promise<Produto[]> {
  const r = await get<{ content?: { id: string; position: number; type: string }[] }>(
    `/highlights/${SITE}/category/${categoria}`
  );
  const itens = r.content || [];
  return Promise.all(itens.map((c) => detalhar(c.id, c.type, c.position)));
}

/** Busca por palavra-chave no catálogo e traz preço atual dos primeiros resultados. */
export async function buscar(termo: string, limite = 10): Promise<Produto[]> {
  const r = await get<{ results?: { id: string }[] }>(
    `/products/search?status=active&site_id=${SITE}&q=${encodeURIComponent(termo)}`
  );
  const ids = (r.results || []).slice(0, limite);
  return Promise.all(ids.map((p) => detalhar(p.id, "PRODUCT", null)));
}

/** Dados de um produto do catálogo pelo ID (ex.: MLB123...). */
export async function produtoPorId(id: string): Promise<Produto> {
  return detalhar(id, "PRODUCT", null);
}
