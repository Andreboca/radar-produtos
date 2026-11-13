export type Plataforma = {
  id: string;
  nome: string;
  comissaoPct: number;
  taxaFixa: number;
  obs: string;
};

/**
 * Valores de partida APROXIMADOS (referência: novembro de 2026).
 * As taxas mudam com frequência e variam por categoria, faixa de preço e
 * tipo de conta. Confira na central do vendedor de cada plataforma e ajuste
 * na tela da calculadora.
 */
export const PLATAFORMAS_PADRAO: Plataforma[] = [
  {
    id: "tiktok",
    nome: "TikTok Shop",
    comissaoPct: 6,
    taxaFixa: 6,
    obs: "Itens abaixo de R$ 50 podem pagar comissão maior. Comissão de afiliado é à parte.",
  },
  {
    id: "meli",
    nome: "Mercado Livre",
    comissaoPct: 14,
    taxaFixa: 0,
    obs: "Clássico ~10–14%, Premium ~15–18% conforme a categoria. Abaixo de R$ 79 há custo extra por item.",
  },
  {
    id: "shopee",
    nome: "Shopee",
    comissaoPct: 20,
    taxaFixa: 4,
    obs: "A taxa fixa sobe conforme a faixa de preço do produto.",
  },
];

export type Entrada = {
  custo: number;
  preco: number;
  envio: number;
  impostoPct: number;
  afiliadoPct: number;
};

export type Resultado = {
  taxas: number;
  imposto: number;
  afiliado: number;
  lucro: number;
  margemPct: number;
  roiPct: number;
};

export function calcular(p: Plataforma, e: Entrada): Resultado {
  const taxas = (e.preco * p.comissaoPct) / 100 + p.taxaFixa;
  const imposto = (e.preco * e.impostoPct) / 100;
  const afiliado = (e.preco * e.afiliadoPct) / 100;
  const lucro = e.preco - e.custo - e.envio - taxas - imposto - afiliado;
  return {
    taxas,
    imposto,
    afiliado,
    lucro,
    margemPct: e.preco > 0 ? (lucro / e.preco) * 100 : 0,
    roiPct: e.custo > 0 ? (lucro / e.custo) * 100 : 0,
  };
}
