"use client";

import { useState } from "react";

type TipoImagem = "ugc" | "mirror" | "size";

type Resultado = { produto: string; cena: string[]; prompt: string };

const TIPOS: { id: TipoImagem; titulo: string; resumo: string }[] = [
  { id: "ugc", titulo: "Imagem UGC", resumo: "Foto estilo TikTok, pessoa segurando o produto em casa." },
  { id: "mirror", titulo: "Mirror selfie (provador)", resumo: "De frente para o espelho, como se estivesse provando a roupa." },
  { id: "size", titulo: "Plus size", resumo: "Só do pescoço para baixo, modelo com corpo plus size." },
];

/** Reduz a imagem antes de enviar (lado máx. 1024 px, JPEG) para não estourar a requisição. */
function lerImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Não foi possível ler a imagem."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
    img.src = url;
  });
}

function ZonaArrastar({
  titulo,
  texto,
  imagem,
  onArquivo,
  onRemover,
}: {
  titulo: string;
  texto: string;
  imagem: string | null;
  onArquivo: (arquivo: File) => void;
  onRemover: () => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const id = `zona-${titulo.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="vgrupo">
      <span className="vrotulo">{titulo}</span>
      {imagem ? (
        <div className="vfoto-atual">
          <img src={imagem} alt={titulo} />
          <button className="vbotao secundario" onClick={onRemover}>Remover foto</button>
        </div>
      ) : (
        <div
          className={`vsoltar ${arrastando ? "ativo" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => document.getElementById(id)?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") document.getElementById(id)?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const arquivo = e.dataTransfer.files?.[0];
            if (arquivo && arquivo.type.startsWith("image/")) onArquivo(arquivo);
          }}
        >
          <span>{texto}</span>
          <small>JPG, PNG ou WEBP</small>
          <input
            id={id}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) onArquivo(arquivo);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function CriacaoImagem() {
  const [tipo, setTipo] = useState<TipoImagem>("ugc");
  const [fotoInfluencia, setFotoInfluencia] = useState<string | null>(null);
  const [fotoProduto, setFotoProduto] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const atual = TIPOS.find((t) => t.id === tipo)!;

  async function aoEscolher(arquivo: File, aoFim: (dataUrl: string) => void) {
    try {
      aoFim(await lerImagem(arquivo));
      setResultado(null);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler a imagem.");
    }
  }

  async function gerar() {
    if (!fotoProduto) {
      setErro("Arraste a foto do produto primeiro.");
      return;
    }
    setGerando(true);
    setErro(null);
    setCopiado(false);
    try {
      const resp = await fetch("/api/imagem-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, produto: fotoProduto, influencia: fotoInfluencia ?? undefined }),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) throw new Error(j.erro || "Falha ao gerar o prompt.");
      setResultado(j.resultado as Resultado);
    } catch (e) {
      setResultado(null);
      setErro(e instanceof Error ? e.message : "Falha ao gerar o prompt.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.prompt);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="painel video-painel">
      <div className="vtipos" role="tablist" aria-label="Tipo de imagem">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tipo === t.id}
            className={`vtipo ${tipo === t.id ? "ativo" : ""}`}
            onClick={() => {
              setTipo(t.id);
              setResultado(null);
              setCopiado(false);
            }}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      <h2 className="video-titulo">{atual.titulo}</h2>
      <p className="video-resumo">{atual.resumo}</p>

      <div className="vstoryboard" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <ZonaArrastar
          titulo="Foto da influência"
          texto="Arraste a foto da influência aqui"
          imagem={fotoInfluencia}
          onArquivo={(f) => aoEscolher(f, setFotoInfluencia)}
          onRemover={() => setFotoInfluencia(null)}
        />
        <ZonaArrastar
          titulo="Foto do produto"
          texto="Arraste a foto do produto aqui"
          imagem={fotoProduto}
          onArquivo={(f) => aoEscolher(f, setFotoProduto)}
          onRemover={() => setFotoProduto(null)}
        />
      </div>

      <button className="vbotao" onClick={gerar} disabled={gerando || !fotoProduto}>
        {gerando ? "Agente lendo o produto..." : "Gerar"}
      </button>

      {erro && <p className="vnota">{erro}</p>}

      {resultado && (
        <>
          <div className="vprevia">
            <span className="vrotulo" style={{ margin: "0 0 10px" }}>Como vai ficar</span>
            <div className="vclipe">
              <strong>{resultado.produto}</strong>
              <ul>
                {resultado.cena.map((linha, i) => (
                  <li key={i}>{linha}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="vresultado">
            <div className="vresultado-topo">
              <span className="vrotulo" style={{ margin: 0 }}>Prompt de imagem</span>
              <button className="vbotao secundario" onClick={copiar}>{copiado ? "Copiado" : "Copiar prompt"}</button>
            </div>
            <pre className="vprompt">{resultado.prompt}</pre>
            <p className="vnota">
              Cole este prompt no gerador de imagem junto com as duas fotos de referência.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
