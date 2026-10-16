import { useEffect, useState } from 'react';

// Paleta categórica validada (ordem fixa = segura para daltonismo). Cor segue a entidade, nunca a posição.
const SERIES = {
  claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  escuro: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
// Verde Elyplast: cor dos gráficos de uma série só (barras, linhas)
const DESTAQUE = { claro: '#00873d', escuro: '#2fae64' };
const OUTROS = { claro: '#b9b8b2', escuro: '#5a5955' };
const GRADE = { claro: '#e1e0d9', escuro: '#2c2c2a' };
const TEXTO = { claro: '#898781', escuro: '#898781' };
const SUPERFICIE = { claro: '#fcfcfb', escuro: '#1a1a19' };

export function useTema() {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [escuro, setEscuro] = useState(mq ? mq.matches : false);
  useEffect(() => {
    if (!mq) return;
    const f = (e) => setEscuro(e.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const m = escuro ? 'escuro' : 'claro';
  return { destaque: DESTAQUE[m], series: SERIES[m], outros: OUTROS[m], grade: GRADE[m], texto: TEXTO[m], superficie: SUPERFICIE[m] };
}
