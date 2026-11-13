import { NextResponse } from "next/server";
import { topVendas } from "@/lib/historico";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const janela = new URL(req.url).searchParams.get("janela") === "1h" ? "1h" : "24h";
    return NextResponse.json({ top: await topVendas(janela) });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
