"use client";

import { useMemo, useState } from "react";

export type TipoVideo = "ugc" | "achadinho" | "movimento" | "size";
type Formato = "9:16" | "16:9";
type Plataforma = "tiktok" | "shopee" | "meli";

const ORDEM: TipoVideo[] = ["ugc", "achadinho", "movimento", "size"];
const FORMATOS: Formato[] = ["9:16", "16:9"];
const PREDEFINIDAS = [8, 10, 15, 30];
const LIMITE_CLIPE = 15;

type Passo = { de: number; ate: number; texto: string };
type Tipo = { titulo: string; resumo: string; base: number; falaObrigatoria: boolean; passos: Passo[] };
type Roteiro = { produto: string; aviso: string; cenas: string[]; narracao: string; fonte: "ia" | "modelo" };

const TIPOS: Record<TipoVideo, Tipo> = {
  ugc: {
    titulo: "Vídeo UGC",
    resumo: "Primeira pessoa, mãos abrem a caixa e mostram o produto de perto.",
    base: 8,
    falaObrigatoria: true,
    passos: [
      { de: 0, ate: 2, texto: "as mãos femininas abrem as abas da caixa de papelão sobre a mesa" },
      { de: 2, ate: 4, texto: "o produto aparece protegido por embalagem simples" },
      { de: 4, ate: 6, texto: "uma mão pega o produto e começa a tirá-lo da caixa" },
      { de: 6, ate: 8, texto: "o produto é levantado perto da câmera, inteiro e visível" },
    ],
  },
  achadinho: {
    titulo: "Vídeo achadinho",
    resumo: "Teste de produto: pega, mostra o acabamento e usa de verdade.",
    base: 15,
    falaObrigatoria: true,
    passos: [
      { de: 0, ate: 5, texto: "as mãos pegam o produto e mostram o acabamento de perto" },
      { de: 5, ate: 10, texto: "as mãos testam o funcionamento do jeito real de uso" },
      { de: 10, ate: 15, texto: "o produto fica parado nas mãos, completamente visível" },
    ],
  },
  movimento: {
    titulo: "Vídeo mirror selfie",
    resumo: "Mostra só a roupa: toque no tecido, giro leve e puxão final, sem fala.",
    base: 10,
    falaObrigatoria: false,
    passos: [
      { de: 0, ate: 2, texto: "a pessoa respira e fica parada na pose inicial" },
      { de: 2, ate: 5, texto: "a mão livre desliza de cima para baixo no tecido, sem puxar" },
      { de: 5, ate: 7, texto: "a mão volta devagar e a pessoa dá um pequeno passo para trás" },
      { de: 7, ate: 9, texto: "giro leve do tronco para mostrar o caimento" },
      { de: 9, ate: 10, texto: "um único puxão leve no tecido e solta" },
    ],
  },
  size: {
    titulo: "Vídeo plus size",
    resumo: "Só do pescoço para baixo, com o caimento da roupa no corpo.",
    base: 10,
    falaObrigatoria: false,
    passos: [
      { de: 0, ate: 3, texto: "câmera parada mostrando o caimento da roupa no corpo" },
      { de: 3, ate: 6, texto: "giro leve para mostrar o ângulo lateral" },
      { de: 6, ate: 8, texto: "a mão passa devagar no tecido" },
      { de: 8, ate: 10, texto: "pose final parada, roupa bem visível" },
    ],
  },
};

const arred = (n: number) => Math.round(n * 10) / 10;

/** Detecta plataforma e ID a partir do link oficial do produto. */
export function lerLink(texto: string): { plataforma: Plataforma | null; id: string } {
  const t = texto.trim();
  const meli = t.match(/MLB-?(\d{6,})/i);
  if (meli) return { plataforma: "meli", id: `MLB${meli[1]}` };
  const shopee = t.match(/product\/(\d+)\/(\d+)/) || t.match(/i\.(\d+)\.(\d+)/);
  if (shopee) return { plataforma: "shopee", id: `${shopee[1]}/${shopee[2]}` };
  const tiktok = t.match(/(?:pdp\/[^/?#]*\/|view\/product\/)(\d{10,})/);
  if (tiktok) return { plataforma: "tiktok", id: tiktok[1] };
  return { plataforma: null, id: t };
}

/** Divide o vídeo em clipes de até 15 segundos, cada um com seu prompt. */
function dividirClipes(total: number) {
  const n = Math.max(1, Math.ceil(total / LIMITE_CLIPE));
  const tamanho = total / n;
  return Array.from({ length: n }, (_, i) => ({ i, de: i * tamanho, ate: (i + 1) * tamanho }));
}

/** Reparte a narração em partes iguais, por palavra, entre os clipes. */
function repartirFala(fala: string, n: number): string[] {
  const palavras = fala.trim().split(/\s+/).filter(Boolean);
  if (!palavras.length) return Array(n).fill("");
  const tamanho = Math.ceil(palavras.length / n);
  return Array.from({ length: n }, (_, i) => palavras.slice(i * tamanho, (i + 1) * tamanho).join(" "));
}

type Cena = { de: number; ate: number; texto: string };

function cenasDoTempo(tipo: TipoVideo, total: number, cenasTexto?: string[]): Cena[] {
  const t = TIPOS[tipo];
  const escala = total / t.base;
  const textos = cenasTexto && cenasTexto.length === t.passos.length ? cenasTexto : t.passos.map((p) => p.texto);
  return t.passos.map((p, i) => ({ de: p.de * escala, ate: p.ate * escala, texto: textos[i] }));
}

function montarPrompts(
  tipo: TipoVideo,
  formato: Formato,
  total: number,
  produto: string,
  fala: string,
  cenasTexto?: string[]
) {
  const orientacao = formato === "9:16" ? "vertical 9:16" : "horizontal 16:9";
  const cenas = cenasDoTempo(tipo, total, cenasTexto);
  const clipes = dividirClipes(total);
  const falas = repartirFala(fala, clipes.length);
  const produtoTexto = produto.trim() || "conforme a foto de referência";
  const titulo = TIPOS[tipo].titulo;

  return clipes.map((c, idx) => {
    const noClipe = cenas
      .filter((s) => s.ate > c.de && s.de < c.ate)
      .map((s) => `${arred(Math.max(s.de, c.de) - c.de)}–${arred(Math.min(s.ate, c.ate) - c.de)}s: ${s.texto}.`)
      .join(" ");
    const narracao = falas[idx]
      ? ` Narração em português do Brasil, voz de mulher, sotaque paulista, natural e espontânea, neste trecho: "${falas[idx]}".`
      : " Sem fala neste trecho.";
    const texto =
      `${titulo}, formato ${orientacao}, clipe ${idx + 1} de ${clipes.length} com ${arred(c.ate - c.de)} segundos ` +
      `(vídeo completo de ${total} segundos, este trecho vai de ${arred(c.de)}s a ${arred(c.ate)}s). ` +
      `A foto de referência é a única fonte do produto: mesma forma, cor, material e detalhes, sem alterar nada. ` +
      `Produto: ${produtoTexto}. Câmera realista de smartphone, sem texto na tela, sem legenda e sem música. ` +
      `Movimentos deste trecho: ${noClipe || "câmera parada no produto"}${narracao}`;
    return { titulo: `Clipe ${idx + 1} de ${clipes.length} · ${arred(c.de)}s a ${arred(c.ate)}s`, texto, c, cenasNoClipe: noClipe, fala: falas[idx] };
  });
}

export default function GeracaoVideo() {
  const [tipo, setTipo] = useState<TipoVideo>("ugc");
  const [link, setLink] = useState("");
  const [plataforma, setPlataforma] = useState<Plataforma>("tiktok");
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroRoteiro, setErroRoteiro] = useState("");
  const [formato, setFormato] = useState<Formato>("9:16");
  const [duracao, setDuracao] = useState(8);
  const [produto, setProduto] = useState("");
  const [fala, setFala] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const t = TIPOS[tipo];

  const lido = useMemo(() => lerLink(link), [link]);
  const clipes = useMemo(
    () => montarPrompts(tipo, formato, duracao, produto, fala, tipo === "ugc" ? roteiro?.cenas : undefined),
    [tipo, formato, duracao, produto, fala, roteiro]
  );

  function arquivoDaFoto(arquivo?: File | null) {
    if (arquivo && arquivo.type.startsWith("image/")) {
      setFoto(URL.createObjectURL(arquivo));
    }
  }

  async function gerarRoteiroAgente() {
    setGerando(true);
    setErroRoteiro("");
    try {
      const resp = await fetch("/api/roteiro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produtoId: lido.id, plataforma: lido.plataforma || plataforma, produtoNome: produto, fala }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.erro || "Falha ao gerar o roteiro.");
      const r = j.roteiro as Roteiro;
      setRoteiro(r);
      setFala(r.narracao);
      if (!produto.trim() && r.produto) setProduto(r.produto);
    } catch (e) {
      setErroRoteiro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar(i: number) {
    try {
      await navigator.clipboard.writeText(clipes[i].texto);
      setCopiadoIdx(i);
    } catch {
      setCopiadoIdx(null);
    }
  }

  return (
    <div className="painel video-painel">
      <div className="vtipos" role="tablist" aria-label="Tipo de vídeo">
        {ORDEM.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tipo === k}
            className={`vtipo ${tipo === k ? "ativo" : ""}`}
            onClick={() => {
              setTipo(k);
              setCopiadoIdx(null);
            }}
          >
            {TIPOS[k].titulo}
          </button>
        ))}
      </div>

      <h2 className="video-titulo">{t.titulo}</h2>
      <p className="video-resumo">{t.resumo}</p>

      {tipo === "ugc" && (
        <div className="vagente">
          <span className="vrotulo">Link oficial do produto</span>
          <input
            className="vcampo"
            value={link}
            onChange={(e) => {
              const v = e.target.value;
              setLink(v);
              const l = lerLink(v);
              if (l.plataforma) setPlataforma(l.plataforma);
            }}
            placeholder="Cole o link do produto (Mercado Livre, Shopee ou TikTok Shop)"
          />
          <div className="vopcoes" role="radiogroup" aria-label="Plataforma do produto" style={{ margin: "10px 0" }}>
            {(["tiktok", "shopee", "meli"] as const).map((pl) => (
              <button
                key={pl}
                role="radio"
                aria-checked={plataforma === pl}
                className={`vopcao ${plataforma === pl ? "ativo" : ""}`}
                onClick={() => setPlataforma(pl)}
              >
                {pl === "meli" ? "Mercado Livre" : pl === "shopee" ? "Shopee" : "TikTok Shop"}
              </button>
            ))}
          </div>
          {link.trim() && (
            <p className="vnota" style={{ marginTop: 0 }}>
              {lido.plataforma
                ? `Produto identificado: ${lido.id}`
                : "Não reconheci o link. Confira se é o link oficial do produto."}
            </p>
          )}
          <button className="vbotao" onClick={gerarRoteiroAgente} disabled={gerando || !link.trim()}>
            {gerando ? "Gerando roteiro…" : "Gerar roteiro com agente"}
          </button>
          {erroRoteiro && <p className="vnota" style={{ color: "#b42318" }}>{erroRoteiro}</p>}
          {roteiro && (
            <div className="vprevia" style={{ marginTop: 14 }}>
              <span className="vrotulo" style={{ margin: "0 0 8px" }}>
                Roteiro gerado · {roteiro.fonte === "ia" ? "com IA" : "modelo UGC"}
              </span>
              {roteiro.aviso && <p className="vnota" style={{ marginTop: 0 }}>{roteiro.aviso}</p>}
              <ol className="vcenas">
                {roteiro.cenas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="vgrupo">
        <span className="vrotulo">Formato</span>
        <div className="vopcoes" role="radiogroup" aria-label="Formato">
          {FORMATOS.map((f) => (
            <button key={f} role="radio" aria-checked={formato === f} className={`vopcao ${formato === f ? "ativo" : ""}`} onClick={() => setFormato(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="vgrupo">
        <span className="vrotulo">Duração do vídeo</span>
        <div className="vopcoes">
          {PREDEFINIDAS.map((d) => (
            <button key={d} role="radio" aria-checked={duracao === d} className={`vopcao ${duracao === d ? "ativo" : ""}`} onClick={() => setDuracao(d)}>
              {d} segundos
            </button>
          ))}
        </div>
      </div>

      <div className="vgrupo">
        <span className="vrotulo">Foto de referência do produto</span>
        <div
          className={`vsoltar ${arrastando ? "ativo" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            arquivoDaFoto(e.dataTransfer.files?.[0]);
          }}
          onClick={() => document.getElementById("vfoto-input")?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") document.getElementById("vfoto-input")?.click();
          }}
        >
          <span>Arraste a foto do produto aqui ou clique para escolher</span>
          <small>JPG, PNG ou WEBP</small>
          <input
            id="vfoto-input"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => arquivoDaFoto(e.target.files?.[0])}
          />
        </div>
        {foto && (
          <div className="vfoto-atual">
            <img src={foto} alt="Foto de referência carregada" />
            <button className="vbotao secundario" onClick={() => setFoto(null)}>Remover foto</button>
          </div>
        )}
      </div>

      <label className="vgrupo" style={{ display: "block" }}>
        <span className="vrotulo">Nome do produto</span>
        <input className="vcampo" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: bolsa de couro caramelo" />
      </label>

      <label className="vgrupo" style={{ display: "block" }}>
        <span className="vrotulo">Fala (narração){t.falaObrigatoria ? "" : " — opcional"}</span>
        <textarea className="vcampo" value={fala} onChange={(e) => setFala(e.target.value)} rows={4} placeholder="Ex.: Menina, olha como funciona. Valeu cada centavo." />
      </label>

      <div className="vprevia">
        <span className="vrotulo" style={{ margin: "0 0 10px" }}>
          Prévia do vídeo · {duracao} segundos em {clipes.length} {clipes.length === 1 ? "clipe" : "clipes"}
        </span>
        <div className="vstoryboard">
          {clipes.map((c, i) => (
            <div key={i} className="vquadro">
              <div className="vquadro-foto">
                {foto ? <img src={foto} alt={`Quadro ${i + 1}`} /> : <span>Foto do produto</span>}
              </div>
              <div className="vquadro-texto">
                <b>{c.titulo}</b>
                <p>{c.cenasNoClipe || "Câmera parada no produto."}</p>
                {c.fala && <p className="vfala">“{c.fala}”</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="vnota">Esta prévia mostra o roteiro e os quadros com a sua foto. O vídeo final sai do motor de vídeo.</p>
      </div>

      <div className="vresultado">
        {clipes.map((c, i) => (
          <div key={i} className="vclipe">
            <div className="vresultado-topo">
              <span className="vrotulo" style={{ margin: 0 }}>Prompt · {c.titulo}</span>
              <button className="vbotao secundario" onClick={() => copiar(i)}>
                {copiadoIdx === i ? "Copiado" : "Copiar prompt"}
              </button>
            </div>
            <pre className="vprompt">{c.texto}</pre>
          </div>
        ))}
        <p className="vnota">Cole cada prompt no motor de vídeo junto com a foto de referência, na ordem dos clipes. A geração direta pelo app ainda não está ligada.</p>
      </div>
    </div>
  );
}
