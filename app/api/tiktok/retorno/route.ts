import { NextResponse } from "next/server";
import { conectarConta } from "@/lib/tiktokContas";
import { perfil } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

function pagina(titulo: string, mensagem: string, ok: boolean): NextResponse {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#0b0d12; color:#e8eaf0;
         font:16px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .cartao { max-width:30rem; margin:1.5rem; padding:1.75rem; border-radius:14px;
            background:#141821; border:1px solid #232938; }
  .marca { font-size:.78rem; letter-spacing:.09em; text-transform:uppercase;
           color:#7b8396; margin:0 0 .9rem; }
  h1 { margin:0 0 .6rem; font-size:1.3rem; color:${ok ? "#4ade80" : "#f87171"}; }
  p { margin:0 0 1.2rem; color:#c3c9d6; }
  a { display:inline-block; padding:.6rem 1.1rem; border-radius:9px;
      background:#2563eb; color:#fff; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
  <div class="cartao">
    <p class="marca">Radar de Produtos</p>
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
    <a href="/">Voltar ao painel</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const erro = url.searchParams.get("error") || url.searchParams.get("error_description");

  if (erro) {
    return pagina("Autorização negada", escapar(erro), false);
  }
  if (!code) {
    return pagina(
      "Faltou o código",
      "O TikTok não enviou o código de autorização. Abra de novo o link de conectar conta no painel.",
      false
    );
  }

  try {
    const conta = await conectarConta(code);
    let nome = conta.nome;
    try {
      nome = (await perfil(conta.openId)).nome ?? nome;
    } catch {
      /* segue sem o nome */
    }
    return pagina(
      "Conta conectada",
      `A conta ${escapar(nome || conta.openId)} foi conectada ao Radar. Já dá para buscar produtos e gerar os seus links por ela.`,
      true
    );
  } catch (e) {
    return pagina(
      "Não deu para conectar",
      escapar(e instanceof Error ? e.message : "Erro ao trocar o código pelo token."),
      false
    );
  }
}
