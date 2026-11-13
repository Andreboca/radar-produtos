import { NextResponse } from "next/server";
import { testarIA } from "@/lib/ia";
import * as meli from "@/lib/meli";
import * as shopee from "@/lib/shopee";
import { testarTelegram } from "@/lib/telegram";
import * as tiktok from "@/lib/tiktok";
import { testarWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Faz uma chamada real e leve a cada serviço para confirmar as credenciais. */
const TESTES: Record<string, () => Promise<string>> = {
  meli: async () => `${(await meli.categorias()).length} categorias carregadas`,
  shopee: async () => `${(await shopee.buscar("", 2, 3)).length} produtos recebidos`,
  tiktok: async () => `${(await tiktok.buscar("", 3)).length} produtos recebidos`,
  telegram: async () => `bot ${await testarTelegram()}`,
  whatsapp: testarWhatsApp,
  ia: testarIA,
};

export async function POST(req: Request) {
  const { alvo } = await req.json().catch(() => ({ alvo: "" }));
  const teste = TESTES[String(alvo)];
  if (!teste) return NextResponse.json({ ok: true, mensagem: "Salvo." });
  try {
    return NextResponse.json({ ok: true, mensagem: `Conectado: ${await teste()}.` });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, mensagem });
  }
}
