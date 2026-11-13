import { NextResponse } from "next/server";
import { salvarConfig } from "@/lib/monitor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const config = await salvarConfig({
      categoriasMeli: Array.isArray(corpo.categoriasMeli) ? corpo.categoriasMeli : [],
      termos: Array.isArray(corpo.termos) ? corpo.termos : [],
    });
    return NextResponse.json({ config });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
