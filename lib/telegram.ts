/**
 * Avisos pelo Telegram (Bot API).
 * O token do bot vem do @BotFather (/newbot). A conversa pessoal e o grupo são
 * descobertos pelo próprio app, a partir das mensagens que o bot recebeu.
 */
import { cfg, salvarCfg } from "./config";

export type Conversa = { id: string; nome: string; grupo: boolean };

export function telegramTemToken(): boolean {
  return Boolean(cfg("TELEGRAM_BOT_TOKEN"));
}

export function telegramConfigurado(): boolean {
  return Boolean(cfg("TELEGRAM_BOT_TOKEN") && cfg("TELEGRAM_CHAT_ID"));
}

/** Grupo que recebe as ofertas automáticas. */
export function telegramGrupoConfigurado(): boolean {
  return Boolean(cfg("TELEGRAM_BOT_TOKEN") && cfg("TELEGRAM_GRUPO_ID"));
}

export const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function api<T>(metodo: string, corpo?: unknown): Promise<T> {
  const token = cfg("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Cole o token do bot do Telegram primeiro.");
  const resp = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: corpo ? "POST" : "GET",
    headers: corpo ? { "content-type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.ok) {
    throw new Error(`Telegram recusou: ${json.description || resp.status}`);
  }
  return json.result as T;
}

/** Confere o token e devolve o @usuario do bot. */
export async function testarTelegram(): Promise<string> {
  const eu = await api<{ username?: string }>("getMe");
  return eu.username ? `@${eu.username}` : "bot";
}

type Chat = { id?: number; type?: string; title?: string; first_name?: string };
type Atualizacao = {
  message?: { chat?: Chat };
  channel_post?: { chat?: Chat };
  my_chat_member?: { chat?: Chat };
};

/** Conversas e grupos onde o bot recebeu alguma mensagem recentemente. */
export async function listarConversas(): Promise<Conversa[]> {
  const lista = await api<Atualizacao[]>("getUpdates");
  const mapa = new Map<string, Conversa>();
  for (const u of lista) {
    const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
    if (chat?.id === undefined) continue;
    mapa.set(String(chat.id), {
      id: String(chat.id),
      nome: chat.title || chat.first_name || String(chat.id),
      grupo: chat.type !== "private",
    });
  }
  return Array.from(mapa.values());
}

/** Liga os avisos pessoais à última conversa privada com o bot. */
export async function conectarTelegram(): Promise<string> {
  const privadas = (await listarConversas()).filter((c) => !c.grupo);
  const conversa = privadas[privadas.length - 1];
  if (!conversa) {
    throw new Error(
      'Nenhuma mensagem encontrada. Abra a conversa com o seu bot no Telegram, envie "oi" e clique de novo.'
    );
  }
  salvarCfg({ TELEGRAM_CHAT_ID: conversa.id });
  return conversa.nome;
}

/** Envia uma mensagem em HTML simples. O Telegram aceita até 4096 caracteres. */
export async function enviarTelegram(
  html: string,
  destino: "voce" | "grupo" = "voce"
): Promise<void> {
  const chat = destino === "grupo" ? cfg("TELEGRAM_GRUPO_ID") : cfg("TELEGRAM_CHAT_ID");
  if (!chat) throw new Error("Telegram não configurado.");
  await api("sendMessage", {
    chat_id: chat,
    text: html.length > 3900 ? `${html.slice(0, 3900)}\n…` : html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

/** Envia uma foto com legenda (até 1024 caracteres, em HTML). */
export async function enviarTelegramFoto(
  foto: string,
  legenda: string,
  destino: "voce" | "grupo" = "voce"
): Promise<void> {
  const chat = destino === "grupo" ? cfg("TELEGRAM_GRUPO_ID") : cfg("TELEGRAM_CHAT_ID");
  if (!chat) throw new Error("Telegram não configurado.");
  await api("sendPhoto", {
    chat_id: chat,
    photo: foto,
    caption: legenda,
    parse_mode: "HTML",
  });
}
