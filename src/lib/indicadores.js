// Cálculos dos indicadores do painel (meta/hora, colaboradoras, setup das máquinas).
import { duracaoMin } from './util.js';

// Troca de produto: intervalo entre o fim de um produto e o início do próximo na mesma máquina.
// Intervalos maiores que isso (ou que passam pelo almoço) são pausa, não setup.
export const TROCA_MAX_MIN = 60;
export const HORA_ALMOCO = '12:30';

const emMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const metaDe = (produtos, codigo) => Number(produtos.get(Number(codigo))?.meta_hora) || 0;

/** Peças/hora de cada produto em todo o histórico (base para o "índice justo"). */
export function ritmoPorProduto(apontamentos) {
  const m = new Map();
  for (const a of apontamentos) {
    const d = duracaoMin(a.inicio, a.fim);
    if (!d) continue;
    const g = m.get(a.codigo) || { pecas: 0, min: 0, n: 0, ritmos: [] };
    g.pecas += a.realizado || 0;
    g.min += d;
    g.n += 1;
    g.ritmos.push(((a.realizado || 0) / d) * 60);
    m.set(a.codigo, g);
  }
  const out = new Map();
  for (const [codigo, g] of m) {
    const r = [...g.ritmos].sort((x, y) => x - y);
    out.set(codigo, { porHora: (g.pecas / g.min) * 60, n: g.n, mediana: r[Math.floor(r.length / 2)] });
  }
  return out;
}

// ---------------- Meta/hora ----------------
export function resumoMeta(lista, produtos) {
  let realizado = 0;
  let esperado = 0;
  let minComMeta = 0;
  let minTotal = 0;
  const semMeta = new Map();
  for (const a of lista) {
    const d = duracaoMin(a.inicio, a.fim);
    if (!d) continue;
    minTotal += d;
    const meta = metaDe(produtos, a.codigo);
    if (meta) {
      realizado += a.realizado || 0;
      esperado += (meta * d) / 60;
      minComMeta += d;
    } else {
      const g = semMeta.get(a.codigo) || { codigo: a.codigo, descricao: a.descricao, familia: a.familia, n: 0, pecas: 0, min: 0 };
      g.n += 1;
      g.pecas += a.realizado || 0;
      g.min += d;
      semMeta.set(a.codigo, g);
    }
  }
  return {
    pct: esperado ? realizado / esperado : null,
    diferenca: realizado - esperado,
    realizado,
    esperado,
    pctHorasComMeta: minTotal ? minComMeta / minTotal : null,
    semMeta: [...semMeta.values()].sort((a, b) => b.min - a.min),
  };
}

/** % da meta agrupado por uma chave (dia, máquina, família, produto…). */
export function metaPor(lista, produtos, chave) {
  const m = new Map();
  for (const a of lista) {
    const d = duracaoMin(a.inicio, a.fim);
    const meta = metaDe(produtos, a.codigo);
    if (!d || !meta) continue;
    const k = typeof chave === 'function' ? chave(a) : a[chave];
    const g = m.get(k) || { nome: k, realizado: 0, esperado: 0, min: 0, n: 0, meta, descricao: a.descricao };
    g.realizado += a.realizado || 0;
    g.esperado += (meta * d) / 60;
    g.min += d;
    g.n += 1;
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, pct: g.realizado / g.esperado, porHora: (g.realizado / g.min) * 60 }));
}

// ---------------- Colaboradoras ----------------
// Comparação "vs colegas": o ritmo de uma pessoa num produto é comparado com o das OUTRAS pessoas
// fazendo o MESMO produto (todo o histórico). Produto que só ela fez não entra na comparação.
export const MIN_APONT_CONFIAVEL = 3;

/** Peças e minutos por produto e por pessoa, em todo o histórico. */
export function ritmoDetalhado(apontamentos) {
  const m = new Map();
  for (const a of apontamentos) {
    const d = duracaoMin(a.inicio, a.fim);
    if (!d) continue;
    const g = m.get(a.codigo) || { pecas: 0, min: 0, n: 0, pessoas: new Map() };
    g.pecas += a.realizado || 0;
    g.min += d;
    g.n += 1;
    const p = g.pessoas.get(a.pessoa) || { pecas: 0, min: 0, n: 0 };
    p.pecas += a.realizado || 0;
    p.min += d;
    p.n += 1;
    g.pessoas.set(a.pessoa, p);
    m.set(a.codigo, g);
  }
  return m;
}

/** Ritmo das colegas (todas menos a pessoa) num produto; null se ninguém mais fez. */
export function ritmoColegas(det, codigo, pessoa) {
  const g = det.get(codigo);
  if (!g) return null;
  const p = g.pessoas.get(pessoa) || { pecas: 0, min: 0, n: 0 };
  const n = g.n - p.n;
  const min = g.min - p.min;
  if (n <= 0 || min <= 0) return null;
  return { porHora: ((g.pecas - p.pecas) / min) * 60, n, pessoas: g.pessoas.size - (g.pessoas.has(pessoa) ? 1 : 0) };
}

export function porColaboradora(lista, produtos, det, jornadaMin) {
  const m = new Map();
  for (const a of lista) {
    const d = duracaoMin(a.inicio, a.fim);
    if (!d) continue;
    const g =
      m.get(a.pessoa) ||
      { nome: a.pessoa, n: 0, min: 0, pecas: 0, esperadoMeta: 0, realizadoMeta: 0, esperadoColegas: 0, pecasComparadas: 0, minComparado: 0, produtos: new Set(), dias: new Map() };
    g.n += 1;
    g.min += d;
    g.pecas += a.realizado || 0;
    g.produtos.add(a.codigo);
    g.dias.set(a.data, (g.dias.get(a.data) || 0) + d);
    const meta = metaDe(produtos, a.codigo);
    if (meta) {
      g.esperadoMeta += (meta * d) / 60;
      g.realizadoMeta += a.realizado || 0;
    }
    const col = ritmoColegas(det, a.codigo, a.pessoa);
    if (col && col.n >= MIN_APONT_CONFIAVEL) {
      g.esperadoColegas += (col.porHora * d) / 60;
      g.pecasComparadas += a.realizado || 0;
      g.minComparado += d;
    }
    m.set(a.pessoa, g);
  }
  return [...m.values()]
    .map((g) => {
      const minDia = [...g.dias.values()];
      return {
        nome: g.nome,
        n: g.n,
        min: g.min,
        pecas: g.pecas,
        tempoMedio: g.min / g.n,
        minPorMil: g.pecas ? (g.min / g.pecas) * 1000 : null,
        porHora: (g.pecas / g.min) * 60,
        pctMeta: g.esperadoMeta ? g.realizadoMeta / g.esperadoMeta : null,
        // 1,12 = 12% acima das colegas nos mesmos produtos
        vsColegas: g.esperadoColegas ? g.pecasComparadas / g.esperadoColegas : null,
        // quanto do tempo dela deu para comparar com alguém
        comparado: g.min ? g.minComparado / g.min : 0,
        produtos: g.produtos.size,
        dias: minDia.length,
        horasDia: minDia.reduce((s, x) => s + x, 0) / minDia.length / 60,
        aproveitamento: jornadaMin ? minDia.reduce((s, x) => s + Math.min(x / jornadaMin, 1), 0) / minDia.length : null,
      };
    })
    .sort((a, b) => b.pecas - a.pecas);
}

/** Produtos de uma pessoa comparados com as colegas. situacao: 'ok' | 'poucos' | 'so-ela' */
export function produtosDaPessoa(lista, pessoa, det) {
  const m = new Map();
  for (const a of lista) {
    if (a.pessoa !== pessoa) continue;
    const d = duracaoMin(a.inicio, a.fim);
    if (!d) continue;
    const g = m.get(a.codigo) || { codigo: a.codigo, descricao: a.descricao, n: 0, min: 0, pecas: 0 };
    g.n += 1;
    g.min += d;
    g.pecas += a.realizado || 0;
    m.set(a.codigo, g);
  }
  return [...m.values()]
    .map((g) => {
      const porHora = (g.pecas / g.min) * 60;
      const col = ritmoColegas(det, g.codigo, pessoa);
      const situacao = !col ? 'so-ela' : g.n < MIN_APONT_CONFIAVEL || col.n < MIN_APONT_CONFIAVEL ? 'poucos' : 'ok';
      return {
        ...g,
        porHora,
        minPorMil: g.pecas ? (g.min / g.pecas) * 1000 : null,
        colegasMinPorMil: col ? 60000 / col.porHora : null,
        colegasPessoas: col ? col.pessoas : 0,
        vsColegas: col ? porHora / col.porHora : null,
        situacao,
      };
    })
    .sort((a, b) => b.min - a.min);
}

/** Ritmo vs colegas por semana para uma pessoa (só produtos comparáveis). */
export function semanasDaPessoa(lista, pessoa, det, chaveSemana) {
  const m = new Map();
  for (const a of lista) {
    if (a.pessoa !== pessoa) continue;
    const d = duracaoMin(a.inicio, a.fim);
    const col = d && ritmoColegas(det, a.codigo, pessoa);
    if (!col || col.n < MIN_APONT_CONFIAVEL) continue;
    const k = chaveSemana(a.data);
    const g = m.get(k) || { semana: k, pecas: 0, esperado: 0, min: 0 };
    g.pecas += a.realizado || 0;
    g.esperado += (col.porHora * d) / 60;
    g.min += d;
    m.set(k, g);
  }
  return [...m.values()]
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .map((g) => ({ ...g, diferenca: Math.round((g.pecas / g.esperado - 1) * 100) }));
}
// ---------------- Setup / troca de produto ----------------
export function trocasDeProduto(lista) {
  const porMaqDia = new Map();
  for (const a of lista) {
    if (a.maquina === 'MANUAL' || !a.inicio || !a.fim) continue;
    const k = `${a.maquina}|${a.data}`;
    if (!porMaqDia.has(k)) porMaqDia.set(k, []);
    porMaqDia.get(k).push(a);
  }
  const almoco = emMin(HORA_ALMOCO);
  const trocas = [];
  for (const itens of porMaqDia.values()) {
    itens.sort((x, y) => x.inicio.localeCompare(y.inicio));
    for (let i = 1; i < itens.length; i++) {
      const ant = itens[i - 1];
      const prox = itens[i];
      if (ant.codigo === prox.codigo) continue;
      const fim = emMin(ant.fim);
      const ini = emMin(prox.inicio);
      const gap = ini - fim;
      if (gap < 0 || gap > TROCA_MAX_MIN || (fim <= almoco && ini >= almoco)) continue;
      trocas.push({
        maquina: prox.maquina,
        data: prox.data,
        de: ant.codigo,
        deDescricao: ant.descricao,
        para: prox.codigo,
        paraDescricao: prox.descricao,
        fim: ant.fim,
        inicio: prox.inicio,
        min: gap,
      });
    }
  }
  return trocas;
}

export function resumoSetupPorMaquina(lista, trocas) {
  const m = new Map();
  for (const a of lista) {
    if (a.maquina === 'MANUAL') continue;
    const d = duracaoMin(a.inicio, a.fim);
    const g = m.get(a.maquina) || { nome: a.maquina, minProducao: 0, dias: new Set(), trocas: 0, minTroca: 0, maior: 0 };
    if (d) g.minProducao += d;
    g.dias.add(a.data);
    m.set(a.maquina, g);
  }
  for (const t of trocas) {
    const g = m.get(t.maquina);
    if (!g) continue;
    g.trocas += 1;
    g.minTroca += t.min;
    g.maior = Math.max(g.maior, t.min);
  }
  return [...m.values()]
    .map((g) => ({
      nome: g.nome,
      dias: g.dias.size,
      trocas: g.trocas,
      porDia: g.dias.size ? g.trocas / g.dias.size : 0,
      medio: g.trocas ? g.minTroca / g.trocas : null,
      total: g.minTroca,
      minProducao: g.minProducao,
      maior: g.maior,
      pctSetup: g.minTroca + g.minProducao ? g.minTroca / (g.minTroca + g.minProducao) : null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
