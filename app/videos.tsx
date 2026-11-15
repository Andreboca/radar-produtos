"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrdemVideo, Produto, VideoProduto } from "@/lib/types";

const inteiro = (n: number) => n.toLocaleString("pt-BR");
const dinheiro = (n: number, moeda?: string | null) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: moeda || "BRL" });

const ORDENS: [OrdemVideo, string][] = [
  ["gmv", "Mais faturou"],
  ["units_sold", "Mais vendeu"],
  ["play_count", "Mais visto"],
  ["digg_count", "Mais curtido"],
];

const TIPOS: [string, string][] = [
  ["todos", "Todos"],
  ["pagos", "Com anúncio"],
  ["organicos", "Orgânicos"],
];

/** Os vídeos que venderam este produto, para estudar o gancho e modelar. */
export default function JanelaVideos({
  produto,
  onFechar,
}: {
  produto: Produto;
  onFechar: () => void;
}) {
  const [ordem, setOrdem] = useState<OrdemVideo>("gmv");
  const [tipo, setTipo] = useState("todos");
  const [videos, setVideos] = useState<VideoProduto[] | null>(null);
  const [erro, setErro] = useState("");
  const fechar = useRef<HTMLButtonElement>(null);

  const carregar = useCallback(async () => {
    setVideos(null);
    setErro("");
    try {
      const resp = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId: produto.id, ordem, tipo, moeda: produto.moeda }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro || "Falha ao carregar os vídeos.");
      setVideos(json.videos as VideoProduto[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, [produto.id, produto.moeda, ordem, tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <div className="veu" onClick={onFechar}>
      <div
        className="janela"
        role="dialog"
        aria-modal="true"
        aria-label={`Vídeos que vendem ${produto.nome}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={fechar} className="fechar" aria-label="Fechar" onClick={onFechar}>
          ×
        </button>
        <span className="sobretitulo">Vídeos que vendem · TikTok Shop</span>
        <h2>{produto.nome}</h2>

        <div className="segmentos" role="tablist" aria-label="Ordenar por">
          {ORDENS.map(([id, nome]) => (
            <button
              key={id}
              role="tab"
              aria-selected={ordem === id}
              className={ordem === id ? "ativo" : ""}
              onClick={() => setOrdem(id)}
            >
              {nome}
            </button>
          ))}
        </div>

        <div className="segmentos" role="tablist" aria-label="Tipo de vídeo">
          {TIPOS.map(([id, nome]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tipo === id}
              className={tipo === id ? "ativo" : ""}
              onClick={() => setTipo(id)}
            >
              {nome}
            </button>
          ))}
        </div>

        {erro && <div className="erro">{erro}</div>}
        {!videos && !erro && <p className="aviso">Carregando…</p>}
        {videos && videos.length === 0 && (
          <p className="aviso">
            Nenhum vídeo encontrado nos últimos 30 dias com esse filtro.
          </p>
        )}

        <div className="grade top">
          {videos?.map((v) => (
            <article className="produto" key={v.id}>
              <div className="produto-foto">
                {v.capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.capa} alt="" loading="lazy" />
                ) : (
                  <span className="sem-foto">Sem capa</span>
                )}
                {v.anuncio && <span className="selo posicao">Anúncio pago</span>}
              </div>
              <div className="produto-corpo">
                <h3>{v.descricao}</h3>
                <p className="preco">
                  {v.faturamento !== null ? dinheiro(v.faturamento, v.moeda) : "—"}
                </p>
                <p className="aviso">
                  {[
                    v.vendas !== null ? `${inteiro(v.vendas)} vendas` : "",
                    v.views !== null ? `${inteiro(v.views)} views` : "",
                    v.curtidas !== null ? `${inteiro(v.curtidas)} curtidas` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {v.publicadoEm !== null && (
                  <p className="aviso">
                    Publicado em {new Date(v.publicadoEm).toLocaleDateString("pt-BR")}
                  </p>
                )}
                <div className="produto-acoes">
                  {v.link ? (
                    <a className="acao cheio" href={v.link} target="_blank" rel="noreferrer">
                      Assistir no TikTok
                    </a>
                  ) : (
                    <span className="leve cheio inativo">Sem link</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
