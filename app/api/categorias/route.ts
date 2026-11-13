import { NextResponse } from "next/server";
import { categorias, meliConfigurado } from "@/lib/meli";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!meliConfigurado()) return NextResponse.json({ categorias: [] });
  try {
    return NextResponse.json({ categorias: await categorias() });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ categorias: [], erro });
  }
}
