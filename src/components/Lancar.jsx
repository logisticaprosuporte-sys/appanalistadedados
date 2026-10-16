import { useMemo, useRef, useState } from 'react';
import { excluirApontamento, salvarApontamento } from '../lib/db.js';
import { dataLonga, duracaoMin, formatarDuracao, isoLocal, num, somarDias } from '../lib/util.js';

const VAZIO = { maquina: '', codigo: '', pessoa: '', apoio: '', inicio: '', fim: '', previsto: '', realizado: '', observacao: '' };

function validar(l, produtos) {
  if (!l.maquina) return 'Escolha a máquina';
  if (!l.codigo) return 'Digite o código';
  if (!produtos.has(Number(l.codigo))) return 'Código não cadastrado';
  if (!l.pessoa) return 'Escolha a funcionária';
  if (!l.inicio || !l.fim) return 'Preencha início e fim';
  if (duracaoMin(l.inicio, l.fim) === null) return 'Fim deve ser depois do início';
  if (l.realizado === '' || l.realizado === null || Number(l.realizado) < 0) return 'Digite a quantidade';
  return null;
}

/** Peças esperadas pela meta/hora do produto no tempo trabalhado */
export function previstoPelaMeta(produto, inicio, fim) {
  const meta = Number(produto?.meta_hora) || 0;
  const dur = duracaoMin(inicio, fim);
  return meta > 0 && dur ? Math.round((meta * dur) / 60) : null;
}

function paraSalvar(l, dia, produtos) {
  const p = produtos.get(Number(l.codigo));
  const previstoDigitado = l.previsto === '' || l.previsto === null ? null : Math.round(Number(l.previsto));
  return {
    id: l.id,
    data: dia,
    maquina: l.maquina,
    codigo: Number(l.codigo),
    descricao: p.descricao,
    familia: p.familia,
    pessoa: l.pessoa,
    apoio: l.maquina === 'MANUAL' ? '' : l.apoio || '',
    inicio: l.inicio,
    fim: l.fim,
    previsto: previstoDigitado ?? previstoPelaMeta(p, l.inicio, l.fim),
    realizado: Math.round(Number(l.realizado)),
    observacao: l.observacao || '',
  };
}

function Linha({ item, nova, listas, produtos, onSalvar, onExcluir }) {
  const [l, setL] = useState(() => (nova ? item : { ...item, previsto: item.previsto ?? '', apoio: item.apoio || '' }));
  const [estado, setEstado] = useState(nova ? 'nova' : 'salvo'); // nova | alterado | salvando | salvo | erro
  const [msg, setMsg] = useState('');
  const ref = useRef(null);

  const produto = produtos.get(Number(l.codigo));
  const dur = duracaoMin(l.inicio, l.fim);
  const meta = Number(produto?.meta_hora) || 0;
  const esperado = previstoPelaMeta(produto, l.inicio, l.fim);
  const pctMeta = esperado && l.realizado !== '' && l.realizado !== null ? Math.round((Number(l.realizado) / esperado) * 100) : null;

  const mudar = (campo) => (e) => {
    const v = e.target.value;
    setL((x) => ({ ...x, [campo]: v }));
    if (!nova) setEstado('alterado');
    setMsg('');
  };

  async function salvar() {
    const problema = validar(l, produtos);
    if (problema) {
      setEstado(nova ? 'nova' : 'erro');
      setMsg(problema);
      return;
    }
    setEstado('salvando');
    try {
      const salvo = await onSalvar(l);
      if (nova) {
        // Linha nova: mantém máquina, pessoa e apoio; o próximo começa quando este terminou
        setL({ ...VAZIO, maquina: l.maquina, pessoa: l.pessoa, apoio: l.apoio, inicio: l.fim });
        setEstado('nova');
        setMsg('');
        setTimeout(() => ref.current?.querySelector('[data-campo="codigo"]')?.focus(), 0);
      } else {
        setL({ ...salvo, previsto: salvo.previsto ?? '', apoio: salvo.apoio || '' });
        setEstado('salvo');
      }
    } catch (e) {
      setEstado('erro');
      setMsg(e.message || 'Erro ao salvar');
    }
  }

  // Linha existente: salva sozinha quando o foco sai da linha
  const aoSairDaLinha = (e) => {
    if (nova || estado !== 'alterado') return;
    if (ref.current && ref.current.contains(e.relatedTarget)) return;
    salvar();
  };

  const aoTeclar = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      salvar();
    }
  };

  const manual = l.maquina === 'MANUAL';

  return (
    <>
    <tr ref={ref} className={`linha ${nova ? 'nova' : ''} ${estado}`} onBlur={aoSairDaLinha} onKeyDown={aoTeclar}>
      <td>
        <select value={l.maquina} onChange={mudar('maquina')} aria-label="Máquina">
          <option value="">—</option>
          {listas.maquinas.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          data-campo="codigo"
          inputMode="numeric"
          list="lista-produtos"
          value={l.codigo}
          onChange={mudar('codigo')}
          aria-label="Código"
          className={l.codigo && !produto ? 'invalido' : ''}
        />
      </td>
      <td className="auto descricao" title={produto?.descricao}>
        {produto ? produto.descricao : l.codigo ? <span className="erro-txt">não cadastrado</span> : ''}
      </td>
      <td className="auto">{produto?.familia || ''}</td>
      <td className="auto num" title="Meta por hora (do cadastro do produto)">
        {produto ? (meta ? num(meta) : <span className="mudo">sem meta</span>) : ''}
      </td>
      <td>
        <select value={l.pessoa} onChange={mudar('pessoa')} aria-label="Funcionária">
          <option value="">—</option>
          {listas.pessoas.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </td>
      <td>
        <select value={manual ? '' : l.apoio} onChange={mudar('apoio')} disabled={manual} aria-label="Apoio">
          <option value="">{manual ? '' : 'Sem apoio'}</option>
          {listas.pessoas.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </td>
      <td>
        <input type="time" value={l.inicio || ''} onChange={mudar('inicio')} aria-label="Início" />
      </td>
      <td>
        <input type="time" value={l.fim || ''} onChange={mudar('fim')} aria-label="Fim" />
      </td>
      <td className="auto num">{dur === null ? '' : formatarDuracao(dur)}</td>
      <td>
        <input
          inputMode="numeric"
          className="num"
          value={l.previsto}
          placeholder={esperado ? num(esperado) : ''}
          title={esperado ? `Pela meta: ${num(meta)}/h × ${formatarDuracao(dur)} = ${num(esperado)} peças` : 'Sem meta/hora no cadastro: digite o previsto'}
          onChange={mudar('previsto')}
          aria-label="Previsto"
        />
      </td>
      <td>
        <input inputMode="numeric" className="num forte" value={l.realizado} onChange={mudar('realizado')} aria-label="Realizado" />
      </td>
      <td className={`auto num ${pctMeta === null ? '' : pctMeta >= 100 ? 'bom' : pctMeta < 70 ? 'ruim' : ''}`}>
        {pctMeta === null ? '' : `${pctMeta}%`}
      </td>
      <td>
        <input value={l.observacao || ''} onChange={mudar('observacao')} aria-label="Observação" />
      </td>
      <td className="acoes">
        {nova ? (
          <button className="botao primario pequeno" onClick={salvar} disabled={estado === 'salvando'}>
            {estado === 'salvando' ? 'Salvando…' : 'Adicionar'}
          </button>
        ) : (
          <>
            <span className={`status ${estado}`} title={msg || ''}>
              {estado === 'salvando' ? '…' : estado === 'salvo' ? '✓' : estado === 'erro' ? '!' : '•'}
            </span>
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
        <td colSpan={15}>⚠ {msg}</td>
      </tr>
    )}
    </>
  );
}

export default function Lancar({ dados, setDados }) {
  const [dia, setDia] = useState(isoLocal());
  const [chaveNova, setChaveNova] = useState(0);

  const produtos = useMemo(() => new Map(dados.produtos.map((p) => [Number(p.codigo), p])), [dados.produtos]);
  const listas = useMemo(
    () => ({
      maquinas: dados.maquinas.filter((m) => m.ativo).map((m) => m.nome),
      pessoas: dados.funcionarios.filter((f) => f.ativo).map((f) => f.nome).sort(),
    }),
    [dados.maquinas, dados.funcionarios],
  );

  const doDia = useMemo(
    () =>
      dados.apontamentos
        .filter((a) => a.data === dia)
        .sort((a, b) => (a.maquina + (a.inicio || '')).localeCompare(b.maquina + (b.inicio || '')) || a.id - b.id),
    [dados.apontamentos, dia],
  );

  const total = doDia.reduce((s, a) => s + (a.realizado || 0), 0);
  const minutos = doDia.reduce((s, a) => s + (duracaoMin(a.inicio, a.fim) || 0), 0);

  async function salvar(linha) {
    const salvo = await salvarApontamento(paraSalvar(linha, dia, produtos));
    setDados((d) => {
      const outros = d.apontamentos.filter((a) => a.id !== salvo.id);
      return { ...d, apontamentos: [...outros, salvo] };
    });
    return salvo;
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este apontamento?')) return;
    try {
      await excluirApontamento(id);
      setDados((d) => ({ ...d, apontamentos: d.apontamentos.filter((a) => a.id !== id) }));
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
    <section className="lancar">
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
            <strong>{num(total)}</strong> peças
          </span>
          <span>
            <strong>{formatarDuracao(minutos)}</strong> trabalhadas
          </span>
          <span>
            <strong>{doDia.length}</strong> {doDia.length === 1 ? 'apontamento' : 'apontamentos'}
          </span>
        </div>
      </div>

      <div className="grade-wrap">
        <table className="grade">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Máquina</th>
              <th style={{ width: 90 }}>Código</th>
              <th>Descrição</th>
              <th style={{ width: 110 }}>Família</th>
              <th style={{ width: 76 }}>Meta/h</th>
              <th style={{ width: 130 }}>Funcionária</th>
              <th style={{ width: 130 }}>Apoio</th>
              <th style={{ width: 92 }}>Início</th>
              <th style={{ width: 92 }}>Fim</th>
              <th style={{ width: 70 }}>Duração</th>
              <th style={{ width: 84 }}>Previsto</th>
              <th style={{ width: 90 }}>Realizado</th>
              <th style={{ width: 72 }} title="Realizado ÷ previsto pela meta">% meta</th>
              <th style={{ width: 160 }}>Observação</th>
              <th style={{ width: 96 }} aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {doDia.map((a) => (
              <Linha key={a.id} item={a} listas={listas} produtos={produtos} onSalvar={salvar} onExcluir={excluir} />
            ))}
            <Linha
              key={`nova-${chaveNova}`}
              nova
              item={{ ...VAZIO }}
              listas={listas}
              produtos={produtos}
              onSalvar={salvar}
              onExcluir={() => {}}
            />
          </tbody>
        </table>
      </div>
      <p className="dica">
        Preencha a última linha e aperte <kbd>Enter</kbd> para adicionar. Para corrigir, é só editar a célula: salva
        sozinho ao sair da linha. O <strong>Previsto</strong> em cinza é calculado pela meta/hora × tempo; digite outro número se a O.P. for diferente.
      </p>

      <datalist id="lista-produtos">
        {dados.produtos.map((p) => (
          <option key={p.codigo} value={p.codigo} label={p.descricao} />
        ))}
      </datalist>
    </section>
  );
}
