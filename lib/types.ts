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

export const NOMES: Record<IdPlataforma, string> = {
  meli: "Mercado Livre",
  shopee: "Shopee",
  tiktok: "TikTok Shop",
};
