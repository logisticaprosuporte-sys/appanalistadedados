import Logo from './Logo.jsx';
import { TEXTO_RODAPE } from './ui.jsx';

// Primeira tela: escolher de qual empresa são os dados. Cada empresa só vê e grava os próprios dados.
export default function EscolherEmpresa({ empresas, onEscolher }) {
  return (
    <div className="app">
      <main className="conteudo escolher-empresa">
        <span className="logo">
          <Logo tamanho={48} />
        </span>
        <h1>Qual empresa?</h1>
        <p className="mudo">Os dados de cada empresa ficam separados. Dá para trocar depois pelo botão no topo.</p>
        {empresas.length === 0 ? (
          <div className="aviso">Nenhuma empresa cadastrada. Rode o arquivo banco/02-empresas.sql no Supabase.</div>
        ) : (
          <div className="empresas-lista">
            {empresas.map((e) => (
              <button key={e.id} className="cartao empresa-cartao" onClick={() => onEscolher(e)}>
                <strong>{e.nome}</strong>
                <span className="mudo">Entrar</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <footer className="rodape-site nao-imprimir">{TEXTO_RODAPE}</footer>
    </div>
  );
}
