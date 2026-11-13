import { cfg } from "./config";
/**
 * Envio para grupo de WhatsApp.
 *
 * A API oficial do WhatsApp só libera grupos para contas com selo oficial e
 * limita cada grupo a 8 pessoas, então aqui o envio usa um conector que opera
 * um número de WhatsApp comum. Dois são suportados:
 *
 *   evolution  Evolution API (código aberto, você hospeda)  https://doc.evolution-api.com
 *   zapi       Z-API (serviço pago brasileiro)              https://developer.z-api.io
 *
 * ATENÇÃO: esses conectores não são oficiais. O WhatsApp pode restringir ou
 * banir números que automatizam envios. Use um número separado do pessoal.
 */

type Provedor = "evolution" | "zapi";

function provedor(): Provedor | null {
  const p = (cfg("WHATSAPP_PROVEDOR") || "").toLowerCase();
  return p === "evolution" || p === "zapi" ? p : null;
}

/** As chaves do conector estão preenchidas (ainda sem olhar o grupo). */
export function whatsappTemConector(): boolean {
  const p = provedor();
  if (p === "evolution") return Boolean(cfg("EVOLUTION_URL") && cfg("EVOLUTION_INSTANCIA") && cfg("EVOLUTION_API_KEY"));
  if (p === "zapi") return Boolean(cfg("ZAPI_INSTANCIA") && cfg("ZAPI_TOKEN") && cfg("ZAPI_CLIENT_TOKEN"));
  return false;
}

export function whatsappConfigurado(): boolean {
  const p = provedor();
  if (!cfg("WHATSAPP_GRUPO_ID")) return false;
  if (p === "evolution") {
    return Boolean(
      cfg("EVOLUTION_URL") && cfg("EVOLUTION_INSTANCIA") && cfg("EVOLUTION_API_KEY")
    );
  }
  if (p === "zapi") {
    return Boolean(
      cfg("ZAPI_INSTANCIA") && cfg("ZAPI_TOKEN") && cfg("ZAPI_CLIENT_TOKEN")
    );
  }
  return false;
}

/** Envia texto ao grupo. Aceita a formatação do WhatsApp (*negrito*). */
export async function enviarWhatsApp(texto: string): Promise<void> {
  const p = provedor();
  const grupo = cfg("WHATSAPP_GRUPO_ID") || "";
  if (!p || !whatsappConfigurado()) throw new Error("WhatsApp não configurado.");

  let url: string;
  let headers: Record<string, string>;
  let corpo: Record<string, unknown>;

  if (p === "evolution") {
    // ID do grupo no formato 1203630xxxxxxxxxxx@g.us
    url = `${(cfg("EVOLUTION_URL") || "").replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(
      cfg("EVOLUTION_INSTANCIA") || ""
    )}`;
    headers = { apikey: cfg("EVOLUTION_API_KEY") || "" };
    corpo = { number: grupo, text: texto };
  } else {
    // ID do grupo no formato 1203630xxxxxxxxxxx-group
    url = `https://api.z-api.io/instances/${cfg("ZAPI_INSTANCIA")}/token/${cfg("ZAPI_TOKEN")}/send-text`;
    headers = { "Client-Token": cfg("ZAPI_CLIENT_TOKEN") || "" };
    corpo = { phone: grupo, message: texto };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => "");
    throw new Error(`WhatsApp (${p}) recusou o envio: ${resp.status} ${detalhe.slice(0, 200)}`);
  }
}

export type GrupoWhats = { id: string; nome: string };

async function chamar(caminhoEvolution: string, caminhoZapi: string): Promise<unknown> {
  const p = provedor();
  if (!p) throw new Error("Escolha o conector do WhatsApp primeiro.");
  const url =
    p === "evolution"
      ? `${cfg("EVOLUTION_URL").replace(/\/+$/, "")}${caminhoEvolution.replace(
          "{i}",
          encodeURIComponent(cfg("EVOLUTION_INSTANCIA"))
        )}`
      : `https://api.z-api.io/instances/${cfg("ZAPI_INSTANCIA")}/token/${cfg("ZAPI_TOKEN")}${caminhoZapi}`;
  const headers: Record<string, string> =
    p === "evolution" ? { apikey: cfg("EVOLUTION_API_KEY") } : { "Client-Token": cfg("ZAPI_CLIENT_TOKEN") };
  const resp = await fetch(url, { headers, cache: "no-store" });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`WhatsApp (${p}) respondeu ${resp.status}: ${texto.slice(0, 200)}`);
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`WhatsApp (${p}) devolveu uma resposta inesperada.`);
  }
}

/** Confere se o número está conectado no conector. */
export async function testarWhatsApp(): Promise<string> {
  const r = (await chamar("/instance/connectionState/{i}", "/status")) as {
    instance?: { state?: string };
    connected?: boolean;
  };
  const ligado = r.instance?.state === "open" || r.connected === true;
  if (!ligado) {
    throw new Error("As chaves funcionam, mas o número não está conectado. Leia o QR code no painel do conector.");
  }
  return "número conectado";
}

/** Grupos de que o número participa, para escolher na tela. */
export async function listarGruposWhatsApp(): Promise<GrupoWhats[]> {
  const r = await chamar("/group/fetchAllGroups/{i}?getParticipants=false", "/groups?page=1&pageSize=100");
  const lista = Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
  return lista
    .filter((g) => provedor() === "evolution" || g.isGroup !== false)
    .map((g) => ({
      id: String(g.id ?? g.phone ?? ""),
      nome: String(g.subject ?? g.name ?? g.id ?? g.phone ?? ""),
    }))
    .filter((g) => g.id);
}
