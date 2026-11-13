/**
 * Agendador: enquanto o app estiver rodando (npm run dev ou npm start), checa
 * as plataformas no intervalo configurado e envia os avisos.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __radarAgendador?: boolean };
  if (g.__radarAgendador) return;
  g.__radarAgendador = true;

  const { rodarSeForHora } = await import("./lib/monitor");
  const { vigiarVendas, intervaloSeg } = await import("./lib/vendas");
  setInterval(() => {
    rodarSeForHora().catch((e) => console.error("[radar] falha no monitor:", e));
  }, 60_000);

  // Vendas de afiliado: confere no intervalo configurado e avisa as novas.
  const conferir = () => {
    vigiarVendas()
      .catch((e) => console.error("[radar] falha ao conferir vendas:", e))
      .finally(() => setTimeout(conferir, intervaloSeg() * 1000));
  };
  setTimeout(conferir, 10_000);
  console.log("[radar] monitor de produtos ativo");
}
