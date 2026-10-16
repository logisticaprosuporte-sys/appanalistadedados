import { useMemo, useRef, useState } from 'react';
import { excluirSaida, salvarSaida } from '../lib/db.js';
import { dataLonga, isoLocal, num, somarDias } from '../lib/util.js';
import { RodapeFolha } from './ui.jsx';

const agora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function Linha({ item, nova, produtos, onSalvar, onExcluir }) {
  const [l, setL] = useState(item);
  const [estado, setEstado] = useState(nova ? 'nova' : 'salvo');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);
  const produto = produtos.get(Number(l.codigo));

  const mudar = (campo) => (e) => {
    setL((x) => ({ ...x, [campo]: e.target.value }));
    if (!nova) setEstado('alterado');
    setMsg('');
  };

  async function salvar() {
    let problema = null;
    if (!l.codigo) problema = 'Digite o código';
    else if (!produto) problema = 'Código não cadastrado';
    else if (l.quantidade === '' || Number(l.quantidade) < 0) problema = 'Digite a quantidade';
    if (problema) {
      setEstado(nova ? 'nova' : 'erro');
      setMsg(problema);
      return;
    }
    setEstado('salvando');
    try {
      const salvo = await onSalvar({
        id: l.id,
        hora: l.hora || null,
        codigo: Number(l.codigo),
        descricao: produto.descricao,
        quantidade: Math.round(Number(l.quantidade)),
        observacao: l.observacao || '',
      });
      if (nova) {
        setL({ hora: agora(), codigo: '', quantidade: '', observacao: '' });
        setEstado('nova');
        setTimeout(() => ref.current?.querySelector('[data-campo="codigo"]')?.focus(), 0);
      } else {
        setL(salvo);
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
          <input type="time" value={l.hora || ''} onChange={mudar('hora')} aria-label="Hora" />
        </td>
        <td>
          <input
            data-campo="codigo"
            inputMode="numeric"
            list="lista-produtos-saida"
            value={l.codigo}
            onChange={mudar('codigo')}
            aria-label="Código"
            className={l.codigo && !produto ? 'invalido' : ''}
          />
        </td>
        <td className="auto descricao" title={produto?.descricao}>
          {produto ? produto.descricao : l.codigo ? <span className="erro-txt">não cadastrado</span> : ''}
        </td>
        <td className="auto">{produto?.endereco || ''}</td>
        <td>
          <input inputMode="numeric" className="num forte" value={l.quantidade} onChange={mudar('quantidade')} aria-label="Quantidade" />
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
          <td colSpan={7}>⚠ {msg}</td>
        </tr>
      )}
    </>
  );
}

export default function Saidas({ dados, setDados }) {
  const [dia, setDia] = useState(isoLocal());
  const [chaveNova, setChaveNova] = useState(0);
  const produtos = useMemo(() => new Map(dados.produtos.map((p) => [Number(p.codigo), p])), [dados.produtos]);

  const doDia = useMemo(
    () =>
      (dados.saidas || [])
        .filter((s) => s.data === dia)
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || '') || a.id - b.id),
    [dados.saidas, dia],
  );
  const total = doDia.reduce((s, x) => s + (x.quantidade || 0), 0);

  async function salvar(s) {
    const salvo = await salvarSaida({ ...s, data: dia });
    setDados((d) => ({ ...d, saidas: [...(d.saidas || []).filter((x) => x.id !== salvo.id), salvo] }));
    return salvo;
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta saída?')) return;
    try {
      await excluirSaida(id);
      setDados((d) => ({ ...d, saidas: d.saidas.filter((x) => x.id !== id) }));
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
    <section className="lancar impresso">
      <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>
      <div className="barra-dia nao-imprimir">
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
            <strong>{num(total)}</strong> peças saíram
          </span>
          <span>
            <strong>{doDia.length}</strong> {doDia.length === 1 ? 'saída' : 'saídas'}
          </span>
          <button className="botao" onClick={() => window.print()} disabled={!doDia.length}>
            Imprimir
          </button>
        </div>
      </div>

      <div className="grade-wrap nao-imprimir">
        <table className="grade grade-saidas">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Hora</th>
              <th style={{ width: 100 }}>Código</th>
              <th>Descrição</th>
              <th style={{ width: 110 }}>Endereço</th>
              <th style={{ width: 110 }}>Quantidade</th>
              <th style={{ width: 200 }}>Observação</th>
              <th style={{ width: 96 }} aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {doDia.map((s) => (
              <Linha key={s.id} item={s} produtos={produtos} onSalvar={salvar} onExcluir={excluir} />
            ))}
            <Linha
              key={`nova-${chaveNova}`}
              nova
              item={{ hora: agora(), codigo: '', quantidade: '', observacao: '' }}
              produtos={produtos}
              onSalvar={salvar}
              onExcluir={() => {}}
            />
          </tbody>
        </table>
      </div>
      <p className="dica nao-imprimir">
        Digite o código e a quantidade e aperte <kbd>Enter</kbd>. A hora já vem preenchida com a hora atual.
      </p>

      {/* Versão para impressão */}
      <div className="folha so-imprimir">
        <table className="ficha lista">
          <thead>
            <tr>
              <th colSpan={4} className="ficha-titulo">
                CONTROLE DE SAÍDAS · {dataBR(dia)}
              </th>
            </tr>
            <tr className="ficha-cab">
              <th style={{ width: '14%' }}>Hora</th>
              <th style={{ width: '14%' }}>Código</th>
              <th>Descrição</th>
              <th style={{ width: '16%' }}>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {doDia.map((s) => (
              <tr key={s.id}>
                <td>{s.hora}</td>
                <td>{s.codigo}</td>
                <td>{s.descricao}</td>
                <td className="num">{num(s.quantidade)}</td>
              </tr>
            ))}
            <tr>
              <th colSpan={3} className="num">
                Total
              </th>
              <td className="num forte">{num(total)}</td>
            </tr>
          </tbody>
        </table>
        <RodapeFolha />
      </div>

      <datalist id="lista-produtos-saida">
        {dados.produtos.map((p) => (
          <option key={p.codigo} value={p.codigo} label={p.descricao} />
        ))}
      </datalist>
    </section>
  );
}
