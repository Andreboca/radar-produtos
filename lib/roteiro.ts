/**
 * Agente de roteiro para vídeo UGC.
 * 1) Procura os dados do produto pelo ID (Mercado Livre, quando conectado).
 * 2) Busca vídeos de criadores que estão vendendo o produto. Essa busca depende
 *    de uma API de vídeos de criadores ainda não conectada: quando não existir,
 *    o agente avisa e segue só com os dados do produto.
 * 3) Escreve cenas e narração em português. Com ANTHROPIC_API_KEY usa a IA;
 *    sem a chave, monta o roteiro a partir de um modelo fixo.
 */
import { cfg } from "./config";
import { meliConfigurado, produtoPorId } from "./meli";

export type PedidoRoteiro = {
  produtoId: string;
  plataforma: "meli" | "shopee" | "tiktok";
  produtoNome?: string;
  fala?: string;
};

export type RoteiroGerado = {
  produto: string;
  aviso: string;
  cenas: string[];
  narracao: string;
  fonte: "ia" | "modelo";
};

async function dadosDoProduto(p: PedidoRoteiro): Promise<{ nome: string; aviso: string }> {
  if (p.plataforma === "meli" && meliConfigurado()) {
    try {
      const item = await produtoPorId(p.produtoId);
      return { nome: item.nome, aviso: "" };
    } catch (e) {
      return {
        nome: p.produtoNome || "",
        aviso: `Não consegui ler o produto ${p.produtoId} no Mercado Livre: ${e instanceof Error ? e.message : "erro"}.`,
      };
    }
  }
  return {
    nome: p.produtoNome || "",
    aviso: `A busca pelo ID na ${p.plataforma === "shopee" ? "Shopee" : p.plataforma === "tiktok" ? "TikTok Shop" : "plataforma"} ainda não está conectada. Use o nome do produto.`,
  };
}

const AVISO_VIDEOS =
  "A API oficial do TikTok Shop não tem um endpoint que liste os vídeos de criadores de um produto. Por isso o roteiro usa os dados do produto e o modelo UGC. Para analisar os vídeos que estão viralizando, é preciso uma fonte de dados à parte.";

export async function gerarRoteiro(p: PedidoRoteiro): Promise<RoteiroGerado> {
  const { nome, aviso } = await dadosDoProduto(p);
  const produto = nome || "o produto da foto";
  const fala = (p.fala || "").trim();
  const chave = cfg("ANTHROPIC_API_KEY");
  const avisoFinal = [aviso, AVISO_VIDEOS].filter(Boolean).join(" ");

  if (chave) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: 700,
          system:
            "Você escreve roteiros de vídeo UGC curtos para TikTok Shop em português do Brasil. Responda somente com JSON: {\"cenas\": [4 strings curtas descrevendo a ação de cada parte do vídeo], \"narracao\": \"fala curta, natural, de uma mulher, sotaque paulista\"}. Não invente características do produto.",
          messages: [{ role: "user", content: `Produto: ${produto}. Fala sugerida pelo usuário (pode adaptar): ${fala || "nenhuma"}.` }],
        }),
      });
      const j = await resp.json();
      const texto: string = j?.content?.[0]?.text || "";
      const ini = texto.indexOf("{");
      const fim = texto.lastIndexOf("}");
      const obj = JSON.parse(texto.slice(ini, fim + 1));
      if (Array.isArray(obj.cenas) && typeof obj.narracao === "string") {
        return { produto, aviso: avisoFinal, cenas: obj.cenas.slice(0, 4), narracao: obj.narracao, fonte: "ia" };
      }
    } catch {
      // cai no modelo fixo abaixo
    }
  }

  return {
    produto,
    aviso: avisoFinal,
    cenas: [
      "as mãos abrem a caixa e revelam o produto protegido",
      "uma mão tira o produto e mostra o acabamento de perto",
      "o produto é levantado e mostrado inteiro, com calma",
      "o produto fica parado, bem visível, pronto para a venda",
    ],
    narracao:
      fala || `Menina, olha esse ${produto} que chegou. O acabamento é bom e valeu cada centavo, viu?`,
    fonte: "modelo",
  };
}
