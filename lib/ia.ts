/**
 * Leitura por IA (opcional). Só roda se ANTHROPIC_API_KEY estiver preenchida.
 * A IA recebe apenas os dados que vieram das APIs das plataformas e aponta as
 * melhores oportunidades; ela não pesquisa na web nem cria números.
 */
import { cfg } from "./config";
import type { Produto } from "./types";
import { NOMES } from "./types";

export function iaConfigurada(): boolean {
  return Boolean(cfg("ANTHROPIC_API_KEY"));
}

export async function destacarComIA(produtos: Produto[]): Promise<string | null> {
  const chave = cfg("ANTHROPIC_API_KEY");
  if (!chave || !produtos.length) return null;

  const dados = produtos.slice(0, 60).map((p) => ({
    plataforma: NOMES[p.plataforma],
    nome: p.nome,
    posicao: p.posicao,
    preco: p.preco,
    vendas: p.vendas,
    avaliacao: p.avaliacao,
    comissaoPct: p.comissaoPct,
  }));

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 700,
        system:
          "Você analisa rankings de marketplaces brasileiros para um revendedor e afiliado. Use SOMENTE os dados fornecidos; nunca invente números. Campos nulos significam que a plataforma não informa o dado. Responda em português, texto simples, sem markdown.",
        messages: [
          {
            role: "user",
            content: `Estes são os produtos mais vendidos hoje, vindos das APIs oficiais:\n${JSON.stringify(
              dados
            )}\n\nAponte até 5 produtos que parecem as melhores oportunidades (para revenda ou afiliado). Uma linha por produto: nome, plataforma e o motivo com base nos números. Termine com uma frase sobre o que evitar.`,
          },
        ],
      }),
    });
    const json = await resp.json();
    if (!resp.ok) return null;
    const texto = (json.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    return texto || null;
  } catch {
    return null;
  }
}

/** Confere a chave com uma chamada mínima. */
export async function testarIA(): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 5,
      messages: [{ role: "user", content: "ok" }],
    }),
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => ({}));
    throw new Error(`Anthropic recusou a chave: ${json?.error?.message || resp.status}`);
  }
  return "chave válida";
}
