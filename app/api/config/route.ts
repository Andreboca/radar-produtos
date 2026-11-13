import { NextResponse } from "next/server";
import { CHAVES, resumoCfg, salvarCfg, type Chave } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ config: resumoCfg() });
}

export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as Record<string, unknown>;
    const novos: Partial<Record<Chave, string>> = {};
    for (const chave of CHAVES) {
      if (typeof corpo[chave] === "string") novos[chave] = corpo[chave] as string;
    }
    salvarCfg(novos);
    return NextResponse.json({ config: resumoCfg() });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
