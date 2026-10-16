import { useCallback, useEffect, useRef, useState } from 'react';
import { carregarTudo, definirEmpresa, EMPRESA_FIXA, listarEmpresas, modoDemo } from './lib/db.js';
import Painel from './components/Painel.jsx';
import Lancar from './components/Lancar.jsx';
import Cadastros from './components/Cadastros.jsx';
import OrdemProducao from './components/OrdemProducao.jsx';
import ControleDiario from './components/ControleDiario.jsx';
import Saidas from './components/Saidas.jsx';
import Separacao from './components/Separacao.jsx';
import PainelExpedicao from './components/PainelExpedicao.jsx';
import Trava, { guardarSenha, lerSenhaSalva } from './components/Trava.jsx';
import Inicio from './components/Inicio.jsx';
import Recebimento from './components/Recebimento.jsx';
import ConsultaProduto from './components/ConsultaProduto.jsx';
import VendaCaixas from './components/VendaCaixas.jsx';
import PainelRecebimento from './components/PainelRecebimento.jsx';
import Logo from './components/Logo.jsx';
import EscolherEmpresa from './components/EscolherEmpresa.jsx';
import { TEXTO_RODAPE } from './components/ui.jsx';

// modulo: em qual menu a página aparece (Produção, Expedição ou Recebimento)
export const PAGINAS = [
  { id: 'inicio', nome: 'Início', descricao: 'Avisos e atalhos' },
  { id: 'lancar', modulo: 'producao', grupo: 'Produção', nome: 'Lançar produção', descricao: 'Apontamentos do dia' },
  { id: 'painel', modulo: 'producao', grupo: 'Produção', nome: 'Painel da produção', descricao: 'Gráficos e indicadores', senha: true },
  { id: 'op-manual', modulo: 'producao', grupo: 'Impressos', nome: 'O.P. Manual', descricao: 'Ordem de produção da linha manual' },
  { id: 'op-maquinas', modulo: 'producao', grupo: 'Impressos', nome: 'O.P. Máquinas', descricao: 'Ordem de produção das máquinas' },
  { id: 'controle-diario', modulo: 'producao', grupo: 'Impressos', nome: 'Controle de produção diária', descricao: 'Ficha do dia para imprimir' },
  { id: 'saidas', modulo: 'producao', grupo: 'Estoque', nome: 'Controle de saídas', descricao: 'Registro do que saiu' },
  { id: 'cadastros', modulo: 'producao', grupo: 'Configuração', nome: 'Cadastros da produção', descricao: 'Funcionárias, máquinas e produtos', senha: true },
  { id: 'separacao', modulo: 'expedicao', grupo: 'Expedição', nome: 'Separação de pedidos', descricao: 'Iniciar e finalizar separações' },
  { id: 'painel-expedicao', modulo: 'expedicao', grupo: 'Expedição', nome: 'Painel da expedição', descricao: 'Tempo de separação e indicadores', senha: true },
  { id: 'cadastros-expedicao', modulo: 'expedicao', grupo: 'Configuração', nome: 'Cadastros da expedição', descricao: 'Separadores e meta de tempo', senha: true },
  { id: 'recebimento', modulo: 'recebimento', grupo: 'Recebimento', nome: 'Recebimento de mercadorias', descricao: 'Entradas e etapas até a linha' },
  { id: 'consulta', modulo: 'recebimento', grupo: 'Recebimento', nome: 'Consulta de produto', descricao: 'Endereço, fornecedor e ficha' },
  { id: 'venda-caixas', modulo: 'recebimento', grupo: 'Caixas', nome: 'Venda de caixas', descricao: 'Caixas vendidas e valores' },
  { id: 'painel-recebimento', modulo: 'recebimento', grupo: 'Recebimento', nome: 'Painel do recebimento', descricao: 'Indicadores de entrada e caixas', senha: true },
  { id: 'cadastros-recebimento', modulo: 'recebimento', grupo: 'Configuração', nome: 'Cadastros do recebimento', descricao: 'Compradores e tipos de caixa', senha: true },
];

const MENUS = [
  { id: 'producao', nome: 'Produção' },
  { id: 'expedicao', nome: 'Expedição' },
  { id: 'recebimento', nome: 'Recebimento' },
];

function paginaInicial() {
  const h = window.location.hash.replace('#', '').split('?')[0];
  return PAGINAS.some((p) => p.id === h) ? h : 'inicio';
}

const Cadeado = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

function Menu({ menu, pagina, onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const itens = PAGINAS.filter((p) => p.modulo === menu.id);
  const ativo = itens.some((p) => p.id === pagina && p.modulo === menu.id);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div className="menu" ref={ref}>
      <button
        className={`menu-botao ${aberto ? 'aberto' : ''} ${ativo ? 'atual' : ''}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {menu.nome}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="seta">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className="menu-lista" role="menu">
          {itens.map((p, i) => [
            p.grupo !== itens[i - 1]?.grupo && (
              <div key={`g-${p.grupo}`} className="menu-grupo">
                {p.grupo}
              </div>
            ),
            <button
              key={p.id}
              role="menuitem"
              className={pagina === p.id ? 'menu-item ativo' : 'menu-item'}
              onClick={() => {
                onEscolher(p.id);
                setAberto(false);
              }}
            >
              <span className="menu-item-texto">
                <span className="menu-item-nome">
                  {p.nome} {p.senha && <Cadeado />}
                </span>
                <span className="menu-item-desc">{p.descricao}</span>
              </span>
              {pagina === p.id && <span className="menu-check">✓</span>}
            </button>,
          ])}
        </div>
      )}
    </div>
  );
}

const CHAVE_EMPRESA = 'analista-empresa';
function lerEmpresaSalva() {
  try {
    return localStorage.getItem(CHAVE_EMPRESA) || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [empresas, setEmpresas] = useState(null);
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    listarEmpresas()
      .then((lista) => {
        setEmpresas(lista);
        const id = EMPRESA_FIXA || lerEmpresaSalva();
        const e = lista.find((x) => x.id === id);
        if (e) {
          definirEmpresa(e);
          setEmpresa(e);
        }
      })
      .catch((e) => setEmpresas({ erro: e.message || String(e) }));
  }, []);

  const trocarEmpresa = (e) => {
    definirEmpresa(e);
    try {
      if (e) localStorage.setItem(CHAVE_EMPRESA, e.id);
      else localStorage.removeItem(CHAVE_EMPRESA);
    } catch {}
    setEmpresa(e);
  };

  if (!empresas) return <div className="carregando">Carregando…</div>;
  if (empresas.erro) return <div className="aviso erro">Não foi possível carregar as empresas: {empresas.erro}</div>;
  if (!empresa) return <EscolherEmpresa empresas={empresas} onEscolher={trocarEmpresa} />;
  // key: ao trocar de empresa o site começa do zero, sem nenhum dado da anterior na memória
  return <Sistema key={empresa.id} empresa={empresa} onTrocar={EMPRESA_FIXA ? null : () => trocarEmpresa(null)} />;
}

function Sistema({ empresa, onTrocar }) {
  const [pagina, setPagina] = useState(paginaInicial);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  // Senha dos Painéis e dos Cadastros (a mesma, uma por empresa), válida até fechar o navegador
  const [senha, setSenha] = useState(lerSenhaSalva);
  const liberar = (s) => {
    guardarSenha(s);
    setSenha(s);
  };
  const bloquear = () => {
    guardarSenha('');
    setSenha('');
  };

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarTudo());
      setErro(null);
    } catch (e) {
      setErro(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    recarregar();
    // Ao voltar para a aba do navegador, busca o que outras pessoas lançaram
    const aoFocar = () => document.visibilityState === 'visible' && recarregar();
    document.addEventListener('visibilitychange', aoFocar);
    return () => document.removeEventListener('visibilitychange', aoFocar);
  }, [recarregar]);

  const escolher = (id) => {
    setPagina(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo(0, 0);
  };

  const atual = PAGINAS.find((p) => p.id === pagina);
  const area = MENUS.find((m) => m.id === atual.modulo)?.nome || null;

  // Abre outra tela já com um parâmetro (ex.: O.P. com o código preenchido)
  const irPara = (id, consulta) => {
    window.history.replaceState(null, '', `#${id}${consulta ? `?${consulta}` : ''}`);
    setPagina(id);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <header className="topo">
        <button className="marca" onClick={() => escolher('inicio')} title="Ir para o início">
          <span className="logo">
            <Logo tamanho={34} />
          </span>
          <div>
            <strong>{empresa.nome}</strong>
            <span className="sub">{area ? `${area} · ${atual.nome}` : atual.nome}</span>
          </div>
        </button>
        <div className="topo-acoes">
          {onTrocar && (
            <button className="botao fantasma pequeno" onClick={onTrocar} title="Escolher outra empresa">
              Trocar empresa
            </button>
          )}
          {senha && (
            <button className="botao fantasma pequeno" onClick={bloquear} title="Trancar Painéis e Cadastros neste computador">
              Bloquear
            </button>
          )}
          {pagina !== 'inicio' && (
            <button className="botao fantasma" onClick={() => escolher('inicio')}>
              Início
            </button>
          )}
          {MENUS.map((m) => (
            <Menu key={m.id} menu={m} pagina={pagina} onEscolher={escolher} />
          ))}
        </div>
      </header>

      {modoDemo && (
        <div className="aviso">
          <strong>Modo demonstração.</strong> O banco de dados ainda não foi conectado: o que for lançado fica salvo só
          neste navegador.
        </div>
      )}

      <main className="conteudo">
        {erro && (
          <div className="aviso erro">
            Não foi possível carregar os dados: {erro}{' '}
            <button className="botao pequeno" onClick={recarregar}>
              Tentar de novo
            </button>
          </div>
        )}
        {pagina === 'inicio' && <Inicio paginas={PAGINAS} dados={dados} onEscolher={escolher} />}
        {pagina !== 'inicio' && !dados && !erro && <div className="carregando">Carregando…</div>}
        {dados && atual.senha && !senha && (
          <Trava
            titulo={`${atual.nome} protegido${atual.id.startsWith('cadastros') ? 's' : ''}`}
            texto={atual.id.startsWith('cadastros') ? 'Digite a senha para alterar os cadastros.' : 'Digite a senha para ver os gráficos e indicadores.'}
            onLiberar={liberar}
          />
        )}
        {dados && pagina === 'painel' && senha && <Painel dados={dados} />}
        {dados && pagina === 'lancar' && <Lancar dados={dados} setDados={setDados} />}
        {dados && pagina === 'op-manual' && <OrdemProducao key="manual" tipo="manual" dados={dados} />}
        {dados && pagina === 'op-maquinas' && <OrdemProducao key="maquinas" tipo="maquinas" dados={dados} />}
        {dados && pagina === 'controle-diario' && <ControleDiario dados={dados} />}
        {dados && pagina === 'saidas' && <Saidas dados={dados} setDados={setDados} />}
        {dados && pagina === 'separacao' && <Separacao dados={dados} setDados={setDados} />}
        {dados && pagina === 'painel-expedicao' && senha && <PainelExpedicao dados={dados} />}
        {dados && pagina === 'cadastros' && senha && <Cadastros area="producao" dados={dados} setDados={setDados} recarregar={recarregar} senha={senha} />}
        {dados && pagina === 'cadastros-expedicao' && senha && <Cadastros area="expedicao" dados={dados} setDados={setDados} recarregar={recarregar} senha={senha} />}
        {dados && pagina === 'recebimento' && <Recebimento dados={dados} setDados={setDados} onIrPara={irPara} />}
        {dados && pagina === 'consulta' && <ConsultaProduto dados={dados} onIrPara={irPara} />}
        {dados && pagina === 'venda-caixas' && <VendaCaixas dados={dados} setDados={setDados} />}
        {dados && pagina === 'painel-recebimento' && senha && <PainelRecebimento dados={dados} />}
        {dados && pagina === 'cadastros-recebimento' && senha && <Cadastros area="recebimento" dados={dados} setDados={setDados} recarregar={recarregar} senha={senha} />}
      </main>
      <footer className="rodape-site nao-imprimir">{TEXTO_RODAPE}</footer>
    </div>
  );
}
