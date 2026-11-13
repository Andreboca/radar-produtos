import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { contas, desconectar, linkAutorizacao, tiktokAppConfigurado } from "@/lib/tiktokContas";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!tiktokAppConfigurado()) {
    return NextResponse.json({
      configurado: false,
      contas: [],
      link: null,
      aviso:
        "Faltam a chave e o segredo do app do TikTok (TIKTOK_APP_KEY e TIKTOK_APP_SECRET).",
    });
  }

  try {
    const lista = await contas();
    return NextResponse.json({
      configurado: true,
      contas: lista.map((c) => ({
        openId: c.openId,
        nome: c.nome,
        conectadaEm: c.conectadaEm,
        escopos: c.escopos,
        venceEm: new Date(c.expiraEm).toISOString(),
        erro: c.erro ?? null,
      })),
      link: linkAutorizacao(randomBytes(12).toString("hex")),
    });
  } catch (e) {
    return NextResponse.json(
      { configurado: true, contas: [], link: null, erro: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const openId = new URL(req.url).searchParams.get("openId");
  if (!openId) {
    return NextResponse.json({ erro: "Informe qual conta desconectar." }, { status: 400 });
  }
  await desconectar(openId);
  return NextResponse.json({ ok: true });
}
