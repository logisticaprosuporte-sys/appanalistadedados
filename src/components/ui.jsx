import { nomeEmpresa } from '../lib/db.js';

// Peças pequenas reaproveitadas pelas abas do painel.

export function Kpi({ rotulo, valor, detalhe, tom }) {
  return (
    <div className={`kpi ${tom ? `kpi-${tom}` : ''}`}>
      <span className="kpi-rotulo">{rotulo}</span>
      <span className="kpi-valor">{valor}</span>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  );
}

/** Frase grande no topo de cada aba, que resume o que importa. */
export function Manchete({ children }) {
  return <p className="manchete">{children}</p>;
}

/** Bloco recolhido: só abre se a pessoa quiser ver mais. */
export function Detalhes({ titulo = 'Ver detalhes', children }) {
  return (
    <details className="detalhes">
      <summary>{titulo}</summary>
      <div className="detalhes-corpo">{children}</div>
    </details>
  );
}

/** Situação de um % da meta: bom (≥100%), atenção (80–99%) ou ruim (<80%). */
export function tomMeta(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= 1 ? 'bom' : pct >= 0.8 ? 'atencao' : 'ruim';
}

export const ROTULO_TOM = { bom: 'Na meta', atencao: 'Perto da meta', ruim: 'Abaixo da meta' };

export const pct = (v, casas = 0) =>
  v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;

/** Lista de barras horizontais simples: [{ nome, valor (0..n), texto, tom }] com linha de referência opcional. */
export function BarrasHorizontais({ itens, maximo, referencia, rotuloReferencia }) {
  const max = maximo || Math.max(...itens.map((i) => i.valor), referencia || 0, 0.0001);
  return (
    <ul className="barras-h">
      {itens.map((i) => (
        <li key={i.nome} title={i.titulo || ''}>
          <span className="bh-nome">{i.rotulo || i.nome}</span>
          <span className="bh-trilho">
            <span className={`bh-barra ${i.tom ? `tom-${i.tom}` : ''}`} style={{ width: `${Math.min(i.valor / max, 1) * 100}%` }} />
            {referencia ? (
              <span className="bh-ref" style={{ left: `${(referencia / max) * 100}%` }} title={rotuloReferencia} />
            ) : null}
          </span>
          <span className="bh-valor">{i.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Assinatura discreta no rodapé das folhas impressas e do site. */
export const TEXTO_RODAPE = 'App analista de dados · criado por João';
export const RodapeFolha = () => <div className="rodape-folha">{nomeEmpresa()} · {TEXTO_RODAPE}</div>;
