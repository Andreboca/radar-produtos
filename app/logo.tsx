"use client";

import { useState } from "react";
import { NOMES, type IdPlataforma } from "@/lib/types";

/**
 * Selo 3D da plataforma. Dentro dele vai o logotipo oficial que você colocar
 * em public/logos (shopee.png, tiktok.png, meli.png); enquanto o arquivo não
 * existir, o selo mostra a inicial da plataforma.
 */
export default function Logo({ id, tamanho = 22 }: { id: IdPlataforma; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span
      className={`logo3d pl-${id} ${falhou ? "" : "com-imagem"}`}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.55) }}
      title={NOMES[id]}
    >
      {falhou ? (
        <span aria-hidden="true">{NOMES[id].charAt(0)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/logos/${id}.png`} alt={NOMES[id]} onError={() => setFalhou(true)} />
      )}
    </span>
  );
}
