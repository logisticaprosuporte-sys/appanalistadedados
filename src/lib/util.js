const MAX_DURACAO_MIN = 12 * 60;

/** Minutos entre "HH:MM" de início e fim; null se faltar ou não fizer sentido. */
export function duracaoMin(inicio, fim) {
  if (!inicio || !fim) return null;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 && d <= MAX_DURACAO_MIN ? d : null;
}

export function formatarDuracao(min) {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h >= 100) return `${nf.format(h)}h`;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

const nf = new Intl.NumberFormat('pt-BR');
export const num = (n) => nf.format(Math.round(n || 0));

export function compacto(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;
  return num(n);
}

/** Data local no formato AAAA-MM-DD */
export function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoLocal(new Date(a, m - 1, d + dias));
}

/** Segunda-feira da semana da data */
export function inicioDaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dow = (new Date(a, m - 1, d).getDay() + 6) % 7;
  return somarDias(iso, -dow);
}

export function dataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function dataLonga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "ANA JULIA" -> "Ana Julia" */
export const capitalizar = (s) => (s ? s.toLowerCase().replace(/(^|[\s/(-])\S/g, (c) => c.toUpperCase()) : s);
