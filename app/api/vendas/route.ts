import { NextResponse } from "next/server";
import { apagarManual, painel } from "@/lib/vendas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const falha = (e: unknown, status = 500) =>
  NextResponse.json({ erro: e instanceof Error ? e.message : "Erro inesperado." }, { status });

export async function GET(req: Request) {
  try {
    const pedido = Number(new URL(req.url).searchParams.get("dias"));
    const dias = [1, 7, 30].includes(pedido) ? pedido : 30;
    return NextResponse.json({ painel: await painel(dias) });
  } catch (e) {
    return falha(e);
  }
}

export async function DELETE(req: Request) {
  try {
    await apagarManual(new URL(req.url).searchParams.get("id") || "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return falha(e);
  }
}
