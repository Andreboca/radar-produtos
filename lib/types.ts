export type IdPlataforma = "meli" | "shopee" | "tiktok";

/** Um produto vindo da API oficial de uma plataforma. Campos nulos = a API não informa. */
export type Produto = {
  plataforma: IdPlataforma;
  id: string;
  nome: string;
  preco: number | null;
  vendas: number | null;
  avaliacao: number | null;
  comissaoPct: number | null;
  posicao: number | null;
  imagem: string | null;
  link: string | null;
  loja: string | null;
  /** Código ISO da moeda do preço (BRL, USD, GBP). Ausente = BRL. */
  moeda?: string | null;
  /** Quanto o produto faturou no período (GMV), na moeda acima. */
  faturamento?: number | null;
};

export type Tendencia = { termo: string; url: string };

/** Um vídeo do TikTok que vendeu um produto. Para estudar o gancho e modelar. */
export type VideoProduto = {
  id: string;
  descricao: string;
  capa: string | null;
  link: string | null;
  views: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  vendas: number | null;
  faturamento: number | null;
  moeda: string | null;
  /** O vídeo foi impulsionado com anúncio pago. */
  anuncio: boolean;
  publicadoEm: number | null;
};

/** Como ordenar os vídeos de um produto. */
export type OrdemVideo = "gmv" | "units_sold" | "play_count" | "digg_count";

export function ehOrdemVideo(v: unknown): v is OrdemVideo {
  return v === "gmv" || v === "units_sold" || v === "play_count" || v === "digg_count";
}

export type ResultadoPlataforma = {
  plataforma: IdPlataforma;
  nome: string;
  configurada: boolean;
  produtos: Produto[];
  tendencias?: Tendencia[];
  erro?: string;
  aviso?: string;
};

export type Categoria = { id: string; nome: string };

/**
 * Países que o painel oferece no ranking do TikTok Shop (via FastMoss).
 * Fica aqui, e não em lib/fastmoss.ts, porque a tela é client component e
 * aquele arquivo lê configuração do disco.
 */
export const REGIOES = [
  { id: "BR", nome: "Brasil", moeda: "BRL" },
  { id: "US", nome: "Estados Unidos", moeda: "USD" },
  { id: "GB", nome: "Reino Unido", moeda: "GBP" },
] as const;

export type Regiao = (typeof REGIOES)[number]["id"];

export function ehRegiao(v: unknown): v is Regiao {
  return REGIOES.some((r) => r.id === v);
}

/**
 * Como ordenar o ranking do TikTok Shop. "gmv" é faturamento: mostra quem está
 * levando mais dinheiro, não quem vendeu mais peças baratas.
 */
export type Ordem = "gmv" | "units_sold" | "growth_rate";

export function ehOrdem(v: unknown): v is Ordem {
  return v === "gmv" || v === "units_sold" || v === "growth_rate";
}

export const NOMES: Record<IdPlataforma, string> = {
  meli: "Mercado Livre",
  shopee: "Shopee",
  tiktok: "TikTok Shop",
};
