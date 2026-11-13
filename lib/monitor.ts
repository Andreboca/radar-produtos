/**
 * Monitor: consulta as plataformas, compara com a checagem anterior e gera
 * alertas (produto novo no ranking, subida de posição, salto de vendas) e o
 * resumo diário. Os dados ficam em data/monitor.json, no seu computador.
 */
import { cfg } from "./config";
import { promises as fs } from "fs";
import path from "path";
import { divulgacaoConfigurada, divulgar } from "./divulgacao";
import { registrar } from "./historico";
import { destacarComIA } from "./ia";
import * as meli from "./meli";
import * as shopee from "./shopee";
import * as tiktok from "./tiktok";
import { enviarTelegram, escapar, telegramConfigurado } from "./telegram";
import { NOMES, type Categoria, type IdPlataforma, type Produto } from "./types";

export type ConfigMonitor = {
  categoriasMeli: Categoria[];
  termos: string[];
};

export type TipoAlerta = "novo" | "subiu" | "vendas" | "resumo" | "envio" | "erro";

export type Alerta = {
  id: string;
  quando: string;
  tipo: TipoAlerta;
  plataforma: IdPlataforma | null;
  titulo: string;
  detalhe: string;
  link: string | null;
};

type Foto = { id: string; nome: string; posicao: number | null; vendas: number | null };

type Estado = {
  config: ConfigMonitor;
  fotos: Record<string, Foto[]>;
  alertas: Alerta[];
  enviados: Record<string, number>;
  ultimaChecagem: string | null;
  ultimoResumo: string | null;
};

const ARQUIVO = path.join(process.cwd(), "data", "monitor.json");
const MAX_ALERTAS = 300;
const FUSO = process.env.MONITOR_FUSO || "America/Sao_Paulo";

/** Quantas posições um produto precisa subir para virar alerta. */
const SUBIDA_MINIMA = 3;
/** Crescimento mínimo de vendas entre checagens para virar alerta. */
const SALTO_VENDAS = 0.1;

const vazio = (): Estado => ({
  config: { categoriasMeli: [], termos: [] },
  fotos: {},
  alertas: [],
  enviados: {},
  ultimaChecagem: null,
  ultimoResumo: null,
});

export async function ler(): Promise<Estado> {
  try {
    return { ...vazio(), ...JSON.parse(await fs.readFile(ARQUIVO, "utf8")) };
  } catch {
    return vazio();
  }
}

async function salvar(estado: Estado) {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(estado, null, 2), "utf8");
}

export async function salvarConfig(config: ConfigMonitor) {
  const estado = await ler();
  estado.config = {
    categoriasMeli: (config.categoriasMeli || []).slice(0, 10),
    termos: (config.termos || [])
      .map((t) => String(t).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 10),
  };
  await salvar(estado);
  return estado.config;
}

function hoje(): { dia: string; hora: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value || "";
  return { dia: `${v("year")}-${v("month")}-${v("day")}`, hora: Number(v("hour")) % 24 };
}

type Lista = { chave: string; rotulo: string; plataforma: IdPlataforma; produtos: Produto[] };

/** Monta as consultas a partir da configuração e do que está conectado. */
async function coletar(config: ConfigMonitor): Promise<{ listas: Lista[]; erros: Alerta[] }> {
  const tarefas: { chave: string; rotulo: string; plataforma: IdPlataforma; fn: () => Promise<Produto[]> }[] = [];

  if (meli.meliConfigurado()) {
    for (const c of config.categoriasMeli) {
      tarefas.push({
        chave: `meli:${c.id}`,
        rotulo: c.nome,
        plataforma: "meli",
        fn: () => meli.maisVendidos(c.id),
      });
    }
  }
  const termos = config.termos.length ? config.termos : [""];
  if (shopee.shopeeConfigurada()) {
    for (const t of termos) {
      tarefas.push({
        chave: `shopee:${t || "*"}`,
        rotulo: t || "geral",
        plataforma: "shopee",
        fn: () => shopee.buscar(t, 2),
      });
    }
  }
  if (tiktok.tiktokConfigurado()) {
    for (const t of termos) {
      tarefas.push({
        chave: `tiktok:${t || "*"}`,
        rotulo: t || "geral",
        plataforma: "tiktok",
        fn: () => tiktok.buscar(t),
      });
    }
  }

  const listas: Lista[] = [];
  const erros: Alerta[] = [];
  // Em sequência para não estourar limite de requisições das APIs.
  for (const t of tarefas) {
    try {
      listas.push({ chave: t.chave, rotulo: t.rotulo, plataforma: t.plataforma, produtos: await t.fn() });
    } catch (e) {
      erros.push(
        alerta("erro", t.plataforma, `Falha ao consultar ${NOMES[t.plataforma]}`, e instanceof Error ? e.message : "erro", null)
      );
    }
  }
  return { listas, erros };
}

let contador = 0;
function alerta(
  tipo: TipoAlerta,
  plataforma: IdPlataforma | null,
  titulo: string,
  detalhe: string,
  link: string | null
): Alerta {
  return {
    id: `${Date.now()}-${contador++}`,
    quando: new Date().toISOString(),
    tipo,
    plataforma,
    titulo,
    detalhe,
    link,
  };
}

/** Compara a lista atual com a foto da checagem anterior. */
export function comparar(lista: Lista, anterior: Foto[] | undefined): Alerta[] {
  if (!anterior) return []; // primeira checagem: só registra
  const antes = new Map(anterior.map((f) => [f.id, f]));
  const novos: Alerta[] = [];
  const onde = `${NOMES[lista.plataforma]} · ${lista.rotulo}`;

  for (const p of lista.produtos) {
    const a = antes.get(p.id);
    if (!a) {
      novos.push(
        alerta(
          "novo",
          p.plataforma,
          p.nome,
          `Entrou no ranking${p.posicao !== null ? ` em #${p.posicao}` : ""} (${onde}).`,
          p.link
        )
      );
      continue;
    }
    if (a.posicao !== null && p.posicao !== null && a.posicao - p.posicao >= SUBIDA_MINIMA) {
      novos.push(
        alerta("subiu", p.plataforma, p.nome, `Subiu de #${a.posicao} para #${p.posicao} (${onde}).`, p.link)
      );
    }
    if (a.vendas !== null && p.vendas !== null && a.vendas > 0) {
      const ganho = p.vendas - a.vendas;
      if (ganho / a.vendas >= SALTO_VENDAS) {
        novos.push(
          alerta(
            "vendas",
            p.plataforma,
            p.nome,
            `Vendeu +${ganho.toLocaleString("pt-BR")} desde a última checagem (${onde}).`,
            p.link
          )
        );
      }
    }
  }
  return novos;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function linhaProduto(p: Produto): string {
  const partes = [
    p.posicao !== null ? `#${p.posicao}` : "",
    p.preco !== null ? brl(p.preco) : "",
    p.vendas !== null ? `${p.vendas.toLocaleString("pt-BR")} vendas` : "",
    p.comissaoPct !== null ? `${p.comissaoPct.toFixed(1)}% comissão` : "",
  ].filter(Boolean);
  return `${p.nome} — ${partes.join(" · ")}`;
}

async function montarResumo(listas: Lista[]): Promise<Alerta | null> {
  if (!listas.some((l) => l.produtos.length)) return null;
  const blocos = listas
    .filter((l) => l.produtos.length)
    .map(
      (l) =>
        `${NOMES[l.plataforma]} · ${l.rotulo}\n` +
        l.produtos
          .slice(0, 5)
          .map((p) => `  ${linhaProduto(p)}`)
          .join("\n")
    );
  const ia = await destacarComIA(listas.flatMap((l) => l.produtos.slice(0, 10)));
  const detalhe = blocos.join("\n\n") + (ia ? `\n\nLeitura da IA:\n${ia}` : "");
  return alerta("resumo", null, "Resumo diário dos mais vendidos", detalhe, null);
}

const ICONE: Record<TipoAlerta, string> = {
  novo: "🆕",
  subiu: "📈",
  vendas: "🔥",
  resumo: "📋",
  envio: "📣",
  erro: "⚠️",
};

function paraTelegram(alertas: Alerta[]): string {
  return alertas
    .map((a) => {
      const titulo = a.link
        ? `<a href="${escapar(a.link)}">${escapar(a.titulo)}</a>`
        : `<b>${escapar(a.titulo)}</b>`;
      return `${ICONE[a.tipo]} ${titulo}\n${escapar(a.detalhe)}`;
    })
    .join("\n\n");
}

let rodando = false;

/**
 * Executa uma checagem completa.
 * forcarResumo = true envia o resumo mesmo que o de hoje já tenha saído.
 */
export async function rodarMonitor(forcarResumo = false): Promise<{ novos: Alerta[]; aviso?: string }> {
  if (rodando) return { novos: [], aviso: "Já existe uma checagem em andamento." };
  rodando = true;
  try {
    const estado = await ler();
    const { listas, erros } = await coletar(estado.config);

    if (!listas.length && !erros.length) {
      return {
        novos: [],
        aviso:
          "Nada para monitorar: conecte ao menos uma plataforma e escolha categorias ou palavras-chave.",
      };
    }

    const novos: Alerta[] = [...erros];
    await registrar(listas.flatMap((l) => l.produtos));
    for (const l of listas) {
      novos.push(...comparar(l, estado.fotos[l.chave]));
      estado.fotos[l.chave] = l.produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        posicao: p.posicao,
        vendas: p.vendas,
      }));
    }

    const { dia, hora } = hoje();
    const horaResumo = Number(cfg("MONITOR_HORA_RESUMO") || 9);
    if (forcarResumo || (estado.ultimoResumo !== dia && hora >= horaResumo)) {
      const resumo = await montarResumo(listas);
      if (resumo) {
        novos.push(resumo);
        estado.ultimoResumo = dia;
      }
    }

    // Ofertas para os grupos (Telegram e WhatsApp), sem repetir o que já saiu.
    if (divulgacaoConfigurada()) {
      const r = await divulgar(listas, estado.enviados);
      if (r.enviados.length) {
        novos.push(
          alerta(
            "envio",
            null,
            `${r.enviados.length} oferta(s) enviada(s) aos grupos`,
            r.enviados.map((p) => `${NOMES[p.plataforma]} · ${p.nome}`).join("\n"),
            null
          )
        );
      }
      for (const f of r.falhas) novos.push(alerta("erro", null, "Falha no envio ao grupo", f, null));
    }

    estado.ultimaChecagem = new Date().toISOString();
    estado.alertas = [...novos, ...estado.alertas].slice(0, MAX_ALERTAS);
    await salvar(estado);

    const paraEnviar = novos.filter((a) => a.tipo !== "erro" && a.tipo !== "envio");
    if (paraEnviar.length && telegramConfigurado()) {
      try {
        await enviarTelegram(paraTelegram(paraEnviar));
      } catch (e) {
        const falha = alerta("erro", null, "Falha ao enviar para o Telegram", e instanceof Error ? e.message : "erro", null);
        estado.alertas = [falha, ...estado.alertas].slice(0, MAX_ALERTAS);
        await salvar(estado);
        novos.unshift(falha);
      }
    }
    return { novos };
  } finally {
    rodando = false;
  }
}

/** Chamado pelo agendador a cada minuto: roda se já passou o intervalo. */
export async function rodarSeForHora() {
  const intervaloMin = Math.max(5, Number(cfg("MONITOR_INTERVALO_MIN") || 30));
  const estado = await ler();
  const ultima = estado.ultimaChecagem ? new Date(estado.ultimaChecagem).getTime() : 0;
  if (Date.now() - ultima >= intervaloMin * 60_000) await rodarMonitor();
}
