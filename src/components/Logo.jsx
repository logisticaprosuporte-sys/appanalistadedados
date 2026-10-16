// Logo da Elyplast: hexágono verde com borda azul-marinho e a caixa branca.
export const VERDE_ELYPLAST = '#00873d';
export const AZUL_ELYPLAST = '#1f3a6e';

export default function Logo({ tamanho = 32 }) {
  return (
    <svg viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true">
      <path
        d="M16 2.2 27.8 9v14L16 29.8 4.2 23V9z"
        fill={VERDE_ELYPLAST}
        stroke={AZUL_ELYPLAST}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M16 8.6 22.6 12 16 15.4 9.4 12z" fill="#fff" />
      <path d="M9.2 13.4 15.3 16.6v7.2L9.2 20.6z" fill="#fff" />
      <path d="M16.7 16.6 22.8 13.4v7.2l-6.1 3.2z" fill="#fff" />
      <path d="M13.2 10.4h5.6M12.4 11.9h5.6" stroke={VERDE_ELYPLAST} strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
