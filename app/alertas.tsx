"use client";

import { useCallback, useEffect, useState } from "react";
import type { Alerta, ConfigMonitor } from "@/lib/monitor";
import Logo from "./logo";
import { NOMES, type Categoria } from "@/lib/types";

type Dados = {
  alertas: Alerta[];
  config: ConfigMonitor;
  ultimaChecagem: string | null;
  telegram: boolean;
  telegramToken: boolean;
  telegramGrupo: boolean;
  whatsapp: boolean;
  ia: boolean;
  intervaloMin: number;
  horaResumo: number;
};

const ROTULO: Record<Alerta["tipo"], string> = {
  novo: "Novo no ranking",
  subiu: "Subiu",
  vendas: "Salto de vendas",
  resumo: "Resumo diário",
  envio: "Enviado aos grupos",
  erro: "Erro",
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function Alertas({ categorias }: { categorias: Categoria[] }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [selecionadas, setSelecionadas] = useState<Categoria[]>([]);
  const [termos, setTermos] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async (aplicarConfig: boolean) => {
    try {
      const d: Dados = await (await fetch("/api/alertas")).json();
      setDados(d);
      if (aplicarConfig) {
        setSelecionadas(d.config.categoriasMeli || []);
        setTermos((d.config.termos || []).join(", "));
      }
    } catch {
      setMensagem("Não foi possível carregar os alertas.");
    }
  }, []);

  useEffect(() => {
    carregar(true);
    const t = setInterval(() => carregar(false), 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  async function acao(nome: string, rota: string, corpo: unknown, sucesso: (j: Record<string, unknown>) => string) {
    setOcupado(nome);
    setMensagem("");
    try {
      const resp = await fetch(rota, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro || "Falha na requisição.");
      setMensagem(sucesso(json));
      await carregar(false);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado("");
    }
  }

  const config = () => ({
    categoriasMeli: selecionadas,
    termos: termos.split(",").map((t) => t.trim()).filter(Boolean),
  });

  const salvar = () => acao("salvar", "/api/monitor/config", config(), () => "Configuração salva.");

  async function checar(resumo: boolean) {
    // Salva antes para a checagem usar o que está na tela.
    await fetch("/api/monitor/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config()),
    }).catch(() => undefined);
    await acao(resumo ? "resumo" : "checar", "/api/monitor/rodar", { resumo }, (j) =>
      j.aviso ? String(j.aviso) : `Checagem concluída: ${j.novos} alerta(s) novo(s).`
    );
  }

  function alternar(c: Categoria) {
    setSelecionadas((atual) =>
      atual.some((x) => x.id === c.id) ? atual.filter((x) => x.id !== c.id) : [...atual, c]
    );
  }

  return (
    <>
      <div className="painel">
        <h3>O que monitorar</h3>
        <p className="aviso">
          O app checa as plataformas a cada {dados?.intervaloMin ?? 30} minutos enquanto estiver
          rodando. Em cada checagem ele avisa você das mudanças no ranking e envia aos grupos
          os produtos em alta que ainda não foram enviados. O resumo diário sai a partir das{" "}
          {dados?.horaResumo ?? 9}h.
        </p>

        <label>Categorias do Mercado Livre (clique para marcar)</label>
        <div className="etiquetas" style={{ margin: "6px 0 14px" }}>
          {categorias.length === 0 && (
            <span className="aviso">Conecte o Mercado Livre para listar as categorias.</span>
          )}
          {categorias.map((c) => {
            const ativa = selecionadas.some((x) => x.id === c.id);
            return (
              <button
                key={c.id}
                className={`etiqueta escolha ${ativa ? "ativa" : ""}`}
                aria-pressed={ativa}
                onClick={() => alternar(c)}
              >
                {c.nome}
              </button>
            );
          })}
        </div>

        <div className="campo">
          <label htmlFor="termos">
            Palavras-chave para Shopee e TikTok Shop (separadas por vírgula)
          </label>
          <input
            id="termos"
            value={termos}
            onChange={(e) => setTermos(e.target.value)}
            placeholder="ex.: fone bluetooth, garrafa térmica"
          />
        </div>

        <div className="linha" style={{ marginTop: 14 }}>
          <button className="acao" onClick={salvar} disabled={!!ocupado}>
            {ocupado === "salvar" ? "Salvando…" : "Salvar"}
          </button>
          <button className="leve" onClick={() => checar(false)} disabled={!!ocupado}>
            {ocupado === "checar" ? "Checando…" : "Checar agora"}
          </button>
          <button className="leve" onClick={() => checar(true)} disabled={!!ocupado}>
            {ocupado === "resumo" ? "Gerando…" : "Enviar resumo agora"}
          </button>
          <button
            className="leve"
            onClick={() => acao("grupos", "/api/grupos/teste", {}, (j) => String(j.mensagem))}
            disabled={!!ocupado || !(dados?.telegramGrupo || dados?.whatsapp)}
          >
            {ocupado === "grupos" ? "Enviando…" : "Testar grupos"}
          </button>
          {!dados?.telegram && (
            <button
              className="leve"
              onClick={() =>
                acao("conectar", "/api/telegram/conectar", {}, (j) => `Telegram conectado à conversa "${j.conversa}". Uma mensagem de confirmação foi enviada.`)
              }
              disabled={!!ocupado || !dados?.telegramToken}
              title={dados?.telegramToken ? "" : "Cole o token do bot na aba Conexões primeiro"}
            >
              {ocupado === "conectar" ? "Conectando…" : "Conectar Telegram"}
            </button>
          )}
          <button
            className="leve"
            onClick={() => acao("teste", "/api/telegram/teste", {}, () => "Mensagem de teste enviada ao Telegram.")}
            disabled={!!ocupado || !dados?.telegram}
          >
            {ocupado === "teste" ? "Enviando…" : "Testar Telegram"}
          </button>
        </div>

        {mensagem && (
          <p className="aviso" style={{ marginTop: 10 }} role="status">
            {mensagem}
          </p>
        )}

        <p className="aviso" style={{ marginTop: 12 }}>
          <span className={`ponto ${dados?.telegram ? "bom-bg" : ""}`} />
          Telegram {dados?.telegram ? "conectado" : "não conectado"} ·{" "}
          <span className={`ponto ${dados?.ia ? "bom-bg" : ""}`} />
          Leitura por IA {dados?.ia ? "ligada" : "desligada"} ·{" "}
          <span className={`ponto ${dados?.telegramGrupo ? "bom-bg" : ""}`} />
          Grupo do Telegram {dados?.telegramGrupo ? "conectado" : "não conectado"} ·{" "}
          <span className={`ponto ${dados?.whatsapp ? "bom-bg" : ""}`} />
          Grupo do WhatsApp {dados?.whatsapp ? "conectado" : "não conectado"} · Última checagem:{" "}
          {dados?.ultimaChecagem ? quando(dados.ultimaChecagem) : "nunca"}
        </p>
      </div>

      <h2>Alertas</h2>
      {dados && dados.alertas.length === 0 && (
        <p className="aviso">
          Nenhum alerta ainda. A primeira checagem só registra o ranking; os avisos aparecem a
          partir da segunda, quando algo mudar.
        </p>
      )}
      <div className="lista-alertas">
        {dados?.alertas.map((a) => (
          <div className={`alerta tipo-${a.tipo}`} key={a.id}>
            <div className="alerta-topo">
              <span className="etiqueta">{ROTULO[a.tipo]}</span>
              {a.plataforma && (
                <span className="etiqueta com-logo">
                  <Logo id={a.plataforma} tamanho={16} />
                  {NOMES[a.plataforma]}
                </span>
              )}
              <span className="aviso">{quando(a.quando)}</span>
            </div>
            <h3>
              {a.link ? (
                <a href={a.link} target="_blank" rel="noreferrer">
                  {a.titulo}
                </a>
              ) : (
                a.titulo
              )}
            </h3>
            <p className="detalhe">{a.detalhe}</p>
          </div>
        ))}
      </div>
    </>
  );
}
