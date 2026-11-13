import { NextResponse } from "next/server";
import { meliConfigurado } from "@/lib/meli";
import { shopeeConfigurada } from "@/lib/shopee";
import { tiktokConfigurado } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    meli: meliConfigurado(),
    shopee: shopeeConfigurada(),
    tiktok: tiktokConfigurado(),
  });
}
