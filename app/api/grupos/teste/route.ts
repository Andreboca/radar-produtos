import { NextResponse } from "next/server";
import { enviarTelegram, telegramGrupoConfigurado } from "@/lib/telegram";
import { enviarWhatsApp, whatsappConfigurado } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Manda uma mensagem de teste a cada grupo configurado. */
export async function POST() {
  const partes: string[] = [];
  if (telegramGrupoConfigurado()) {
    try {
      await enviarTelegram("✅ <b>Radar de Produtos</b>\nGrupo conectado. As ofertas automáticas vão chegar aqui.", "grupo");
      partes.push("Telegram: enviado.");
    } catch (e) {
      partes.push(`Telegram: ${e instanceof Error ? e.message : "falhou"}`);
    }
  }
  if (whatsappConfigurado()) {
    try {
      await enviarWhatsApp("✅ *Radar de Produtos*\nGrupo conectado. As ofertas automáticas vão chegar aqui.");
      partes.push("WhatsApp: enviado.");
    } catch (e) {
      partes.push(`WhatsApp: ${e instanceof Error ? e.message : "falhou"}`);
    }
  }
  if (!partes.length) {
    return NextResponse.json({ erro: "Nenhum grupo escolhido na aba Conexões." }, { status: 400 });
  }
  return NextResponse.json({ mensagem: partes.join(" ") });
}
