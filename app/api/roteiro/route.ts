import { NextResponse } from "next/server";
import { gerarRoteiro, type PedidoRoteiro } from "@/lib/roteiro";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as PedidoRoteiro;
    if (!corpo.produtoId?.trim()) {
      return NextResponse.json({ erro: "Informe o ID do produto." }, { status: 400 });
    }
    const roteiro = await gerarRoteiro({
      produtoId: corpo.produtoId.trim(),
      plataforma: corpo.plataforma || "meli",
      produtoNome: corpo.produtoNome,
      fala: corpo.fala,
    });
    return NextResponse.json({ ok: true, roteiro });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao gerar o roteiro." }, { status: 500 });
  }
}
