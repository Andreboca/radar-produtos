import { NextResponse } from "next/server";
import { gerarPromptImagem, type TipoImagem } from "@/lib/agenteImagem";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as { tipo: TipoImagem; produto?: string; influencia?: string };
    if (!corpo.produto) {
      return NextResponse.json({ erro: "Arraste a foto do produto primeiro." }, { status: 400 });
    }
    const resultado = await gerarPromptImagem(corpo.tipo, corpo.produto, corpo.influencia);
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao gerar o prompt." }, { status: 500 });
  }
}
