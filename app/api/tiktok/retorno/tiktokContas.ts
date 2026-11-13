/**
 * Contas de criador do TikTok Shop conectadas ao Radar.
 *
 * Cada conta autoriza o app pelo link de autorização de criador e volta para
 * /api/tiktok/retorno com um `code`. Aqui o código é trocado pelo access token
 * e o par de tokens fica guardado em data/tiktok-contas.json, um registro por
 * conta, para o app poder consultar e divulgar em nome de cada uma.
 *
 * Endereços confirmados na documentação oficial (Creator authorization guide):
 *   GET https://auth.tiktok-shops.com/api/v2/token/get      troca o code
 *   GET https://auth.tiktok-shops.com/api/v2/token/refresh  renova o token
 */
import { promises as fs } from "fs";
import path from "path";
import { cfg } from "./config";

const ARQUIVO = path.join(process.cwd(), "data", "tiktok-contas.json");
const AUTH = process.env.TIKTOK_AUTH_HOST || "https://auth.tiktok-shops.com";
/** Página onde o criador autoriza. O `state` é obrigatório. */
const PORTAL = process.env.TIKTOK_AUTH_PORTAL || "https://shop.tiktok.com/alliance/creator/auth";
/** Renova o token quando falta menos de 1 dia para vencer. */
const MARGEM_MS = 86_400_000;

export type Conta = {
  /** open_id devolvido pelo TikTok: identifica a conta de criador. */
  openId: string;
  /** Nome de usuário, preenchido depois pelo Get Creator Profile. */
  nome: string | null;
  accessToken: string;
  refreshToken: string;
  /** Quando o access token vence (ms desde a época). */
  expiraEm: number;
  escopos: string[];
  conectadaEm: string;
  /** Último erro ao usar ou renovar esta conta, para aparecer no painel. */
  erro?: string;
};

type Base = Record<string, Conta>;

async function ler(): Promise<Base> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Base;
  } catch {
    return {};
  }
}

async function gravar(base: Base): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(base, null, 2), "utf8");
}

export function tiktokAppConfigurado(): boolean {
  return Boolean(cfg("TIKTOK_APP_KEY") && cfg("TIKTOK_APP_SECRET"));
}

/** O link que cada conta de criador precisa abrir para autorizar o app. */
export function linkAutorizacao(estado: string): string {
  const appKey = cfg("TIKTOK_APP_KEY");
  if (!appKey) throw new Error("Falta a chave do app (TIKTOK_APP_KEY).");
  return `${PORTAL}?${new URLSearchParams({ app_key: appKey, state: estado })}`;
}

type RespostaToken = {
  code?: number;
  message?: string;
  data?: {
    access_token?: string;
    access_token_expire_in?: number;
    refresh_token?: string;
    refresh_token_expire_in?: number;
    open_id?: string;
    user_type?: number;
    granted_scopes?: string[];
  };
};

async function pedirToken(caminho: string, extras: Record<string, string>): Promise<RespostaToken["data"]> {
  const params = new URLSearchParams({
    app_key: cfg("TIKTOK_APP_KEY"),
    app_secret: cfg("TIKTOK_APP_SECRET"),
    ...extras,
  });
  const resp = await fetch(`${AUTH}${caminho}?${params}`, {
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const json = (await resp.json().catch(() => ({}))) as RespostaToken;
  if (!resp.ok || json.code !== 0 || !json.data?.access_token) {
    throw new Error(
      `TikTok recusou a autorização (${json.code ?? resp.status}): ${json.message || "sem detalhe"}`
    );
  }
  return json.data;
}

/**
 * Troca o `code` do retorno pelo par de tokens e guarda a conta.
 * A documentação manda conferir `user_type == 1`, que é a identidade de criador.
 */
export async function conectarConta(code: string): Promise<Conta> {
  const d = await pedirToken("/api/v2/token/get", {
    auth_code: code,
    grant_type: "authorized_code",
  });

  if (d!.user_type !== 1) {
    throw new Error(
      `Essa conta entrou como tipo ${d!.user_type}, e não como criador (1). Autorize pelo link de criador, com a conta do TikTok que faz afiliado.`
    );
  }

  const openId = d!.open_id || "";
  if (!openId) throw new Error("O TikTok não devolveu o identificador da conta (open_id).");

  const base = await ler();
  const conta: Conta = {
    openId,
    nome: base[openId]?.nome ?? null,
    accessToken: d!.access_token!,
    refreshToken: d!.refresh_token || "",
    expiraEm: Date.now() + (Number(d!.access_token_expire_in) || 86_400) * 1000,
    escopos: Array.isArray(d!.granted_scopes) ? d!.granted_scopes : [],
    conectadaEm: new Date().toISOString(),
  };
  base[openId] = conta;
  await gravar(base);
  return conta;
}

/** Renova o token de uma conta e grava o novo par. */
async function renovar(conta: Conta): Promise<Conta> {
  if (!conta.refreshToken) throw new Error("Essa conta não tem refresh token; autorize de novo.");
  const d = await pedirToken("/api/v2/token/refresh", {
    refresh_token: conta.refreshToken,
    grant_type: "refresh_token",
  });
  const base = await ler();
  const nova: Conta = {
    ...conta,
    accessToken: d!.access_token!,
    refreshToken: d!.refresh_token || conta.refreshToken,
    expiraEm: Date.now() + (Number(d!.access_token_expire_in) || 86_400) * 1000,
    escopos: Array.isArray(d!.granted_scopes) ? d!.granted_scopes : conta.escopos,
  };
  delete nova.erro;
  base[conta.openId] = nova;
  await gravar(base);
  return nova;
}

/** Todas as contas conectadas, já com o token válido quando possível. */
export async function contas(): Promise<Conta[]> {
  const base = await ler();
  return Object.values(base).sort((a, b) => a.conectadaEm.localeCompare(b.conectadaEm));
}

/** O token válido de uma conta: renova sozinho se estiver perto de vencer. */
export async function tokenDaConta(openId: string): Promise<string> {
  const base = await ler();
  const conta = base[openId];
  if (!conta) throw new Error("Conta não conectada.");
  if (conta.expiraEm - Date.now() > MARGEM_MS) return conta.accessToken;
  try {
    return (await renovar(conta)).accessToken;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha ao renovar o token";
    base[openId] = { ...conta, erro: msg };
    await gravar(base);
    throw new Error(msg);
  }
}

/** Guarda o nome do criador (vem do Get Creator Profile). */
export async function guardarNome(openId: string, nome: string): Promise<void> {
  const base = await ler();
  if (!base[openId]) return;
  base[openId] = { ...base[openId], nome };
  await gravar(base);
}

/** Desconecta uma conta: apaga os tokens na hora. */
export async function desconectar(openId: string): Promise<void> {
  const base = await ler();
  if (!base[openId]) return;
  delete base[openId];
  await gravar(base);
}
