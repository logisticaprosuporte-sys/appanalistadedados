// Etapas do recebimento, na ordem em que a mercadoria passa por elas.
export const ETAPAS = [
  { id: 'recebido', nome: 'Recebido', dica: 'Chegou, falta conferir' },
  { id: 'quarentena', nome: 'Quarentena', dica: 'Aguardando liberação da qualidade' },
  { id: 'etiquetas', nome: 'Tirar O.P. / Etiquetas', dica: 'Preparar para a linha' },
  { id: 'em_linha', nome: 'Em linha de produção', dica: 'Sendo fracionado' },
  { id: 'concluido', nome: 'Concluído', dica: 'Finalizado' },
];

export const nomeEtapa = (id) => ETAPAS.find((e) => e.id === id)?.nome || id;

export function proximaEtapa(id) {
  const i = ETAPAS.findIndex((e) => e.id === id);
  return ETAPAS[i + 1]?.id || null;
}

export function etapaAnterior(id) {
  const i = ETAPAS.findIndex((e) => e.id === id);
  return i > 0 ? ETAPAS[i - 1].id : null;
}

/** Lista de { situacao, em } — aceita texto JSON (vindo do banco antigo) ou array. */
export function historicoDe(r) {
  const h = r.historico;
  if (Array.isArray(h)) return h;
  try {
    return JSON.parse(h || '[]');
  } catch {
    return [];
  }
}

/** Data/hora em que entrou na etapa atual. */
export function desdeQuando(r) {
  const h = historicoDe(r);
  const ultimo = [...h].reverse().find((x) => x.situacao === r.situacao);
  return ultimo ? new Date(ultimo.em) : r.criado_em ? new Date(r.criado_em) : null;
}

/** Minutos que o item passou em cada etapa (para o painel). */
export function tempoPorEtapa(r, agora = new Date()) {
  const h = historicoDe(r);
  const out = {};
  for (let i = 0; i < h.length; i++) {
    const ini = new Date(h[i].em);
    const fim = h[i + 1] ? new Date(h[i + 1].em) : r.situacao === 'concluido' ? ini : agora;
    out[h[i].situacao] = (out[h[i].situacao] || 0) + Math.max(0, (fim - ini) / 60000);
  }
  return out;
}

export function haQuantoTempo(data, agora = new Date()) {
  if (!data) return '';
  const min = Math.max(0, Math.round((agora - data) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Acha o produto pelo código interno ou pelo código do fornecedor (cód. fábrica). */
export function acharProduto(produtosMap, produtosLista, termo) {
  const t = String(termo || '').trim().toUpperCase();
  if (!t) return null;
  const n = Number(t);
  if (Number.isFinite(n) && produtosMap.has(n)) return { produto: produtosMap.get(n), por: 'interno' };
  const porFornecedor = produtosLista.find((p) => p.cod_fabrica && String(p.cod_fabrica).toUpperCase() === t);
  return porFornecedor ? { produto: porFornecedor, por: 'fornecedor' } : null;
}

/** O.P. certa para a linha de destino do produto. */
export function paginaOP(linha) {
  const l = String(linha || '').toUpperCase();
  if (l === 'MANUAL') return 'op-manual';
  if (l === 'EMPACOTADEIRA' || l === 'ENFARDADEIRA' || ['JOANA', 'JOAQUINA', 'JULIA'].includes(l)) return 'op-maquinas';
  return null;
}
