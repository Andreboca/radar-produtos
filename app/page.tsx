"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Alertas from "./alertas";
import Conexoes from "./conexoes";
import JanelaMetricas from "./metricas";
import Logo from "./logo";
import Painel from "./painel";
import Simulador from "./simulador";
import TopVendendo from "./top";
import GeracaoVideo from "./video";
import CriacaoImagem from "./imagem";
import { PLATAFORMAS_PADRAO, calcular, type Plataforma } from "@/lib/fees";
import {
  NOMES,
  type Categoria,
  type IdPlataforma,
  type Produto,
  type ResultadoPlataforma,
} from "@/lib/types";

type Aba = "painel" | "vendidos" | "comparar" | "alertas" | "lucro" | "conexoes" | "imagem" | "video";
type Status = Record<IdPlataforma, boolean>;
type Filtro = "todas" | IdPlataforma;

/** Ícones de traço simples (desenhados para este app). */
const ICONES: Record<Aba, ReactNode> = {
  painel: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />,
  vendidos: <path d="M3 17l5-5 4 4 8-9M15 7h5v5" />,
  comparar: <path d="M4 6h7M4 12h7M4 18h7M15 5v14M19 9v10" />,
  alertas: <path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20h4" />,
  lucro: <path d="M6 3h12v18H6zM9 7h6M9 12h1M14 12h1M9 16h1M14 16h1" />,
  conexoes: <path d="M9 7V3M15 7V3M7 7h10v5a5 5 0 01-10 0zM12 17v4" />,
  imagem: <path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9h.01" />,
  video: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" />,
};

const MENU: { id: Aba; grupo: string; rotulo: string; titulo: string; texto: string }[] = [
  {
    id: "painel",
    grupo: "Visão geral",
    rotulo: "Painel de afiliado",
    titulo: "Painel de afiliado",
    texto: "Só o seu faturamento como afiliado: quanto vendeu e quanto ganhou de comissão, atualizado sozinho.",
  },
  {
    id: "vendidos",
    grupo: "Produtos",
    rotulo: "Produtos em alta",
    titulo: "Produtos em alta",
    texto: "O que está vendendo agora no Mercado Livre, Shopee e TikTok Shop, direto das APIs oficiais.",
  },
  {
    id: "comparar",
    grupo: "Produtos",
    rotulo: "Comparar produto",
    titulo: "Comparar produto",
    texto: "A mesma busca nas três plataformas, com preço, vendas e comissão lado a lado.",
  },
  {
    id: "alertas",
    grupo: "Automação",
    rotulo: "Alertas",
    titulo: "Alertas e envios",
    texto: "O monitor avisa quando algo muda no ranking e envia as ofertas aos seus grupos.",
  },
  {
    id: "lucro",
    grupo: "Produtos",
    rotulo: "Calculadora de lucro",
    titulo: "Calculadora de lucro",
    texto: "Lucro, margem e retorno por venda em cada plataforma, com as taxas editáveis.",
  },
  {
    id: "imagem",
    grupo: "Criação",
    rotulo: "Criação de imagem",
    titulo: "Criação de imagem",
    texto: "Crie imagens de produto e de cenário para usar nos seus anúncios.",
  },
  {
    id: "video",
    grupo: "Criação",
    rotulo: "Criação de vídeo",
    titulo: "Criação de vídeo",
    texto: "",
  },
  {
    id: "conexoes",
    grupo: "Automação",
    rotulo: "Conexões",
    titulo: "Conexões",
    texto: "Cole as credenciais, teste a conexão e escolha os grupos que recebem as ofertas.",
  },
];

const GRUPOS = ["Visão geral", "Produtos", "Criação", "Automação"];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const corLucro = (n: number) => (n > 0 ? "bom" : "ruim");

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function Icone({ id }: { id: Aba }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONES[id]}
    </svg>
  );
}

function CartaoProduto({
  p,
  onMetricas,
  onComparar,
  onCalcular,
}: {
  p: Produto;
  onMetricas: (p: Produto) => void;
  onComparar?: (nome: string) => void;
  onCalcular: (p: Produto) => void;
}) {
  const sinais = [
    p.vendas !== null ? `${inteiro(p.vendas)} vendas` : p.posicao !== null ? `#${p.posicao} mais vendido` : "",
    p.avaliacao !== null ? `★ ${p.avaliacao.toFixed(1)}` : "",
    p.comissaoPct !== null ? `${p.comissaoPct.toFixed(1)}% comissão` : "",
  ].filter(Boolean);

  return (
    <article className="produto">
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
        {p.posicao !== null && <span className="selo posicao">#{p.posicao}</span>}
      </div>
      <div className="produto-corpo">
        <h3>{p.nome}</h3>
        {p.loja && <p className="aviso">{p.loja}</p>}
        <p className="preco">{p.preco !== null ? brl(p.preco) : "Preço não informado"}</p>
        <p className="aviso">{sinais.length ? sinais.join(" · ") : "Sem dados de venda informados"}</p>
        <div className="produto-acoes">
          {p.link ? (
            <a className="leve cheio" href={p.link} target="_blank" rel="noreferrer">
              Ver produto
            </a>
          ) : (
            <span className="leve cheio inativo">Sem link</span>
          )}
          <button className="acao cheio" onClick={() => onMetricas(p)}>
            Analisar métricas
          </button>
          <div className="mini">
            {onComparar && (
              <button className="link" onClick={() => onComparar(p.nome)}>
                Comparar
              </button>
            )}
            {p.preco !== null && (
              <button className="link" onClick={() => onCalcular(p)}>
                Calcular lucro
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Avisos de plataforma (sem credencial, erro ou observação da API). */
function Avisos({ resultados, onConfigurar }: { resultados: ResultadoPlataforma[]; onConfigurar: () => void }) {
  const linhas = resultados.filter((r) => !r.configurada || r.erro || r.aviso);
  if (!linhas.length) return null;
  return (
    <div className="avisos">
      {linhas.map((r) => (
        <p key={r.plataforma} className={r.erro ? "ruim" : ""}>
          <strong className="com-logo">
            <Logo id={r.plataforma} tamanho={16} />
            {r.nome}:
          </strong>{" "}
          {!r.configurada ? (
            <>
              não conectada.{" "}
              <button className="link" onClick={onConfigurar}>
                Conectar
              </button>
            </>
          ) : (
            r.erro || r.aviso
          )}
        </p>
      ))}
    </div>
  );
}

export default function Pagina() {
  const [aba, setAba] = useState<Aba>("painel");
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emAnalise, setEmAnalise] = useState<Produto | null>(null);

  // Produtos em alta
  const [categoriaMeli, setCategoriaMeli] = useState("");
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [vendidos, setVendidos] = useState<ResultadoPlataforma[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [atualizado, setAtualizado] = useState<Date | null>(null);

  // Comparar
  const [alvo, setAlvo] = useState("");
  const [comparando, setComparando] = useState(false);
  const [comparacao, setComparacao] = useState<ResultadoPlataforma[]>([]);

  // Calculadora
  const [plataformas, setPlataformas] = useState<Plataforma[]>(PLATAFORMAS_PADRAO);
  const [custo, setCusto] = useState(20);
  const [preco, setPreco] = useState(59.9);
  const [envio, setEnvio] = useState(3);
  const [impostoPct, setImpostoPct] = useState(6);
  const [afiliadoPct, setAfiliadoPct] = useState(0);

  const carregarStatus = useCallback(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ meli: false, shopee: false, tiktok: false }));
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((j) => setCategorias(j.categorias || []))
      .catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  async function chamar(rota: string, corpo: unknown): Promise<ResultadoPlataforma[]> {
    const resp = await fetch(rota, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.erro || "Falha na requisição.");
    return json.resultados as ResultadoPlataforma[];
  }

  async function buscarVendidos() {
    setErro("");
    setBuscando(true);
    try {
      setVendidos(await chamar("/api/mais-vendidos", { categoriaMeli, termo }));
      setAtualizado(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBuscando(false);
    }
  }

  async function comparar(nome?: string) {
    const t = (nome ?? alvo).trim();
    if (!t) return;
    setErro("");
    setAlvo(t);
    setAba("comparar");
    setComparando(true);
    setComparacao([]);
    try {
      setComparacao(await chamar("/api/comparar", { termo: t }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setComparando(false);
    }
  }

  function calcularLucro(p: Produto) {
    if (p.preco !== null) setPreco(p.preco);
    setAfiliadoPct(p.comissaoPct !== null ? Number(p.comissaoPct.toFixed(1)) : 0);
    setAba("lucro");
  }

  function editarPlataforma(id: string, campo: "comissaoPct" | "taxaFixa", valor: number) {
    setPlataformas((lista) => lista.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const secao = MENU.find((m) => m.id === aba) || MENU[0];
  const conectadas = status ? (Object.values(status) as boolean[]).filter(Boolean).length : 0;
  const nenhumaConectada = status !== null && conectadas === 0;

  const todos = useMemo(() => vendidos.flatMap((r) => r.produtos), [vendidos]);
  const visiveis = filtro === "todas" ? todos : todos.filter((p) => p.plataforma === filtro);
  const tendencias = vendidos.flatMap((r) => r.tendencias || []);

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span className="logo" aria-hidden="true">
            R
          </span>
          <span className="marca-nome">
            Radar
            <small>de Produtos</small>
          </span>
        </div>
        <nav aria-label="Menu principal">
          {GRUPOS.map((grupo) => (
            <div className="grupo" key={grupo}>
              <span className="grupo-nome">{grupo}</span>
              {MENU.filter((m) => m.grupo === grupo).map((m) => (
                <button
                  key={m.id}
                  className={`item ${aba === m.id ? "ativo" : ""}`}
                  aria-current={aba === m.id ? "page" : undefined}
                  title={m.rotulo}
                  aria-label={m.rotulo}
                  onClick={() => setAba(m.id)}
                >
                  <Icone id={m.id} />
                  <span>{m.rotulo}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <p className="rodape">
          {status === null
            ? "Verificando conexões…"
            : `${conectadas} de 3 plataformas conectadas`}
        </p>
      </aside>

      <main>
        <header className="faixa">
          <span className="sobretitulo">Radar de Produtos</span>
          <h1>{secao.titulo}</h1>
          {secao.texto && <p>{secao.texto}</p>}
        </header>

        {erro && <div className="erro">{erro}</div>}

        {nenhumaConectada && (aba === "vendidos" || aba === "comparar") && (
          <div className="painel">
            <h3>Nenhuma plataforma conectada ainda</h3>
            <p className="aviso">
              Para trazer dados reais, cole as credenciais de pelo menos uma plataforma na aba
              Conexões.
            </p>
            <button className="acao" onClick={() => setAba("conexoes")}>
              Abrir Conexões
            </button>
          </div>
        )}

        {aba === "painel" && (
          <Painel onConfigurar={() => setAba("conexoes")} />
        )}

        {aba === "vendidos" && (
          <>
            <TopVendendo onMetricas={setEmAnalise} onAbrirAlertas={() => setAba("alertas")} />

            <div className="numeros">
              <div className="numero">
                <strong>{todos.length}</strong>
                <span>Produtos encontrados</span>
              </div>
              <div className="numero">
                <strong>{conectadas}</strong>
                <span>Plataformas conectadas</span>
              </div>
              <div className="numero">
                <strong>
                  {atualizado
                    ? atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </strong>
                <span>Última atualização</span>
              </div>
            </div>

            <div className="painel">
              <div className="linha">
                <div className="campo">
                  <label htmlFor="termo">Palavra-chave (Shopee e TikTok Shop)</label>
                  <input
                    id="termo"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarVendidos()}
                    placeholder="ex.: fone bluetooth"
                  />
                </div>
                <div className="campo">
                  <label htmlFor="categoria">Categoria (Mercado Livre)</label>
                  <select
                    id="categoria"
                    value={categoriaMeli}
                    onChange={(e) => setCategoriaMeli(e.target.value)}
                  >
                    <option value="">Sem categoria (só tendências)</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="acao" onClick={buscarVendidos} disabled={buscando}>
                  {buscando ? "Consultando…" : "Buscar"}
                </button>
              </div>

              {todos.length > 0 && (
                <div className="pilulas" role="group" aria-label="Filtrar por plataforma">
                  {(["todas", "meli", "shopee", "tiktok"] as Filtro[]).map((f) => {
                    const total =
                      f === "todas" ? todos.length : todos.filter((p) => p.plataforma === f).length;
                    return (
                      <button
                        key={f}
                        className={`pilula com-logo ${filtro === f ? "ativa" : ""}`}
                        aria-pressed={filtro === f}
                        onClick={() => setFiltro(f)}
                      >
                        {f !== "todas" && <Logo id={f} tamanho={16} />}
                        {f === "todas" ? "Todas" : NOMES[f]} · {total}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Avisos resultados={vendidos} onConfigurar={() => setAba("conexoes")} />

            {tendencias.length > 0 && (
              <div className="painel">
                <h3>Buscas em tendência na semana (Mercado Livre)</h3>
                <div className="etiquetas">
                  {tendencias.map((t, i) => (
                    <a
                      className="etiqueta"
                      key={`${t.termo}-${i}`}
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.termo}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {vendidos.length === 0 && !nenhumaConectada && (
              <p className="aviso">Clique em Buscar para carregar os produtos em alta.</p>
            )}

            <div className="grade">
              {visiveis.map((p) => (
                <CartaoProduto
                  key={`${p.plataforma}-${p.id}`}
                  p={p}
                  onMetricas={setEmAnalise}
                  onComparar={comparar}
                  onCalcular={calcularLucro}
                />
              ))}
            </div>
          </>
        )}

        {aba === "comparar" && (
          <>
            <div className="painel">
              <div className="linha">
                <div className="campo" style={{ flex: 3 }}>
                  <label htmlFor="alvo">Nome do produto</label>
                  <input
                    id="alvo"
                    value={alvo}
                    onChange={(e) => setAlvo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && comparar()}
                    placeholder="ex.: mini processador de alimentos"
                  />
                </div>
                <button className="acao" onClick={() => comparar()} disabled={comparando}>
                  {comparando ? "Consultando…" : "Comparar"}
                </button>
              </div>
            </div>

            <Avisos resultados={comparacao} onConfigurar={() => setAba("conexoes")} />

            {comparacao.length > 0 && (
              <div className="painel tabela-rolagem">
                <h3>Resumo por plataforma</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Plataforma</th>
                      <th className="num">Anúncios</th>
                      <th className="num">Menor preço</th>
                      <th className="num">Preço mediano</th>
                      <th className="num">Vendas somadas</th>
                      <th className="num">Comissão média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacao.map((r) => {
                      const precos = r.produtos.flatMap((p) => (p.preco !== null ? [p.preco] : []));
                      const vendas = r.produtos.flatMap((p) => (p.vendas !== null ? [p.vendas] : []));
                      const com = r.produtos.flatMap((p) =>
                        p.comissaoPct !== null ? [p.comissaoPct] : []
                      );
                      const med = mediana(precos);
                      return (
                        <tr key={r.plataforma}>
                          <td>
                            <span className="com-logo">
                              <Logo id={r.plataforma} />
                              {r.nome}
                            </span>
                          </td>
                          <td className="num">{r.produtos.length || "—"}</td>
                          <td className="num">{precos.length ? brl(Math.min(...precos)) : "—"}</td>
                          <td className="num">{med !== null ? brl(med) : "—"}</td>
                          <td className="num">
                            {vendas.length ? inteiro(vendas.reduce((a, b) => a + b, 0)) : "—"}
                          </td>
                          <td className="num">
                            {com.length
                              ? `${(com.reduce((a, b) => a + b, 0) / com.length).toFixed(1)}%`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="aviso" style={{ marginTop: 10 }}>
                  Traço (—) significa que a API daquela plataforma não informa o dado.
                </p>
              </div>
            )}

            <div className="grade">
              {comparacao
                .flatMap((r) => r.produtos)
                .map((p) => (
                  <CartaoProduto
                    key={`${p.plataforma}-${p.id}`}
                    p={p}
                    onMetricas={setEmAnalise}
                    onCalcular={calcularLucro}
                  />
                ))}
            </div>
          </>
        )}

        {aba === "alertas" && <Alertas categorias={categorias} />}

        {aba === "lucro" && (
          <>
            <div className="painel">
              <div className="linha">
                {(
                  [
                    ["custo", "Custo do produto (R$)", custo, setCusto],
                    ["preco", "Preço de venda (R$)", preco, setPreco],
                    ["envio", "Embalagem + envio (R$)", envio, setEnvio],
                    ["imposto", "Imposto (%)", impostoPct, setImpostoPct],
                    ["afiliado", "Comissão de afiliado (%)", afiliadoPct, setAfiliadoPct],
                  ] as [string, string, number, (n: number) => void][]
                ).map(([id, rotulo, valor, definir]) => (
                  <div className="campo" key={id}>
                    <label htmlFor={id}>{rotulo}</label>
                    <input
                      id={id}
                      type="number"
                      step="0.01"
                      min="0"
                      value={valor}
                      onChange={(e) => definir(num(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="painel tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th className="num">Comissão %</th>
                    <th className="num">Taxa fixa R$</th>
                    <th className="num">Taxas</th>
                    <th className="num">Lucro por venda</th>
                    <th className="num">Margem</th>
                    <th className="num">Retorno</th>
                  </tr>
                </thead>
                <tbody>
                  {plataformas.map((p) => {
                    const r = calcular(p, { custo, preco, envio, impostoPct, afiliadoPct });
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="com-logo">
                            <Logo id={p.id as IdPlataforma} />
                            {p.nome}
                          </span>
                          <div className="aviso">{p.obs}</div>
                        </td>
                        <td className="num">
                          <input
                            aria-label={`Comissão ${p.nome}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={p.comissaoPct}
                            onChange={(e) =>
                              editarPlataforma(p.id, "comissaoPct", num(e.target.value))
                            }
                          />
                        </td>
                        <td className="num">
                          <input
                            aria-label={`Taxa fixa ${p.nome}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={p.taxaFixa}
                            onChange={(e) => editarPlataforma(p.id, "taxaFixa", num(e.target.value))}
                          />
                        </td>
                        <td className="num">{brl(r.taxas)}</td>
                        <td className={`num forte ${corLucro(r.lucro)}`}>{brl(r.lucro)}</td>
                        <td className="num">{r.margemPct.toFixed(1)}%</td>
                        <td className="num">{r.roiPct.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="aviso" style={{ marginTop: 12 }}>
                As taxas são valores de partida aproximados e mudam com frequência. Confira na
                central do vendedor de cada plataforma e ajuste os campos acima.
              </p>
            </div>

            <Simulador />
          </>
        )}

        {aba === "imagem" && <CriacaoImagem />}
        {aba === "video" && <GeracaoVideo />}
        {aba === "conexoes" && <Conexoes onMudou={carregarStatus} />}
      </main>

      {emAnalise && <JanelaMetricas produto={emAnalise} onFechar={() => setEmAnalise(null)} />}
    </div>
  );
}
