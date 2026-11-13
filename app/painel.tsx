"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Grafico } from "./metricas";
import Logo from "./logo";
import type { ResumoVendas } from "@/lib/vendas";
import { NOMES } from "@/lib/types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Compara o valor de hoje com a média diária do período. */
function Comparativo({ valor, media, formatar }: { valor: number; media: number; formatar: (n: number) => string }) {
  if (!(media > 0)) return <em className="comparativo neutro">sem média para comparar</em>;
  const dif = ((valor - media) / media) * 100;
  return (
    <em className={`comparativo ${dif >= 0 ? "bom" : "ruim"}`}>
      {dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs. média diária ({formatar(media)})
    </em>
  );
}

const PERIODOS: [number, string][] = [
  [1, "Hoje"],
  [7, "7 dias"],
  [30, "30 dias"],
];

export default function Painel({ onConfigurar }: { onConfigurar: () => void }) {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<ResumoVendas | null>(null);
  const [erro, setErro] = useState("");
  const [tabela, setTabela] = useState(false);
  const [serie, setSerie] = useState<"comissao" | "vendido" | "pedidos">("comissao");

  // Atualização automática
  const [agora, setAgora] = useState(Date.now());
  const [novas, setNovas] = useState<Set<string>>(new Set());
  const conhecidas = useRef<Set<string> | null>(null);
  const diasAtual = useRef(dias);

  const carregar = useCallback(async (d: number) => {
    try {
      const resp = await fetch(`/api/vendas?dias=${d}`);
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.erro || "Falha ao carregar.");
      const p = j.painel as ResumoVendas;
      // Marca as vendas que apareceram desde a última atualização.
      const ids = new Set(p.recentes.map((v) => v.id));
      if (conhecidas.current && diasAtual.current === d) {
        const chegaram = [...ids].filter((id) => !conhecidas.current!.has(id));
        if (chegaram.length) setNovas(new Set(chegaram));
      } else {
        setNovas(new Set());
      }
      conhecidas.current = ids;
      diasAtual.current = d;
      setDados(p);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, []);

  const intervalo = dados?.intervaloSeg ?? 60;

  // Busca ao abrir, ao trocar o período e depois sozinho, no intervalo configurado.
  useEffect(() => {
    carregar(dias);
    const t = setInterval(() => carregar(dias), intervalo * 1000);
    return () => clearInterval(t);
  }, [carregar, dias, intervalo]);

  // Relógio de 1 segundo só para mostrar há quanto tempo foi a última atualização.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ha = dados ? Math.max(0, Math.round((agora - new Date(dados.atualizadoEm).getTime()) / 1000)) : null;
  const automaticas = dados?.fontes.filter((f) => f.automatica) || [];
  const algumaConectada = automaticas.some((f) => f.conectada);

  const semVendas = dados !== null && dados.pedidos === 0 && dados.canceladas === 0;

  return (
    <>
      <div className="linha" style={{ marginBottom: 14, alignItems: "center" }}>
        <div className="segmentos" role="tablist" aria-label="Período" style={{ marginBottom: 0 }}>
          {PERIODOS.map(([d, nome]) => (
            <button
              key={d}
              role="tab"
              aria-selected={dias === d}
              className={dias === d ? "ativo" : ""}
              onClick={() => setDias(d)}
            >
              {nome}
            </button>
          ))}
        </div>
        <span className="aovivo" role="status">
          <span className={`pulso ${algumaConectada ? "" : "parado"}`} aria-hidden="true" />
          {!dados
            ? "Carregando…"
            : algumaConectada
            ? `Atualiza sozinho a cada ${intervalo}s · última há ${ha}s`
            : "Nenhuma conta de afiliado conectada"}
        </span>
      </div>

      {dados && (
        <div className="etiquetas" style={{ marginBottom: 14 }}>
          {dados.fontes.map((f) => (
            <span className="etiqueta com-logo" key={f.plataforma}>
              <Logo id={f.plataforma} tamanho={16} />
              <span className={`ponto ${f.erro ? "ruim-bg" : f.conectada ? "bom-bg" : ""}`} />
              {f.nome}:{" "}
              {!f.automatica
                ? "sem API de vendas de afiliado"
                : f.erro
                ? "erro na consulta"
                : f.conectada
                ? "importando sozinho"
                : "não conectada"}
            </span>
          ))}
          {!algumaConectada && (
            <button className="link" onClick={onConfigurar}>
              Conectar agora
            </button>
          )}
        </div>
      )}

      {novas.size > 0 && (
        <div className="novidade" role="status">
          {novas.size} venda(s) nova(s) desde a última atualização.
        </div>
      )}

      {erro && <div className="erro">{erro}</div>}
      {dados?.fontes
        .filter((f) => f.erro)
        .map((f) => (
          <div className="erro" key={f.plataforma}>
            {f.erro}
          </div>
        ))}

      <div className="hoje">
        <div className="hoje-cabeca">
          <span className="sobretitulo">Venda diária · hoje</span>
          <span className="aviso">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </span>
        </div>
        <div className="numeros">
          <div className="numero destaque">
            <strong>{dados ? brl(dados.hoje.comissao) : "—"}</strong>
            <span>Comissão de hoje</span>
            {dados && <Comparativo valor={dados.hoje.comissao} media={dados.mediaDia.comissao} formatar={brl} />}
          </div>
          <div className="numero">
            <strong>{dados ? brl(dados.hoje.vendido) : "—"}</strong>
            <span>Faturamento de hoje</span>
            {dados && <Comparativo valor={dados.hoje.vendido} media={dados.mediaDia.vendido} formatar={brl} />}
          </div>
          <div className="numero">
            <strong>{dados ? dados.hoje.pedidos : "—"}</strong>
            <span>Vendas de hoje</span>
            {dados && (
              <Comparativo valor={dados.hoje.pedidos} media={dados.mediaDia.pedidos} formatar={(n) => n.toFixed(1)} />
            )}
          </div>
        </div>
      </div>

      <span className="sobretitulo" style={{ display: "block", margin: "4px 0 8px" }}>
        {dias === 1 ? "Acumulado · hoje" : `Acumulado · últimos ${dias} dias`}
      </span>
      <div className="numeros quatro">
        <div className="numero">
          <strong>{dados ? brl(dados.comissao) : "—"}</strong>
          <span>Comissão ganha</span>
        </div>
        <div className="numero">
          <strong>{dados ? brl(dados.vendido) : "—"}</strong>
          <span>Faturamento (vendido pelos seus links)</span>
        </div>
        <div className="numero">
          <strong>{dados ? dados.pedidos.toLocaleString("pt-BR") : "—"}</strong>
          <span>
            Vendas{dados && dados.canceladas > 0 ? ` (${dados.canceladas} cancelada(s) fora da conta)` : ""}
          </span>
        </div>
        <div className="numero">
          <strong>{dados?.taxaMedia != null ? `${dados.taxaMedia.toFixed(1)}%` : "—"}</strong>
          <span>Comissão média</span>
        </div>
      </div>

      <div className="painel">
        <div className="linha" style={{ alignItems: "center" }}>
          <h3 style={{ flex: 1, margin: 0 }}>Vendas por dia</h3>
          {!semVendas && dados && (
            <>
              <div className="segmentos" role="tablist" aria-label="Métrica do gráfico" style={{ marginBottom: 0 }}>
                {(
                  [
                    ["comissao", "Comissão"],
                    ["vendido", "Faturamento"],
                    ["pedidos", "Vendas"],
                  ] as const
                ).map(([id, nome]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={serie === id}
                    className={serie === id ? "ativo" : ""}
                    onClick={() => setSerie(id)}
                  >
                    {nome}
                  </button>
                ))}
              </div>
              <button className="link" onClick={() => setTabela((t) => !t)}>
                {tabela ? "Ver gráfico" : "Ver tabela"}
              </button>
            </>
          )}
        </div>
        {!dados ? (
          <p className="aviso">Carregando…</p>
        ) : semVendas ? (
          <p className="aviso" style={{ marginTop: 8 }}>
            Nenhuma venda no período. Assim que uma venda for registrada na sua conta de afiliado
            conectada, ela aparece aqui sozinha.
          </p>
        ) : tabela ? (
          <div className="tabela-rolagem" style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th className="num">Vendas</th>
                  <th className="num">Faturamento</th>
                  <th className="num">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {dados.porDia.map((d) => (
                  <tr key={d.rotulo}>
                    <td>{d.rotulo}</td>
                    <td className="num">{d.pedidos}</td>
                    <td className="num">{brl(d.vendido)}</td>
                    <td className="num">{brl(d.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Grafico
            rotulos={dados.porDia.map((d) => d.rotulo)}
            valores={dados.porDia.map((d) => d[serie])}
            formatar={serie === "pedidos" ? (n) => `${n} venda(s)` : brl}
          />
        )}
      </div>

      {dados && !semVendas && (
        <div className="duas" style={{ marginBottom: 16 }}>
          <div className="painel tabela-rolagem">
            <h3>Por plataforma</h3>
            <table>
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th className="num">Vendas</th>
                  <th className="num">Vendido</th>
                  <th className="num">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {dados.porPlataforma.map((p) => (
                  <tr key={p.plataforma}>
                    <td>
                      <span className="com-logo">
                        <Logo id={p.plataforma} />
                        {p.nome}
                      </span>
                    </td>
                    <td className="num">{p.pedidos}</td>
                    <td className="num">{brl(p.vendido)}</td>
                    <td className="num forte">{brl(p.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="painel tabela-rolagem">
            <h3>Produtos que mais renderam</h3>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Vendas</th>
                  <th className="num">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {dados.topProdutos.map((p) => (
                  <tr key={p.produto}>
                    <td>{p.produto}</td>
                    <td className="num">{p.pedidos}</td>
                    <td className="num forte">{brl(p.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
