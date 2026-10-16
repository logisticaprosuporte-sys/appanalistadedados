import { useEffect, useMemo, useRef, useState } from 'react';
import { carregarSeparacoes, excluirSeparacao, parametro, salvarSeparacao } from '../lib/db.js';
import { capitalizar, dataCurta, dataLonga, duracaoMin, formatarDuracao, isoLocal, num, somarDias } from '../lib/util.js';

/** Meta de tempo por pedido (min), definida em Cadastros da expedição. */
export const metaSeparacao = (dados) => Number(parametro(dados, 'meta_separacao_min')) || 30;

const agoraHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Relógio que atualiza a tela a cada 20 segundos (para os cronômetros). */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

function minutosDesde(s, agora) {
  const [a, m, d] = s.data.split('-').map(Number);
  const [h, mi] = s.inicio.split(':').map(Number);
  return Math.max(0, Math.round((agora - new Date(a, m - 1, d, h, mi)) / 60000));
}

// ---------------- Iniciar ----------------
function NovaSeparacao({ separadores, emAndamento, onIniciar }) {
  const [pedido, setPedido] = useState('');
  const [separador, setSeparador] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(null);

  async function iniciar(e) {
    e.preventDefault();
    const p = pedido.trim().toUpperCase();
    if (!p) return setMsg('Digite o número do pedido.');
    if (!separador) return setMsg('Escolha quem vai separar.');
    if (emAndamento.some((s) => s.pedido === p)) return setMsg(`O pedido ${p} já está em separação.`);
    setOcupado(true);
    try {
      await onIniciar({ pedido: p, separador });
      setPedido('');
      setMsg('');
      ref.current?.focus();
    } catch (err) {
      setMsg('Não foi possível iniciar: ' + (err.message || err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="cartao nova-separacao" onSubmit={iniciar}>
      <h2>Começar uma separação</h2>
      <div className="nova-campos">
        <label className="campo">
          <span>Número do pedido</span>
          <input ref={ref} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ex.: 45871" autoFocus />
        </label>
        <label className="campo">
          <span>Quem vai separar</span>
          <select value={separador} onChange={(e) => setSeparador(e.target.value)}>
            <option value="">Escolha…</option>
            {separadores.map((n) => (
              <option key={n} value={n}>
                {capitalizar(n)}
              </option>
            ))}
          </select>
        </label>
        <button className="botao primario grande" disabled={ocupado}>
          ▶ Iniciar separação
        </button>
      </div>
      {msg && <p className="erro-txt">{msg}</p>}
      {!separadores.length && (
        <p className="dica">Nenhum separador cadastrado ainda. Cadastre em Cadastros → Separadores (precisa da senha).</p>
      )}
      <p className="dica">A hora de início é marcada sozinha quando você clica em Iniciar.</p>
    </form>
  );
}

// ---------------- Em andamento ----------------
function CartaoAndamento({ s, agora, meta, onFinalizar, onCancelar }) {
  const [itens, setItens] = useState('');
  const [volumes, setVolumes] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const min = minutosDesde(s, agora);
  const atrasado = min > meta;

  async function finalizar() {
    setOcupado(true);
    try {
      await onFinalizar(s, itens, volumes);
    } catch (e) {
      window.alert('Não foi possível finalizar: ' + (e.message || e));
      setOcupado(false);
    }
  }

  return (
    <div className={`andamento ${atrasado ? 'atrasado' : ''}`}>
      <div className="andamento-topo">
        <div>
          <span className="andamento-rotulo">Pedido</span>
          <strong className="andamento-pedido">{s.pedido}</strong>
        </div>
        <div className="andamento-tempo" title={`Meta: ${meta} min`}>
          <strong>{formatarDuracao(min)}</strong>
          <span>{atrasado ? `passou da meta (${meta} min)` : 'separando'}</span>
        </div>
      </div>
      <div className="andamento-info">
        {capitalizar(s.separador)} · começou às {s.inicio}
        {s.data !== isoLocal() && ` de ${dataCurta(s.data)}`}
      </div>
      <div className="andamento-campos">
        <label className="campo">
          <span>Itens (opcional)</span>
          <input inputMode="numeric" value={itens} onChange={(e) => setItens(e.target.value.replace(/\D/g, ''))} placeholder="nº de itens" />
        </label>
        <label className="campo">
          <span>Volumes (opcional)</span>
          <input inputMode="numeric" value={volumes} onChange={(e) => setVolumes(e.target.value.replace(/\D/g, ''))} placeholder="caixas" />
        </label>
      </div>
      <div className="andamento-acoes">
        <button className="botao primario grande" onClick={finalizar} disabled={ocupado}>
          ■ Finalizar
        </button>
        <button className="link" onClick={() => onCancelar(s)}>
          cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------- Lista do dia (editável) ----------------
const VAZIA = { pedido: '', separador: '', inicio: '', fim: '', itens: '', volumes: '', observacao: '' };

function LinhaSeparacao({ item, nova, separadores, onSalvar, onExcluir }) {
  const [l, setL] = useState(() => ({ ...VAZIA, ...item, itens: item.itens ?? '', volumes: item.volumes ?? '' }));
  const [estado, setEstado] = useState(nova ? 'nova' : 'salvo');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);
  const dur = duracaoMin(l.inicio, l.fim);

  const mudar = (campo) => (e) => {
    setL((x) => ({ ...x, [campo]: e.target.value }));
    if (!nova) setEstado('alterado');
    setMsg('');
  };

  async function salvar() {
    let problema = null;
    if (!String(l.pedido).trim()) problema = 'Digite o número do pedido';
    else if (!l.separador) problema = 'Escolha quem separou';
    else if (!l.inicio || !l.fim) problema = 'Preencha início e fim';
    else if (dur === null) problema = 'O fim deve ser depois do início';
    if (problema) {
      setEstado(nova ? 'nova' : 'erro');
      setMsg(problema);
      return;
    }
    setEstado('salvando');
    try {
      const salvo = await onSalvar({
        id: l.id,
        pedido: String(l.pedido).trim().toUpperCase(),
        separador: l.separador,
        inicio: l.inicio,
        fim: l.fim,
        itens: l.itens === '' ? null : Number(l.itens),
        volumes: l.volumes === '' ? null : Number(l.volumes),
        observacao: l.observacao || '',
      });
      if (nova) {
        setL({ ...VAZIA, separador: l.separador, inicio: l.fim });
        setEstado('nova');
      } else {
        setL({ ...salvo, itens: salvo.itens ?? '', volumes: salvo.volumes ?? '' });
        setEstado('salvo');
      }
      setMsg('');
    } catch (e) {
      setEstado('erro');
      setMsg(e.message || 'Erro ao salvar');
    }
  }

  return (
    <>
      <tr
        ref={ref}
        className={`linha ${nova ? 'nova' : ''} ${estado}`}
        onBlur={(e) => {
          if (nova || estado !== 'alterado' || ref.current?.contains(e.relatedTarget)) return;
          salvar();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            salvar();
          }
        }}
      >
        <td>
          <input value={l.pedido} onChange={mudar('pedido')} aria-label="Pedido" placeholder={nova ? 'nº pedido' : ''} />
        </td>
        <td>
          <select value={l.separador} onChange={mudar('separador')} aria-label="Separador">
            <option value="">—</option>
            {[...new Set([...separadores, l.separador].filter(Boolean))].map((n) => (
              <option key={n} value={n}>
                {capitalizar(n)}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input type="time" value={l.inicio || ''} onChange={mudar('inicio')} aria-label="Início" />
        </td>
        <td>
          <input type="time" value={l.fim || ''} onChange={mudar('fim')} aria-label="Fim" />
        </td>
        <td className="auto num forte">{dur === null ? '' : formatarDuracao(dur)}</td>
        <td>
          <input inputMode="numeric" className="num" value={l.itens} onChange={mudar('itens')} aria-label="Itens" />
        </td>
        <td>
          <input inputMode="numeric" className="num" value={l.volumes} onChange={mudar('volumes')} aria-label="Volumes" />
        </td>
        <td>
          <input value={l.observacao || ''} onChange={mudar('observacao')} aria-label="Observação" />
        </td>
        <td className="acoes">
          {nova ? (
            <button className="botao pequeno" onClick={salvar} disabled={estado === 'salvando'}>
              Adicionar
            </button>
          ) : (
            <>
              <span className={`status ${estado}`}>{estado === 'salvando' ? '…' : estado === 'salvo' ? '✓' : estado === 'erro' ? '!' : '•'}</span>
              <button className="icone" title="Excluir" aria-label="Excluir" onClick={() => onExcluir(l.id)}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.7 9.5h5.6l.7-9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
        </td>
      </tr>
      {msg && (
        <tr className="linha-msg">
          <td colSpan={9}>⚠ {msg}</td>
        </tr>
      )}
    </>
  );
}

// ---------------- Página ----------------
export default function Separacao({ dados, setDados }) {
  const agora = useAgora();
  const meta = metaSeparacao(dados);
  const [dia, setDia] = useState(isoLocal());
  const [chaveNova, setChaveNova] = useState(0);

  // Atualiza a lista a cada 30 s, para ver o que outras pessoas iniciaram/finalizaram
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const separacoes = await carregarSeparacoes();
        setDados((d) => ({ ...d, separacoes }));
      } catch {}
    }, 30000);
    return () => clearInterval(t);
  }, [setDados]);

  const separadores = useMemo(() => (dados.separadores || []).filter((s) => s.ativo).map((s) => s.nome).sort(), [dados.separadores]);
  const todas = dados.separacoes || [];
  const emAndamento = useMemo(() => todas.filter((s) => !s.fim).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio)), [todas]);
  const doDia = useMemo(
    () => todas.filter((s) => s.fim && s.data === dia).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id - b.id),
    [todas, dia],
  );
  const minDia = doDia.reduce((s, x) => s + (duracaoMin(x.inicio, x.fim) || 0), 0);

  const atualizar = (salvo) => setDados((d) => ({ ...d, separacoes: [...(d.separacoes || []).filter((x) => x.id !== salvo.id), salvo] }));

  async function iniciar({ pedido, separador }) {
    atualizar(await salvarSeparacao({ data: isoLocal(), pedido, separador, inicio: agoraHHMM(), fim: null, observacao: '' }));
  }

  async function finalizar(s, itens, volumes) {
    let fim = agoraHHMM();
    if (s.data !== isoLocal() || fim < s.inicio) fim = '23:59'; // ficou aberto de um dia para o outro
    atualizar(
      await salvarSeparacao({
        ...s,
        fim,
        itens: itens === '' ? s.itens ?? null : Number(itens),
        volumes: volumes === '' ? s.volumes ?? null : Number(volumes),
      }),
    );
  }

  async function excluir(id, pergunta = 'Excluir esta separação?') {
    if (!window.confirm(pergunta)) return;
    try {
      await excluirSeparacao(id);
      setDados((d) => ({ ...d, separacoes: d.separacoes.filter((x) => x.id !== id) }));
    } catch (e) {
      window.alert('Não foi possível excluir: ' + (e.message || e));
    }
  }

  const trocarDia = (novo) => {
    setDia(novo);
    setChaveNova((k) => k + 1);
  };
  const hoje = isoLocal();

  return (
    <section className="separacao">
      <NovaSeparacao separadores={separadores} emAndamento={emAndamento} onIniciar={iniciar} />

      <div className="bloco-titulo">
        <h2>Em separação agora</h2>
        <span className="mudo">{emAndamento.length ? `${emAndamento.length} ${emAndamento.length === 1 ? 'pedido' : 'pedidos'}` : 'nenhum pedido'}</span>
      </div>
      {emAndamento.length ? (
        <div className="andamentos">
          {emAndamento.map((s) => (
            <CartaoAndamento
              key={s.id}
              s={s}
              agora={agora}
              meta={meta}
              onFinalizar={finalizar}
              onCancelar={(x) => excluir(x.id, `Cancelar a separação do pedido ${x.pedido}? Ela será apagada.`)}
            />
          ))}
        </div>
      ) : (
        <div className="vazio pequeno-vazio">Nenhum pedido sendo separado agora.</div>
      )}

      <div className="bloco-titulo">
        <h2>Separações finalizadas</h2>
      </div>
      <div className="barra-dia">
        <div className="seletor-dia">
          <button className="botao" onClick={() => trocarDia(somarDias(dia, -1))} aria-label="Dia anterior">
            ‹
          </button>
          <input type="date" value={dia} onChange={(e) => e.target.value && trocarDia(e.target.value)} aria-label="Dia" />
          <button className="botao" onClick={() => trocarDia(somarDias(dia, 1))} aria-label="Próximo dia">
            ›
          </button>
          {dia !== hoje && (
            <button className="botao" onClick={() => trocarDia(hoje)}>
              Hoje
            </button>
          )}
          <span className="dia-extenso">{dataLonga(dia)}</span>
        </div>
        <div className="resumo-dia">
          <span>
            <strong>{doDia.length}</strong> {doDia.length === 1 ? 'pedido' : 'pedidos'}
          </span>
          <span>
            <strong>{doDia.length ? formatarDuracao(minDia / doDia.length) : '—'}</strong> em média
          </span>
          <span>
            <strong>{num(doDia.reduce((s, x) => s + (x.itens || 0), 0))}</strong> itens
          </span>
        </div>
      </div>
      <div className="grade-wrap">
        <table className="grade grade-separacao">
          <thead>
            <tr>
              <th style={{ width: 130 }}>Pedido</th>
              <th style={{ width: 150 }}>Separador</th>
              <th style={{ width: 96 }}>Início</th>
              <th style={{ width: 96 }}>Fim</th>
              <th style={{ width: 80 }}>Tempo</th>
              <th style={{ width: 76 }}>Itens</th>
              <th style={{ width: 80 }}>Volumes</th>
              <th>Observação</th>
              <th style={{ width: 96 }} aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {doDia.map((s) => (
              <LinhaSeparacao key={s.id} item={s} separadores={separadores} onSalvar={(x) => salvarSeparacao({ ...x, data: s.data }).then((r) => (atualizar(r), r))} onExcluir={(id) => excluir(id)} />
            ))}
            <LinhaSeparacao
              key={`nova-${chaveNova}`}
              nova
              item={{}}
              separadores={separadores}
              onSalvar={(x) => salvarSeparacao({ ...x, data: dia }).then((r) => (atualizar(r), r))}
              onExcluir={() => {}}
            />
          </tbody>
        </table>
      </div>
      <p className="dica">
        Esqueceu de marcar na hora? Use a última linha para lançar uma separação com início e fim e aperte <kbd>Enter</kbd>.
        Para corrigir, é só editar a célula.
      </p>
    </section>
  );
}
