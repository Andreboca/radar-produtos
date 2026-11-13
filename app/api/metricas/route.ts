import { NextResponse } from "next/server";
import { metricas, type Periodo } from "@/lib/historico";
import type { Produto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const produto = corpo.produto as Produto;
    if (!produto?.id || !produto?.plataforma) {
      return NextResponse.json({ erro: "Produto inválido." }, { status: 400 });
    }
    const periodo: Periodo = ["24h", "7d", "30d"].includes(corpo.periodo) ? corpo.periodo : "7d";
    return NextResponse.json({ metricas: await metricas(produto, periodo) });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
