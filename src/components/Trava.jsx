import { useState } from 'react';
import { empresaAtual, verificarSenha } from '../lib/db.js';

// Mesma senha para o Painel e os Cadastros, uma por empresa. Fica guardada só até fechar o navegador.
const CHAVE_SESSAO = () => `analista-senha-${empresaAtual()}`;

export function lerSenhaSalva() {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO()) || '';
  } catch {
    return '';
  }
}

export function guardarSenha(senha) {
  try {
    if (senha) sessionStorage.setItem(CHAVE_SESSAO(), senha);
    else sessionStorage.removeItem(CHAVE_SESSAO());
  } catch {}
}

export default function Trava({ titulo, texto, onLiberar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (!senha) return;
    setOcupado(true);
    setErro('');
    try {
      if (await verificarSenha(senha)) onLiberar(senha);
      else setErro('Senha incorreta.');
    } catch (err) {
      setErro('Não foi possível conferir a senha: ' + (err.message || err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="cartao trava">
      <span className="trava-icone" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="24" height="24">
          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </span>
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <form onSubmit={entrar}>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" autoFocus aria-label="Senha" />
        {erro && <span className="erro-txt">{erro}</span>}
        <button className="botao primario" disabled={ocupado || !senha}>
          {ocupado ? 'Conferindo…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
