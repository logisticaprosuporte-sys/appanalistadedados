import { nomeEmpresa } from '../lib/db.js';
import { dataLonga, isoLocal } from '../lib/util.js';

const ICONES = {
  lancar: <path d="M4 4h16v16H4zM4 9h16M9 9v11" />,
  painel: <path d="M5 20V11M12 20V5M19 20v-7" />,
  'op-manual': <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  'op-maquinas': <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />,
  'controle-diario': <path d="M5 4h14v17H5zM9 2v4M15 2v4M8 11h8M8 15h5" />,
  saidas: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8M15 15h6M18 12l3 3-3 3" />,
  separacao: <path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10M16.5 9l-9-4" />,
  'painel-expedicao': <path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2M21 3l-6 6M21 3h-4M21 3v4" />,
  cadastros: <path d="M8 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />,
  recebimento: <path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9h18M9 20v-6h6v6" />,
  consulta: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6M11 8v6" />,
  'venda-caixas': <path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8M7 6.5l8 4" />,
  'painel-recebimento': <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  'cadastros-recebimento': <path d="M8 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />,
  'cadastros-expedicao': <path d="M8 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />,
};

const AREAS = [
  { modulo: 'producao', nome: 'Produção' },
  { modulo: 'expedicao', nome: 'Expedição' },
  { modulo: 'recebimento', nome: 'Recebimento' },
];

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function Atalho({ p, onEscolher }) {
  return (
    <button className="atalho" onClick={() => onEscolher(p.id)}>
      <span className="atalho-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {ICONES[p.id]}
        </svg>
      </span>
      <span className="atalho-texto">
        <strong>
          {p.nome}
          {p.senha && <span className="atalho-cadeado" title="Precisa de senha"> 🔒</span>}
        </strong>
        <span>{p.descricao}</span>
      </span>
    </button>
  );
}

function Contador({ valor, um, varios }) {
  return (
    <div>
      <strong>{valor ?? '…'}</strong>
      <span>{valor === 1 ? um : varios}</span>
    </div>
  );
}

export default function Inicio({ paginas, dados, onEscolher }) {
  const hoje = isoLocal();
  const apontHoje = dados ? dados.apontamentos.filter((a) => a.data === hoje).length : null;
  const separadosHoje = dados ? (dados.separacoes || []).filter((s) => s.data === hoje && s.fim).length : null;
  const separandoAgora = dados ? (dados.separacoes || []).filter((s) => !s.fim).length : null;
  const recebendo = dados ? (dados.recebimentos || []).filter((r) => r.situacao !== 'concluido').length : null;

  return (
    <section className="inicio">
      <div className="inicio-topo">
        <div>
          <h1>{saudacao()}! 👋</h1>
          <p className="mudo">{dataLonga(hoje)} · Dados da empresa {nomeEmpresa()}</p>
        </div>
        <div className="inicio-hoje">
          <Contador valor={apontHoje} um="apontamento de produção hoje" varios="apontamentos de produção hoje" />
          <Contador valor={separadosHoje} um="pedido separado hoje" varios="pedidos separados hoje" />
          <Contador valor={separandoAgora} um="pedido em separação agora" varios="pedidos em separação agora" />
          <Contador valor={recebendo} um="mercadoria no recebimento" varios="mercadorias no recebimento" />
        </div>
      </div>

      {AREAS.map((a) => {
        const itens = paginas.filter((p) => p.modulo === a.modulo);
        if (!itens.length) return null;
        return (
          <div key={a.modulo}>
            <h2 className="inicio-secao">{a.nome}</h2>
            <div className="atalhos">
              {itens.map((p) => (
                <Atalho key={p.id} p={p} onEscolher={onEscolher} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="cartao inicio-como">
        <h2>Como usar</h2>
        <ol>
          <li>
            <b>Lançar produção</b>: escolha o dia, preencha a linha (máquina, código, funcionária, início, fim, quantidade) e
            aperte <kbd>Enter</kbd>.
          </li>
          <li>
            <b>Separação de pedidos</b>: digite o número do pedido, escolha quem vai separar e clique em <b>Iniciar</b>.
            Quando terminar, clique em <b>Finalizar</b>. As horas são marcadas sozinhas.
          </li>
          <li>
            <b>Painéis e Cadastros</b> pedem senha. Para trocar de tela, use os botões <b>Produção</b>, <b>Expedição</b> e
            <b>Recebimento</b> no canto de cima.
          </li>
        </ol>
      </div>
    </section>
  );
}
