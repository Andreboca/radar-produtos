import { NextResponse } from "next/server";
import { consultar } from "@/lib/consultar";
import * as meli from "@/lib/meli";
import * as shopee from "@/lib/shopee";
import * as tiktok from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const corpo = await req.json().catch(() => ({}));
  const termo = String(corpo.termo || "").trim().slice(0, 120);
  if (!termo) {
    return NextResponse.json({ erro: "Informe o nome do produto." }, { status: 400 });
  }

  const resultados = await Promise.all([
    consultar("meli", meli.meliConfigurado(), async () => ({
      produtos: await meli.buscar(termo),
    })),
    consultar("shopee", shopee.shopeeConfigurada(), async () => ({
      produtos: await shopee.buscar(termo, 2),
    })),
    consultar("tiktok", tiktok.tiktokConfigurado(), async () => ({
      produtos: await tiktok.buscar(termo),
    })),
  ]);

  return NextResponse.json({ resultados });
}
