"use client";

import { useEffect, useRef, useState } from "react";
import type { Metricas, Periodo } from "@/lib/historico";
import { NOMES, type Produto } from "@/lib/types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");

const PERIODOS: [Periodo, string][] = [
  ["24h", "24 horas"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
];

/** Gráfico de área de uma série só, com linha guia e valor ao passar o mouse. */
export function Grafico({
  rotulos,
  valores,
  formatar,
  invertido = false,
}: {
  rotulos: string[];
  valores: (number | null)[];
  formatar: (n: number) => string;
  invertido?: boolean;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const L = 720;
  const A = 240;
  const m = { e: 22, d: 22, t: 16, b: 30 };
  const largura = L - m.e - m.d;
  const altura = A - m.t - m.b;

  const numeros = valores.filter((v): v is number => v !== null);
  if (numeros.length < 2) return null;
  const max = Math.max(...numeros, 1);
  const min = invertido ? Math.min(...numeros) : 0;
  const faixa = Math.max(1, max - min);

  const x = (i: number) => m.e + (largura * i) / Math.max(1, valores.length - 1);
  const y = (v: number) => {
    const t = (v - min) / faixa;
    return m.t + altura * (invertido ? t : 1 - t);
  };

  const pontos = valores
    .map((v, i) => (v === null ? null : { i, v, x: x(i), y: y(v) }))
    .filter((p): p is { i: number; v: number; x: number; y: number } => p !== null);
  const linha = pontos.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${linha} L${pontos[pontos.length - 1].x.toFixed(1)},${m.t + altura} L${pontos[0].x.toFixed(
    1
  )},${m.t + altura} Z`;
  const ativo = foco !== null ? pontos.find((p) => p.i === foco) : undefined;
  // Com muitos pontos, mostra só alguns rótulos no eixo para não encavalar.
  const passo = Math.ceil(rotulos.length / 8);

  return (
    <div className="grafico">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Gráfico do período"
        onMouseLeave={() => setFoco(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * L;
          let melhor = pontos[0];
          for (const p of pontos) if (Math.abs(p.x - px) < Math.abs(melhor.x - px)) melhor = p;
          setFoco(melhor.i);
        }}
      >
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={m.e}
            x2={L - m.d}
            y1={m.t + altura * t}
            y2={m.t + altura * t}
            className="grade-linha"
          />
        ))}
        <path d={area} className="serie-area" />
        <path d={linha} className="serie-linha" />
        {ativo && (
          <>
            <line x1={ativo.x} x2={ativo.x} y1={m.t} y2={m.t + altura} className="guia" />
            <circle cx={ativo.x} cy={ativo.y} r={5} className="marcador" />
          </>
        )}
        {rotulos.map((r, i) =>
          i % passo === 0 ? (
            <text key={i} x={x(i)} y={A - 8} textAnchor="middle" className="eixo">
              {r}
            </text>
          ) : null
        )}
      </svg>
      {ativo && (
        <div className="dica" style={{ left: `${(ativo.x / L) * 100}%` }}>
          <strong>{formatar(ativo.v)}</strong>
          <span>{rotulos[ativo.i]}</span>
        </div>
      )}
    </div>
  );
}

export default function JanelaMetricas({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [dados, setDados] = useState<Metricas | null>(null);
  const [erro, setErro] = useState("");
  const [tabela, setTabela] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro("");
    fetch("/api/metricas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ produto, periodo }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || "Falha ao carregar.");
        if (vivo) setDados(j.metricas);
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Erro inesperado."));
    return () => {
      vivo = false;
    };
  }, [produto, periodo]);

  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const rotulos = dados?.intervalos.map((i) => i.rotulo) || [];
  const serieVolume = dados?.intervalos.map((i) => i.volume) || [];
  const seriePosicao = dados?.intervalos.map((i) => i.posicao) || [];
  const poucosDados = dados !== null && dados.coletas < 2;

  return (
    <div className="veu" onClick={onFechar}>
      <div
        className="janela"
        role="dialog"
        aria-modal="true"
        aria-label={`Métricas de ${produto.nome}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={fechar} className="fechar" aria-label="Fechar" onClick={onFechar}>
          ×
        </button>
        <span className="sobretitulo">Análise · {NOMES[produto.plataforma]}</span>
        <h2>{produto.nome}</h2>

        <div className="segmentos" role="tablist" aria-label="Período">
          {PERIODOS.map(([id, nome]) => (
            <button
              key={id}
              role="tab"
              aria-selected={periodo === id}
              className={periodo === id ? "ativo" : ""}
              onClick={() => setPeriodo(id)}
            >
              {nome}
            </button>
          ))}
        </div>

        {erro && <div className="erro">{erro}</div>}
        {!dados && !erro && <p className="aviso">Carregando…</p>}

        {dados && (
          <>
            <div className="resumo">
              <div className="numero">
                <strong>
                  {dados.temVendas
                    ? dados.unidades !== null
                      ? inteiro(dados.unidades)
                      : "—"
                    : dados.posicaoAtual !== null
                    ? `#${dados.posicaoAtual}`
                    : "—"}
                </strong>
                <span>{dados.temVendas ? "Unidades vendidas no período" : "Posição no ranking"}</span>
              </div>
              <div className="numero">
                <strong>
                  {dados.temVendas
                    ? dados.volume !== null
                      ? brl(dados.volume)
                      : "—"
                    : dados.posicaoInicio !== null && dados.posicaoAtual !== null
                    ? `#${dados.posicaoInicio} → #${dados.posicaoAtual}`
                    : "—"}
                </strong>
                <span>{dados.temVendas ? "Volume bruto no período" : "Variação no período"}</span>
              </div>
              <div className="numero">
                <strong>{dados.potencial}/100</strong>
                <span>Indicador de potencial</span>
              </div>
            </div>

            <div className="painel">
              <div className="linha" style={{ alignItems: "center" }}>
                <h3 style={{ flex: 1, margin: 0 }}>
                  {dados.temVendas ? "Volume bruto por intervalo" : "Posição no ranking por intervalo"}
                </h3>
                {!poucosDados && (
                  <button className="link" onClick={() => setTabela((t) => !t)}>
                    {tabela ? "Ver gráfico" : "Ver tabela"}
                  </button>
                )}
              </div>

              {poucosDados ? (
                <p className="aviso" style={{ marginTop: 10 }}>
                  Ainda coletando dados. O gráfico aparece depois de pelo menos duas checagens deste
                  produto dentro do período; o monitor registra um ponto a cada checagem.
                </p>
              ) : tabela ? (
                <table style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Intervalo</th>
                      {dados.temVendas && <th className="num">Unidades</th>}
                      {dados.temVendas && <th className="num">Volume</th>}
                      <th className="num">Posição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.intervalos.map((i, k) => (
                      <tr key={k}>
                        <td>{i.rotulo}</td>
                        {dados.temVendas && <td className="num">{i.unidades !== null ? inteiro(i.unidades) : "—"}</td>}
                        {dados.temVendas && <td className="num">{i.volume !== null ? brl(i.volume) : "—"}</td>}
                        <td className="num">{i.posicao !== null ? `#${i.posicao}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : dados.temVendas ? (
                <Grafico rotulos={rotulos} valores={serieVolume} formatar={brl} />
              ) : seriePosicao.filter((v) => v !== null).length >= 2 ? (
                <Grafico rotulos={rotulos} valores={seriePosicao} formatar={(n) => `#${n}`} invertido />
              ) : (
                <p className="aviso" style={{ marginTop: 10 }}>
                  Poucos pontos de ranking neste período para desenhar a curva.
                </p>
              )}
            </div>

            <div className="painel">
              <h3>Como o indicador de potencial é calculado</h3>
              <table>
                <tbody>
                  {dados.parcelas.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td className="aviso">{p.motivo}</td>
                      <td className="num">
                        {p.pontos}/{p.maximo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="aviso" style={{ marginTop: 8 }}>
                O indicador é um cálculo do app sobre os dados da plataforma, não um número oficial.
              </p>
            </div>

            <p className="aviso">
              Base: {dados.coletas} checagem(ns) no período
              {dados.desde ? `, histórico desde ${new Date(dados.desde).toLocaleDateString("pt-BR")}` : ""}.
              {!dados.temVendas && " Esta plataforma não informa unidades vendidas deste produto; o sinal de venda é a posição no ranking."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
