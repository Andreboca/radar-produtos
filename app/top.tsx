"use client";

import { useCallback, useEffect, useState } from "react";
import type { Janela, TopVendas } from "@/lib/historico";
import Logo from "./logo";
import { NOMES, type Produto } from "@/lib/types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");

const JANELAS: [Janela, string][] = [
  ["1h", "Última hora"],
  ["24h", "Último dia"],
];

/** Os 10 produtos que mais estão vendendo, com foto e link oficial da loja. */
export default function TopVendendo({
  onMetricas,
  onAbrirAlertas,
}: {
  onMetricas: (p: Produto) => void;
  onAbrirAlertas: () => void;
}) {
  const [janela, setJanela] = useState<Janela>("24h");
  const [dados, setDados] = useState<TopVendas | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (j: Janela) => {
    try {
      const resp = await fetch(`/api/top?janela=${j}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro || "Falha ao carregar.");
      setDados(json.top);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, []);

  useEffect(() => {
    carregar(janela);
    const t = setInterval(() => carregar(janela), 60_000);
    return () => clearInterval(t);
  }, [carregar, janela]);

  const rotuloJanela = janela === "1h" ? "na última hora" : "no último dia";

  return (
    <section className="painel">
      <div className="linha" style={{ alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0 }}>Top 10 vendendo agora</h2>
          <p className="aviso">
            {dados?.atualizadoEm
              ? `Última checagem às ${new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Aguardando a primeira checagem"}
          </p>
        </div>
        <div className="segmentos" role="tablist" aria-label="Janela de tempo" style={{ marginBottom: 0 }}>
          {JANELAS.map(([id, nome]) => (
            <button
              key={id}
              role="tab"
              aria-selected={janela === id}
              className={janela === id ? "ativo" : ""}
              onClick={() => setJanela(id)}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}

      {dados?.modo === "ranking" && (
        <p className="avisos">
          Ainda não há duas checagens {rotuloJanela} para medir as vendas. Por enquanto esta lista
          mostra o ranking atual das plataformas; a contagem de vendas aparece conforme o monitor
          roda.
        </p>
      )}

      {dados?.modo === "vazio" && (
        <p className="aviso">
          Nenhum produto registrado ainda. Conecte uma plataforma e escolha o que monitorar em{" "}
          <button className="link" onClick={onAbrirAlertas}>
            Alertas
          </button>
          ; depois da primeira checagem os produtos aparecem aqui.
        </p>
      )}

      <div className="grade top">
        {dados?.itens.map(({ produto: p, unidades, volume }, i) => (
          <article className="produto" key={`${p.plataforma}-${p.id}`}>
            <div className="produto-foto">
              {p.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem} alt="" loading="lazy" />
              ) : (
                <span className="sem-foto">Sem foto</span>
              )}
              <span className="selo com-logo">
                <Logo id={p.plataforma} tamanho={16} />
                {NOMES[p.plataforma]}
              </span>
              <span className="selo posicao">{i + 1}º</span>
            </div>
            <div className="produto-corpo">
              <h3>{p.nome}</h3>
              <p className="preco">{p.preco !== null ? brl(p.preco) : "Preço não informado"}</p>
              <p className="destaque-venda">
                {unidades !== null
                  ? `+${inteiro(unidades)} vendido(s) ${rotuloJanela}`
                  : p.posicao !== null
                  ? `#${p.posicao} no ranking da plataforma`
                  : p.vendas !== null
                  ? `${inteiro(p.vendas)} vendas no total`
                  : ""}
              </p>
              {volume !== null && volume > 0 && <p className="aviso">{brl(volume)} em vendas</p>}
              <div className="produto-acoes">
                {p.link ? (
                  <a className="acao cheio" href={p.link} target="_blank" rel="noreferrer">
                    Ver na loja oficial
                  </a>
                ) : (
                  <span className="leve cheio inativo">Sem link</span>
                )}
                <button className="leve cheio" onClick={() => onMetricas(p)}>
                  Analisar métricas
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
