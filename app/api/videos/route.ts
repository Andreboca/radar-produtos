import { NextResponse } from "next/server";
import * as fastmoss from "@/lib/fastmoss";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Os vídeos que venderam um produto do TikTok Shop, pela FastMoss. */
export async function POST(req: Request) {
  const corpo = await req.json().catch(() => ({}));
  const produtoId = String(corpo.produtoId || "").trim();

  if (!produtoId) {
    return NextResponse.json({ erro: "Informe o produto." }, { status: 400 });
  }
  if (!fastmoss.fastmossConfigurado()) {
    return NextResponse.json(
      { erro: "Falta a chave FASTMOSS_TOKEN para ver os vídeos." },
      { status: 400 }
    );
  }

  const ordem = fastmoss.ehOrdemVideo(corpo.ordem) ? corpo.ordem : "gmv";
  const moeda = typeof corpo.moeda === "string" && corpo.moeda ? corpo.moeda : "BRL";
  // "todos" | "pagos" | "organicos"
  const tipo = corpo.tipo === "pagos" ? true : corpo.tipo === "organicos" ? false : undefined;

  try {
    const videos = await fastmoss.videosDoProduto(produtoId, {
      ordem,
      moeda,
      somenteAnuncio: tipo,
    });
    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro inesperado." },
      { status: 502 }
    );
  }
}
