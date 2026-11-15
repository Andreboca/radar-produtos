import { NextResponse } from "next/server";
import { consultar } from "@/lib/consultar";
import * as fastmoss from "@/lib/fastmoss";
import { registrar } from "@/lib/historico";
import * as meli from "@/lib/meli";
import * as shopee from "@/lib/shopee";
import * as tiktok from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const corpo = await req.json().catch(() => ({}));
  const categoria = String(corpo.categoriaMeli || "").trim();
  const termo = String(corpo.termo || "").trim().slice(0, 120);
  const regiao = fastmoss.ehRegiao(corpo.regiao) ? corpo.regiao : "BR";
  const ordem = fastmoss.ehOrdem(corpo.ordem) ? corpo.ordem : "gmv";
  // A FastMoss entrega o ranking de mais vendidos do TikTok Shop, que a API
  // oficial de criador não dá — e funciona no Brasil, que ela ainda não libera.
  const viaFastMoss = fastmoss.fastmossConfigurado();

  const resultados = await Promise.all([
    consultar("meli", meli.meliConfigurado(), async () => {
      const [produtos, tendencias] = await Promise.all([
        categoria ? meli.maisVendidos(categoria) : Promise.resolve([]),
        meli.tendencias(categoria || undefined).catch(() => []),
      ]);
      return {
        produtos,
        tendencias,
        aviso: categoria
          ? undefined
          : "Escolha uma categoria para ver o ranking de mais vendidos. Sem categoria, a API só informa as buscas em tendência.",
      };
    }),
    consultar("shopee", shopee.shopeeConfigurada(), async () => ({
      produtos: await shopee.buscar(termo, 2),
      aviso: termo
        ? undefined
        : "Sem palavra-chave: ofertas do programa de afiliados ordenadas por vendas.",
    })),
    consultar("tiktok", viaFastMoss || tiktok.tiktokConfigurado(), async () => {
      if (viaFastMoss) {
        const nome = fastmoss.REGIOES.find((r) => r.id === regiao)?.nome || regiao;
        const criterio =
          ordem === "gmv"
            ? "por faturamento"
            : ordem === "growth_rate"
            ? "por crescimento"
            : "por unidades vendidas";
        return {
          produtos: await fastmoss.maisVendidos(regiao, ordem),
          aviso: `TikTok Shop em ${nome}, ${criterio}, pela FastMoss (dados de ontem). O link é o da loja, não o seu link de afiliado.`,
        };
      }
      return {
        produtos: await tiktok.buscar(termo),
        aviso:
          "Produtos com colaboração aberta para afiliados. A API do TikTok Shop não tem ranking de mais vendidos.",
      };
    }),
  ]);

  await registrar(resultados.flatMap((r) => r.produtos));
  return NextResponse.json({ resultados });
}
