/**
 * Histórico: a cada consulta, guarda um ponto (data, vendas, posição, preço)
 * por produto em data/historico.json. É daí que saem os gráficos e os números
 * da janela "Analisar métricas" — tudo calculado sobre dados reais coletados.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Produto } from "./types";

const ARQUIVO = path.join(process.cwd(), "data", "historico.json");
const MAX_PONTOS = 600; // por produto
const MAX_PRODUTOS = 3000;
const JANELA_MS = 35 * 24 * 3_600_000;

/** [instante, vendas acumuladas, posição no ranking, preço] */
type Ponto = [number, number | null, number | null, number | null];
/** `ultimo` guarda a foto mais recente do produto (imagem, link, preço) para montar os cartões. */
type Registro = { nome: string; ultimo?: Produto; pontos: Ponto[] };
type Base = Record<string, Registro>;

const chave = (p: Pick<Produto, "plataforma" | "id">) => `${p.plataforma}:${p.id}`;

async function ler(): Promise<Base> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Base;
  } catch {
    return {};
  }
}

let fila: Promise<void> = Promise.resolve();

/** Acrescenta um ponto para cada produto. Chamadas simultâneas entram em fila. */
export function registrar(produtos: Produto[]): Promise<void> {
  fila = fila
    .then(async () => {
      if (!produtos.length) return;
      const base = await ler();
      const agora = Date.now();
      for (const p of produtos) {
        const k = chave(p);
        const reg = base[k] || { nome: p.nome, pontos: [] };
        reg.ultimo = p;
        const ultimo = reg.pontos[reg.pontos.length - 1];
        // No máximo um ponto a cada 5 minutos por produto.
        if (ultimo && agora - ultimo[0] < 5 * 60_000) continue;
        reg.nome = p.nome;
        reg.pontos.push([agora, p.vendas, p.posicao, p.preco]);
        reg.pontos = reg.pontos.filter((x) => agora - x[0] <= JANELA_MS).slice(-MAX_PONTOS);
        base[k] = reg;
      }
      const chaves = Object.keys(base);
      if (chaves.length > MAX_PRODUTOS) {
        chaves
          .sort((a, b) => (base[a].pontos.at(-1)?.[0] ?? 0) - (base[b].pontos.at(-1)?.[0] ?? 0))
          .slice(0, chaves.length - MAX_PRODUTOS)
          .forEach((k) => delete base[k]);
      }
      await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
      await fs.writeFile(ARQUIVO, JSON.stringify(base), "utf8");
    })
    .catch(() => undefined);
  return fila;
}

export type Periodo = "24h" | "7d" | "30d";

export type Intervalo = {
  rotulo: string;
  /** Unidades vendidas no intervalo (null = a plataforma não informa vendas). */
  unidades: number | null;
  volume: number | null;
  /** Última posição no ranking vista no intervalo. */
  posicao: number | null;
};

export type Parcela = { nome: string; pontos: number; maximo: number; motivo: string };

export type Metricas = {
  periodo: Periodo;
  intervalos: Intervalo[];
  temVendas: boolean;
  unidades: number | null;
  volume: number | null;
  posicaoAtual: number | null;
  posicaoInicio: number | null;
  potencial: number;
  parcelas: Parcela[];
  coletas: number;
  desde: string | null;
};

const FORMATOS: Record<Periodo, { baldes: number; ms: number }> = {
  "24h": { baldes: 6, ms: 4 * 3_600_000 },
  "7d": { baldes: 7, ms: 24 * 3_600_000 },
  "30d": { baldes: 10, ms: 3 * 24 * 3_600_000 },
};

function rotulo(periodo: Periodo, inicio: number): string {
  const d = new Date(inicio);
  const fuso = process.env.MONITOR_FUSO || "America/Sao_Paulo";
  if (periodo === "24h") {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", timeZone: fuso }) + "h";
  }
  if (periodo === "7d") {
    return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: fuso }).replace(".", "");
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: fuso });
}

const limitar = (n: number, max: number) => Math.max(0, Math.min(max, n));

/**
 * Indicador de potencial (0 a 100). É um cálculo do app, não um dado da
 * plataforma. Soma quatro parcelas, cada uma com um teto:
 *   ranking/vendas 40 · ritmo de vendas em 7 dias 25 · avaliação 20 · comissão 15
 */
export function potencial(p: Produto, unidades7d: number | null): Parcela[] {
  let procura = 0;
  let motivoProcura = "sem posição nem vendas informadas";
  if (p.posicao !== null && p.posicao <= 20) {
    procura = (40 * (21 - p.posicao)) / 20;
    motivoProcura = `#${p.posicao} no ranking`;
  } else if (p.vendas !== null && p.vendas > 0) {
    procura = (Math.log10(p.vendas) / 5) * 40;
    motivoProcura = `${p.vendas.toLocaleString("pt-BR")} vendas acumuladas`;
  }
  const ritmo = unidades7d !== null ? (Math.log10(1 + unidades7d) / 3) * 25 : 0;
  const nota = p.avaliacao !== null ? ((p.avaliacao - 3.5) / 1.5) * 20 : 10;
  const comissao = p.comissaoPct !== null ? (Math.min(p.comissaoPct, 20) / 20) * 15 : 0;
  return [
    { nome: "Procura", pontos: Math.round(limitar(procura, 40)), maximo: 40, motivo: motivoProcura },
    {
      nome: "Ritmo de vendas",
      pontos: Math.round(limitar(ritmo, 25)),
      maximo: 25,
      motivo:
        unidades7d !== null
          ? `${unidades7d.toLocaleString("pt-BR")} unidades em 7 dias`
          : "sem histórico de vendas ainda",
    },
    {
      nome: "Avaliação",
      pontos: Math.round(limitar(nota, 20)),
      maximo: 20,
      motivo: p.avaliacao !== null ? `nota ${p.avaliacao.toFixed(1)}` : "não informada (valor neutro)",
    },
    {
      nome: "Comissão",
      pontos: Math.round(limitar(comissao, 15)),
      maximo: 15,
      motivo: p.comissaoPct !== null ? `${p.comissaoPct.toFixed(1)}%` : "não informada",
    },
  ];
}

/** Soma só os aumentos de vendas entre pontos consecutivos dentro da janela. */
function unidadesEntre(pontos: Ponto[], de: number, ate: number): { u: number; v: number; ok: boolean } {
  let u = 0;
  let v = 0;
  let ok = false;
  for (let i = 1; i < pontos.length; i++) {
    const [t, vendas, , preco] = pontos[i];
    const anterior = pontos[i - 1][1];
    if (t <= de || t > ate || vendas === null || anterior === null) continue;
    ok = true;
    const ganho = Math.max(0, vendas - anterior);
    u += ganho;
    v += ganho * (preco ?? 0);
  }
  return { u, v, ok };
}

export async function metricas(p: Produto, periodo: Periodo): Promise<Metricas> {
  const reg = (await ler())[chave(p)];
  const pontos = reg?.pontos || [];
  const { baldes, ms } = FORMATOS[periodo];
  const agora = Date.now();
  const inicio = agora - baldes * ms;

  const temVendas = pontos.some((x) => x[1] !== null);
  const intervalos: Intervalo[] = [];
  for (let b = 0; b < baldes; b++) {
    const de = inicio + b * ms;
    const ate = de + ms;
    const r = unidadesEntre(pontos, de, ate);
    const noBalde = pontos.filter((x) => x[0] > de && x[0] <= ate && x[2] !== null);
    intervalos.push({
      rotulo: rotulo(periodo, periodo === "24h" ? de : ate - 1),
      unidades: temVendas ? (r.ok ? r.u : 0) : null,
      volume: temVendas ? (r.ok ? r.v : 0) : null,
      posicao: noBalde.length ? noBalde[noBalde.length - 1][2] : null,
    });
  }

  const total = unidadesEntre(pontos, inicio, agora);
  const semana = unidadesEntre(pontos, agora - 7 * 24 * 3_600_000, agora);
  const naJanela = pontos.filter((x) => x[0] > inicio);
  const comPosicao = naJanela.filter((x) => x[2] !== null);
  const parcelas = potencial(p, temVendas && semana.ok ? semana.u : null);

  return {
    periodo,
    intervalos,
    temVendas,
    unidades: temVendas && total.ok ? total.u : null,
    volume: temVendas && total.ok ? total.v : null,
    posicaoAtual: p.posicao ?? comPosicao.at(-1)?.[2] ?? null,
    posicaoInicio: comPosicao[0]?.[2] ?? null,
    potencial: parcelas.reduce((s, x) => s + x.pontos, 0),
    parcelas,
    coletas: naJanela.length,
    desde: pontos.length ? new Date(pontos[0][0]).toISOString() : null,
  };
}

export type Janela = "1h" | "24h";

export type ProdutoEmVenda = {
  produto: Produto;
  /** Unidades vendidas dentro da janela (null no modo ranking). */
  unidades: number | null;
  volume: number | null;
};

export type TopVendas = {
  janela: Janela;
  /** "vendas" = ordenado por unidades vendidas na janela; "ranking" = sem dado de vendas ainda, mostra o ranking atual. */
  modo: "vendas" | "ranking" | "vazio";
  itens: ProdutoEmVenda[];
  atualizadoEm: string | null;
};

/**
 * Os produtos que mais venderam na última hora ou nas últimas 24 horas,
 * medidos pelo aumento das vendas acumuladas entre as checagens do monitor.
 */
export async function topVendas(janela: Janela, limite = 10): Promise<TopVendas> {
  const base = await ler();
  const agora = Date.now();
  const de = agora - (janela === "1h" ? 1 : 24) * 3_600_000;
  const comVenda: ProdutoEmVenda[] = [];
  const recentes: Produto[] = [];
  let ultimaColeta = 0;

  for (const reg of Object.values(base)) {
    const fim = reg.pontos[reg.pontos.length - 1];
    if (!reg.ultimo || !fim) continue;
    ultimaColeta = Math.max(ultimaColeta, fim[0]);
    // Só entra quem foi visto há pouco: produto que saiu do ranking não aparece.
    if (agora - fim[0] <= 6 * 3_600_000) recentes.push(reg.ultimo);
    const r = unidadesEntre(reg.pontos, de, agora);
    if (r.ok && r.u > 0) comVenda.push({ produto: reg.ultimo, unidades: r.u, volume: r.v });
  }

  const atualizadoEm = ultimaColeta ? new Date(ultimaColeta).toISOString() : null;
  if (comVenda.length) {
    comVenda.sort((a, b) => (b.unidades ?? 0) - (a.unidades ?? 0));
    return { janela, modo: "vendas", itens: comVenda.slice(0, limite), atualizadoEm };
  }

  // Ainda sem duas checagens na janela: mostra o ranking atual das plataformas.
  const porRanking = recentes
    .filter((p) => p.posicao !== null || p.vendas !== null)
    .sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999) || (b.vendas ?? 0) - (a.vendas ?? 0))
    .slice(0, limite)
    .map((produto) => ({ produto, unidades: null, volume: null }));
  return { janela, modo: porRanking.length ? "ranking" : "vazio", itens: porRanking, atualizadoEm };
}
