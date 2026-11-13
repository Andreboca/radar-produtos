import { NextResponse } from "next/server";
import { rodarMonitor } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const corpo = await req.json().catch(() => ({}));
    const r = await rodarMonitor(Boolean(corpo.resumo));
    return NextResponse.json({ novos: r.novos.length, aviso: r.aviso });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
