import { NOMES, type IdPlataforma, type ResultadoPlataforma } from "./types";

/**
 * Roda a consulta de uma plataforma sem deixar o erro dela derrubar as outras.
 * Plataforma sem credencial devolve "configurada: false" em vez de erro.
 */
export async function consultar(
  plataforma: IdPlataforma,
  configurada: boolean,
  fn: () => Promise<Omit<ResultadoPlataforma, "plataforma" | "nome" | "configurada">>
): Promise<ResultadoPlataforma> {
  const base = { plataforma, nome: NOMES[plataforma], configurada };
  if (!configurada) return { ...base, produtos: [] };
  try {
    return { ...base, ...(await fn()) };
  } catch (e) {
    return {
      ...base,
      produtos: [],
      erro: e instanceof Error ? e.message : "Erro inesperado.",
    };
  }
}
