import { cfg } from "@/lib/config";
import { NextResponse } from "next/server";
import { iaConfigurada } from "@/lib/ia";
import { ler } from "@/lib/monitor";
import { telegramConfigurado, telegramGrupoConfigurado, telegramTemToken } from "@/lib/telegram";
import { whatsappConfigurado } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const estado = await ler();
  return NextResponse.json({
    alertas: estado.alertas,
    config: estado.config,
    ultimaChecagem: estado.ultimaChecagem,
    telegram: telegramConfigurado(),
    telegramToken: telegramTemToken(),
    telegramGrupo: telegramGrupoConfigurado(),
    whatsapp: whatsappConfigurado(),
    ia: iaConfigurada(),
    intervaloMin: Math.max(5, Number(cfg("MONITOR_INTERVALO_MIN") || 30)),
    horaResumo: Number(cfg("MONITOR_HORA_RESUMO") || 9),
  });
}
