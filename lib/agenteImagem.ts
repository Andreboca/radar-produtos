/**
 * Agente de prompt de imagem. Lê a foto do produto (e a da influência, se houver)
 * com a IA e escreve um prompt específico para aquele produto.
 * Precisa de ANTHROPIC_API_KEY (Conexões → IA).
 */
import { cfg } from "./config";

export type TipoImagem = "ugc" | "mirror" | "size";

export type PromptImagem = {
  produto: string;
  cena: string[];
  prompt: string;
};

const INSTRUCOES: Record<TipoImagem, string> = {
  ugc: "Foto realista estilo UGC de TikTok Shop: a influenciadora segura o produto em um ambiente doméstico natural, como criadora mostrando uma compra, câmera de smartphone na altura dos olhos.",
  mirror: "Foto realista no estilo mirror selfie de provador: a influenciadora está de frente para um espelho de loja, como se estivesse provando a roupa, com o celular na mão cobrindo parte do reflexo. Mostrar o caimento da roupa no corpo.",
  size: "Foto realista mostrando somente do pescoço para baixo, sem rosto, de uma modelo plus size, mais cheinha, com corpo natural, vestindo o produto. Enquadramento de busto ao quadril, fundo neutro.",
};

type Imagem = { data: string; mime: string };

function separar(dataUrl: string): Imagem | null {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  return m ? { mime: m[1], data: m[2] } : null;
}

export function iaDeImagemConfigurada(): boolean {
  return Boolean(cfg("ANTHROPIC_API_KEY"));
}

export async function gerarPromptImagem(
  tipo: TipoImagem,
  produtoDataUrl: string,
  influenciaDataUrl?: string
): Promise<PromptImagem> {
  const chave = cfg("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("Configure a chave da IA em Conexões para o agente ler o produto.");
  const produto = separar(produtoDataUrl);
  if (!produto) throw new Error("A foto do produto não está em um formato aceito.");
  const influencia = influenciaDataUrl ? separar(influenciaDataUrl) : null;

  const conteudo: unknown[] = [
    { type: "text", text: "Foto do produto:" },
    { type: "image", source: { type: "base64", media_type: produto.mime, data: produto.data } },
  ];
  if (influencia) {
    conteudo.push({ type: "text", text: "Foto da influência (usar a mesma pessoa):" });
    conteudo.push({ type: "image", source: { type: "base64", media_type: influencia.mime, data: influencia.data } });
  }
  conteudo.push({ type: "text", text: `Tipo de imagem: ${INSTRUCOES[tipo]}` });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 900,
      system:
        "Você cria prompts para geradores de imagem de moda. 1) Identifique o produto da foto: tipo, cor, material, modelagem e detalhes visíveis. Não invente o que não aparece. 2) Escreva um prompt em português que descreva esse produto exatamente, mantendo a pessoa da foto de referência e o produto da foto. Responda somente com JSON: {\"produto\": \"nome curto do produto\", \"cena\": [\"Cenário: ...\", \"Pose: ...\", \"Produto: ...\", \"Enquadramento: ...\"], \"prompt\": \"prompt completo\"}. Sem texto, marca d'água ou legenda na imagem.",
      messages: [{ role: "user", content: conteudo }],
    }),
  });
  const j = await resp.json();
  if (!resp.ok) throw new Error(j?.error?.message || "A IA não conseguiu ler a foto.");
  const texto: string = j?.content?.[0]?.text || "";
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  const obj = JSON.parse(texto.slice(ini, fim + 1));
  return {
    produto: String(obj.produto || "Produto"),
    cena: Array.isArray(obj.cena) ? obj.cena.map(String) : [],
    prompt: String(obj.prompt || ""),
  };
}
