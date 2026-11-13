/**
 * Configurações preenchidas na tela "Conexões".
 * Ficam em data/config.json, no seu computador. Se a chave não estiver lá,
 * vale o que estiver no .env.local (opcional).
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

const ARQUIVO = path.join(process.cwd(), "data", "config.json");

export const CHAVES = [
  "MELI_CLIENT_ID",
  "MELI_CLIENT_SECRET",
  "MELI_ACCESS_TOKEN",
  "SHOPEE_APP_ID",
  "SHOPEE_SECRET",
  "TIKTOK_APP_KEY",
  "TIKTOK_APP_SECRET",
  "TIKTOK_ACCESS_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_GRUPO_ID",
  "WHATSAPP_PROVEDOR",
  "WHATSAPP_GRUPO_ID",
  "EVOLUTION_URL",
  "EVOLUTION_INSTANCIA",
  "EVOLUTION_API_KEY",
  "ZAPI_INSTANCIA",
  "ZAPI_TOKEN",
  "ZAPI_CLIENT_TOKEN",
  "ANTHROPIC_API_KEY",
  "MONITOR_INTERVALO_MIN",
  "MONITOR_HORA_RESUMO",
  "DIVULGACAO_ITENS",
  "DIVULGACAO_REPETIR_HORAS",
  "PAINEL_ATUALIZAR_SEG",
] as const;

export type Chave = (typeof CHAVES)[number];

/** Valores que nunca voltam inteiros para a tela. */
const SECRETAS = new Set<Chave>([
  "MELI_CLIENT_SECRET",
  "MELI_ACCESS_TOKEN",
  "SHOPEE_SECRET",
  "TIKTOK_APP_SECRET",
  "TIKTOK_ACCESS_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "EVOLUTION_API_KEY",
  "ZAPI_TOKEN",
  "ZAPI_CLIENT_TOKEN",
  "ANTHROPIC_API_KEY",
]);

let cache: { mtime: number; dados: Record<string, string> } | null = null;

function ler(): Record<string, string> {
  try {
    const mtime = statSync(ARQUIVO).mtimeMs;
    if (cache && cache.mtime === mtime) return cache.dados;
    const dados = JSON.parse(readFileSync(ARQUIVO, "utf8")) as Record<string, string>;
    cache = { mtime, dados };
    return dados;
  } catch {
    return {};
  }
}

/** Lê uma configuração: primeiro a tela, depois o .env.local. */
export function cfg(chave: Chave): string {
  const v = ler()[chave];
  return v !== undefined && v !== "" ? v : process.env[chave] || "";
}

/** Grava as chaves informadas. Valor vazio apaga a chave. */
export function salvarCfg(novos: Partial<Record<Chave, string>>): void {
  const dados = { ...ler() };
  for (const chave of CHAVES) {
    if (!(chave in novos)) continue;
    const valor = String(novos[chave] ?? "").trim().slice(0, 2000);
    if (valor) dados[chave] = valor;
    else delete dados[chave];
  }
  mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2), "utf8");
  cache = null;
}

export type ResumoCfg = Record<Chave, { definido: boolean; valor: string }>;

/** Para a tela: segredos voltam mascarados (só os 4 últimos caracteres). */
export function resumoCfg(): ResumoCfg {
  const r = {} as ResumoCfg;
  for (const chave of CHAVES) {
    const v = cfg(chave);
    r[chave] = {
      definido: Boolean(v),
      valor: !v ? "" : SECRETAS.has(chave) ? `••••${v.slice(-4)}` : v,
    };
  }
  return r;
}
