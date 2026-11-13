"use client";

import { useCallback, useEffect, useState } from "react";
import Logo from "./logo";
import type { ResumoCfg } from "@/lib/config";
import type { IdPlataforma } from "@/lib/types";

type Campo = {
  k: keyof ResumoCfg;
  rotulo: string;
  segredo?: boolean;
  dica?: string;
};

type Secao = {
  id: string;
  titulo: string;
  texto: string;
  onde: string;
  campos: Campo[];
  /** Chaves que precisam estar preenchidas para a seção contar como conectada. */
  exige: (keyof ResumoCfg)[];
  aviso?: string;
};

const SECOES: Secao[] = [
  {
    id: "meli",
    titulo: "Mercado Livre",
    texto: "Ranking dos mais vendidos por categoria e buscas em tendência.",
    onde: "developers.mercadolivre.com.br → Meus aplicativos → criar aplicativo",
    campos: [
      { k: "MELI_CLIENT_ID", rotulo: "App ID" },
      { k: "MELI_CLIENT_SECRET", rotulo: "Secret Key", segredo: true },
    ],
    exige: ["MELI_CLIENT_ID", "MELI_CLIENT_SECRET"],
  },
  {
    id: "shopee",
    titulo: "Shopee",
    texto: "Produtos com preço, vendas, comissão e link de afiliado.",
    onde: "affiliate.shopee.com.br → painel de afiliado → Open API",
    campos: [
      { k: "SHOPEE_APP_ID", rotulo: "App ID" },
      { k: "SHOPEE_SECRET", rotulo: "Secret", segredo: true },
    ],
    exige: ["SHOPEE_APP_ID", "SHOPEE_SECRET"],
  },
  {
    id: "tiktok",
    titulo: "TikTok Shop",
    texto: "Produtos abertos para afiliados, com preço e comissão.",
    onde: "partner.tiktokshop.com → seu app → credenciais e autorização de criador",
    campos: [
      { k: "TIKTOK_APP_KEY", rotulo: "App Key" },
      { k: "TIKTOK_APP_SECRET", rotulo: "App Secret", segredo: true },
      { k: "TIKTOK_ACCESS_TOKEN", rotulo: "Access Token de criador", segredo: true },
    ],
    exige: ["TIKTOK_APP_KEY", "TIKTOK_APP_SECRET", "TIKTOK_ACCESS_TOKEN"],
    aviso: "Integração ainda não testada com credenciais reais.",
  },
];

const VAZIO: Record<string, string> = {};

export default function Conexoes({ onMudou }: { onMudou: () => void }) {
  const [resumo, setResumo] = useState<ResumoCfg | null>(null);
  const [digitado, setDigitado] = useState<Record<string, string>>(VAZIO);
  const [ocupado, setOcupado] = useState("");
  const [retorno, setRetorno] = useState<Record<string, { ok: boolean; mensagem: string }>>({});
  const [grupos, setGrupos] = useState<Record<string, { id: string; nome: string }[]>>({});

  const carregar = useCallback(async () => {
    const j = await (await fetch("/api/config")).json();
    setResumo(j.config);
  }, []);

  useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const post = async (rota: string, corpo: unknown) => {
    const resp = await fetch(rota, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.erro || "Falha na requisição.");
    return json;
  };

  const dizer = (id: string, ok: boolean, mensagem: string) =>
    setRetorno((r) => ({ ...r, [id]: { ok, mensagem } }));

  /** Salva só o que foi digitado nesta seção e testa a conexão. */
  async function salvarETestar(id: string, chaves: string[], testar = true) {
    setOcupado(id);
    try {
      const novos: Record<string, string> = {};
      for (const k of chaves) if (digitado[k] !== undefined) novos[k] = digitado[k];
      const j = await post("/api/config", novos);
      setResumo(j.config);
      setDigitado((d) => {
        const resto = { ...d };
        for (const k of chaves) delete resto[k];
        return resto;
      });
      if (testar) {
        const t = await post("/api/config/testar", { alvo: id });
        dizer(id, t.ok, t.mensagem);
      } else {
        dizer(id, true, "Salvo.");
      }
      onMudou();
    } catch (e) {
      dizer(id, false, e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado("");
    }
  }

  async function buscarGrupos(canal: "telegram" | "whatsapp") {
    const id = `${canal}-grupo`;
    setOcupado(id);
    try {
      const j = await post("/api/grupos/listar", { canal });
      setGrupos((g) => ({ ...g, [canal]: j.grupos }));
      dizer(
        id,
        j.grupos.length > 0,
        j.grupos.length
          ? `${j.grupos.length} grupo(s) encontrado(s). Escolha um.`
          : canal === "telegram"
          ? "Nenhum grupo encontrado. Adicione o bot ao grupo, envie uma mensagem lá e busque de novo."
          : "Nenhum grupo encontrado nesse número."
      );
    } catch (e) {
      dizer(id, false, e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado("");
    }
  }

  async function escolherGrupo(canal: "telegram" | "whatsapp", idGrupo: string) {
    const chave = canal === "telegram" ? "TELEGRAM_GRUPO_ID" : "WHATSAPP_GRUPO_ID";
    const id = `${canal}-grupo`;
    setOcupado(id);
    try {
      const j = await post("/api/config", { [chave]: idGrupo });
      setResumo(j.config);
      if (idGrupo) {
        const t = await post("/api/grupos/teste", {});
        dizer(id, true, `Grupo salvo. ${t.mensagem}`);
      } else {
        dizer(id, true, "Grupo removido.");
      }
      onMudou();
    } catch (e) {
      dizer(id, false, e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado("");
    }
  }

  async function conectarConversa() {
    setOcupado("telegram-voce");
    try {
      const j = await post("/api/telegram/conectar", {});
      await carregar();
      dizer("telegram-voce", true, `Conectado à conversa "${j.conversa}". Veja a mensagem no seu Telegram.`);
      onMudou();
    } catch (e) {
      dizer("telegram-voce", false, e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado("");
    }
  }

  const tem = (k: keyof ResumoCfg) => Boolean(resumo?.[k]?.definido);
  const valor = (k: keyof ResumoCfg) => resumo?.[k]?.valor || "";

  function campo(c: Campo) {
    const salvo = valor(c.k);
    return (
      <div className="campo" key={c.k}>
        <label htmlFor={c.k}>{c.rotulo}</label>
        <input
          id={c.k}
          type={c.segredo ? "password" : "text"}
          autoComplete="off"
          value={digitado[c.k] ?? (c.segredo ? "" : salvo)}
          placeholder={c.segredo && salvo ? `${salvo} (salvo)` : c.dica || ""}
          onChange={(e) => setDigitado((d) => ({ ...d, [c.k]: e.target.value }))}
        />
      </div>
    );
  }

  function resposta(id: string) {
    const r = retorno[id];
    if (!r) return null;
    return (
      <p className={`aviso ${r.ok ? "bom" : "ruim"}`} role="status" style={{ marginTop: 8 }}>
        {r.ok ? "✓ " : "✗ "}
        {r.mensagem}
      </p>
    );
  }

  function seletorGrupo(canal: "telegram" | "whatsapp", liberado: boolean) {
    const chave = canal === "telegram" ? "TELEGRAM_GRUPO_ID" : "WHATSAPP_GRUPO_ID";
    const id = `${canal}-grupo`;
    const lista = grupos[canal] || [];
    const atual = valor(chave);
    return (
      <div className="subbloco">
        <label>Grupo que recebe as ofertas</label>
        <div className="linha">
          <button className="leve" onClick={() => buscarGrupos(canal)} disabled={!liberado || !!ocupado}>
            {ocupado === id ? "Buscando…" : "Buscar meus grupos"}
          </button>
          {lista.length > 0 && (
            <select
              aria-label="Escolher grupo"
              value={lista.some((g) => g.id === atual) ? atual : ""}
              onChange={(e) => escolherGrupo(canal, e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            >
              <option value="">Escolha o grupo…</option>
              {lista.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="aviso" style={{ marginTop: 6 }}>
          {atual ? `Grupo conectado (id ${atual}).` : "Nenhum grupo escolhido."}
          {atual && (
            <>
              {" "}
              <button className="link" onClick={() => escolherGrupo(canal, "")}>
                Remover
              </button>
            </>
          )}
        </p>
        {resposta(id)}
      </div>
    );
  }

  const provedor = digitado.WHATSAPP_PROVEDOR ?? valor("WHATSAPP_PROVEDOR");
  const camposWhats: Campo[] =
    provedor === "evolution"
      ? [
          { k: "EVOLUTION_URL", rotulo: "Endereço do servidor", dica: "https://..." },
          { k: "EVOLUTION_INSTANCIA", rotulo: "Nome da instância" },
          { k: "EVOLUTION_API_KEY", rotulo: "API Key", segredo: true },
        ]
      : provedor === "zapi"
      ? [
          { k: "ZAPI_INSTANCIA", rotulo: "ID da instância" },
          { k: "ZAPI_TOKEN", rotulo: "Token da instância", segredo: true },
          { k: "ZAPI_CLIENT_TOKEN", rotulo: "Client-Token da conta", segredo: true },
        ]
      : [];
  const whatsPronto =
    provedor === "evolution"
      ? tem("EVOLUTION_URL") && tem("EVOLUTION_INSTANCIA") && tem("EVOLUTION_API_KEY")
      : provedor === "zapi"
      ? tem("ZAPI_INSTANCIA") && tem("ZAPI_TOKEN") && tem("ZAPI_CLIENT_TOKEN")
      : false;

  const AUTOMACAO: Campo[] = [
    { k: "MONITOR_INTERVALO_MIN", rotulo: "Checar a cada (minutos)", dica: "30" },
    { k: "MONITOR_HORA_RESUMO", rotulo: "Hora do resumo diário (0 a 23)", dica: "9" },
    { k: "DIVULGACAO_ITENS", rotulo: "Produtos por envio (1 a 10)", dica: "5" },
    { k: "DIVULGACAO_REPETIR_HORAS", rotulo: "Repetir produto só após (horas)", dica: "24" },
    { k: "PAINEL_ATUALIZAR_SEG", rotulo: "Atualizar vendas de afiliado a cada (segundos, mínimo 15)", dica: "60" },
  ];

  return (
    <>
      <p className="aviso" style={{ marginBottom: 14 }}>
        Cole as credenciais aqui e clique em Salvar e testar. Elas ficam guardadas só neste
        computador (arquivo data/config.json) e nunca voltam inteiras para a tela.
      </p>

      <div className="duas">
        {SECOES.map((s) => (
          <div className="painel" key={s.id}>
            <h3 className="com-logo">
              <Logo id={s.id as IdPlataforma} tamanho={26} />
              {s.titulo}
              <span className={`ponto ${s.exige.every(tem) ? "bom-bg" : ""}`} />
            </h3>
            <p>{s.texto}</p>
            <p className="aviso">Onde pegar: {s.onde}</p>
            {s.aviso && <p className="aviso">{s.aviso}</p>}
            <div className="pilha">{s.campos.map(campo)}</div>
            <button
              className="acao"
              style={{ marginTop: 12 }}
              disabled={!!ocupado}
              onClick={() => salvarETestar(s.id, s.campos.map((c) => c.k))}
            >
              {ocupado === s.id ? "Testando…" : "Salvar e testar"}
            </button>
            {resposta(s.id)}
          </div>
        ))}

        <div className="painel">
          <h3>
            <span className={`ponto ${tem("TELEGRAM_BOT_TOKEN") ? "bom-bg" : ""}`} />
            Telegram
          </h3>
          <p>Avisos para você e ofertas automáticas para o seu grupo.</p>
          <p className="aviso">
            Onde pegar: no Telegram, fale com @BotFather, envie /newbot e copie o token.
          </p>
          <div className="pilha">
            {campo({ k: "TELEGRAM_BOT_TOKEN", rotulo: "Token do bot", segredo: true })}
          </div>
          <button
            className="acao"
            style={{ marginTop: 12 }}
            disabled={!!ocupado}
            onClick={() => salvarETestar("telegram", ["TELEGRAM_BOT_TOKEN"])}
          >
            {ocupado === "telegram" ? "Testando…" : "Salvar e testar"}
          </button>
          {resposta("telegram")}

          <div className="subbloco">
            <label>Avisos para você</label>
            <div className="linha">
              <button
                className="leve"
                onClick={conectarConversa}
                disabled={!tem("TELEGRAM_BOT_TOKEN") || !!ocupado}
              >
                {ocupado === "telegram-voce" ? "Conectando…" : "Conectar minha conversa"}
              </button>
            </div>
            <p className="aviso" style={{ marginTop: 6 }}>
              {tem("TELEGRAM_CHAT_ID")
                ? "Conversa conectada."
                : 'Antes de clicar, abra o seu bot no Telegram e envie "oi".'}
            </p>
            {resposta("telegram-voce")}
          </div>

          {seletorGrupo("telegram", tem("TELEGRAM_BOT_TOKEN"))}
          <p className="aviso">
            Para o grupo aparecer: adicione o bot como administrador e envie uma mensagem no grupo.
          </p>
        </div>

        <div className="painel">
          <h3>
            <span className={`ponto ${whatsPronto ? "bom-bg" : ""}`} />
            WhatsApp
          </h3>
          <p>Ofertas automáticas para o seu grupo, por um conector ligado ao seu número.</p>
          <p className="aviso">
            Os conectores não são oficiais do WhatsApp e o número pode ser restringido. Use um
            chip separado do pessoal.
          </p>
          <div className="pilha">
            <div className="campo">
              <label htmlFor="WHATSAPP_PROVEDOR">Conector</label>
              <select
                id="WHATSAPP_PROVEDOR"
                value={provedor}
                onChange={(e) => setDigitado((d) => ({ ...d, WHATSAPP_PROVEDOR: e.target.value }))}
              >
                <option value="">Escolha…</option>
                <option value="zapi">Z-API (pago, já hospedado)</option>
                <option value="evolution">Evolution API (gratuito, você hospeda)</option>
              </select>
            </div>
            {camposWhats.map(campo)}
          </div>
          <button
            className="acao"
            style={{ marginTop: 12 }}
            disabled={!!ocupado || !provedor}
            onClick={() =>
              salvarETestar("whatsapp", ["WHATSAPP_PROVEDOR", ...camposWhats.map((c) => c.k)])
            }
          >
            {ocupado === "whatsapp" ? "Testando…" : "Salvar e testar"}
          </button>
          {resposta("whatsapp")}
          {seletorGrupo("whatsapp", whatsPronto)}
        </div>

        <div className="painel">
          <h3>
            <span className={`ponto ${tem("ANTHROPIC_API_KEY") ? "bom-bg" : ""}`} />
            Leitura por IA (opcional)
          </h3>
          <p>Comentário da IA no resumo diário, apontando as melhores oportunidades.</p>
          <p className="aviso">Onde pegar: console.anthropic.com → API Keys.</p>
          <div className="pilha">
            {campo({ k: "ANTHROPIC_API_KEY", rotulo: "Chave da API", segredo: true })}
          </div>
          <button
            className="acao"
            style={{ marginTop: 12 }}
            disabled={!!ocupado}
            onClick={() => salvarETestar("ia", ["ANTHROPIC_API_KEY"])}
          >
            {ocupado === "ia" ? "Testando…" : "Salvar e testar"}
          </button>
          {resposta("ia")}
        </div>

        <div className="painel">
          <h3>Automação</h3>
          <p>De quanto em quanto tempo checar e quanto enviar aos grupos.</p>
          <div className="pilha">{AUTOMACAO.map(campo)}</div>
          <button
            className="acao"
            style={{ marginTop: 12 }}
            disabled={!!ocupado}
            onClick={() => salvarETestar("automacao", AUTOMACAO.map((c) => c.k), false)}
          >
            {ocupado === "automacao" ? "Salvando…" : "Salvar"}
          </button>
          {resposta("automacao")}
        </div>
      </div>
    </>
  );
}
