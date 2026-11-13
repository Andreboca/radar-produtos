import { NextResponse } from "next/server";
import { listarConversas } from "@/lib/telegram";
import { listarGruposWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { canal } = await req.json().catch(() => ({ canal: "" }));
  try {
    const grupos =
      canal === "whatsapp"
        ? await listarGruposWhatsApp()
        : (await listarConversas()).filter((c) => c.grupo).map((c) => ({ id: c.id, nome: c.nome }));
    return NextResponse.json({ grupos });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro }, { status: 500 });
  }
}
