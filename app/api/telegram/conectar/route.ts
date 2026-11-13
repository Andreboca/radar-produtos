import { NextResponse } from "next/server";
import { conectarTelegram, enviarTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const conversa = await conectarTelegram();
    await enviarTelegram("✅ <b>Radar de Produtos</b>\nTelegram conectado. Os avisos vão chegar aqui.");
    return NextResponse.json({ conversa });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
