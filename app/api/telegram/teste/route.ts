import { NextResponse } from "next/server";
import { enviarTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await enviarTelegram("✅ <b>Radar de Produtos</b>\nOs avisos pelo Telegram estão funcionando.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
