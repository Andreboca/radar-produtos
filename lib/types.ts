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
};

export type Tendencia = { termo: string; url: string };

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

export const NOMES: Record<IdPlataforma, string> = {
  meli: "Mercado Livre",
  shopee: "Shopee",
  tiktok: "TikTok Shop",
};
