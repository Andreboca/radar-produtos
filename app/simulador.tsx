"use client";

import { useState } from "react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Quanto dá para ganhar de comissão divulgando um produto. */
export default function Simulador() {
  const [preco, setPreco] = useState(60);
  const [pct, setPct] = useState(10);
  const [porDia, setPorDia] = useState(5);
  const ganhoDia = (preco * pct * porDia) / 100;

  return (
    <div className="painel">
      <h3>Simulador de ganhos como afiliado</h3>
      <p className="aviso">Quanto dá para ganhar divulgando um produto.</p>
      <div className="linha" style={{ marginTop: 10 }}>
        <div className="campo">
          <label htmlFor="s-preco">Preço do produto (R$)</label>
          <input id="s-preco" type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(Number(e.target.value) || 0)} />
        </div>
        <div className="campo">
          <label htmlFor="s-pct">Comissão (%)</label>
          <input id="s-pct" type="number" min="0" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} />
        </div>
        <div className="campo">
          <label htmlFor="s-dia">Vendas por dia</label>
          <input id="s-dia" type="number" min="0" step="1" value={porDia} onChange={(e) => setPorDia(Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="numeros" style={{ marginTop: 14, marginBottom: 0 }}>
        <div className="numero">
          <strong>{brl((preco * pct) / 100)}</strong>
          <span>Por venda</span>
        </div>
        <div className="numero">
          <strong>{brl(ganhoDia)}</strong>
          <span>Por dia</span>
        </div>
        <div className="numero">
          <strong>{brl(ganhoDia * 30)}</strong>
          <span>Por mês (30 dias)</span>
        </div>
      </div>
      <p className="aviso" style={{ marginTop: 10 }}>
        Conta simples, sem descontar cancelamentos nem devoluções.
      </p>
    </div>
  );
}
