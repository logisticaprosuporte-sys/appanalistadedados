import { useMemo, useRef, useState } from 'react';
import { excluirLinha, salvarLinha } from '../lib/db.js';
import { capitalizar, isoLocal, num } from '../lib/util.js';
import { Kpi } from './ui.jsx';

export const reais = (v) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const numOuNulo = (v) => {
  const t = String(v ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const paraCampo = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** Total = quantidade × (preço com desconto, se houver; senão o preço normal). */
export const totalCalculado = (qtd, valor, desconto) => {
  const preco = numOuNulo(desconto) ?? numOuNulo(valor);
  return Number(qtd) > 0 && preco !== null ? Math.round(Number(qtd) * preco * 100) / 100 : null;
};

const VAZIA = { data: '', tipo: '', quantidade: '', comprador: '', valor_unit: '', valor_desconto: '', total: '', observacao: '' };

function Linha({ item, nova, tipos, compradores, onSalvar, onExcluir }) {
  const [l, setL] = useState(() => ({
    ...VAZIA,
    ...item,
    quantidade: item.quantidade ?? '',
    valor_unit: paraCampo(item.valor_unit),
    valor_desconto: paraCampo(item.valor_desconto),
    total: nova ? '' : paraCampo(item.total),
  }));
  const [estado, setEstado] = useState(nova ? 'nova' : 'salvo');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);
  const auto = totalCalculado(l.quantidade, l.valor_unit, l.valor_desconto);

  const mudar = (campo) => (e) => {
    const v = e.target.value;
    setL((x) => {
      const n = { ...x, [campo]: v };
      // Ao escolher o tipo, sugere o preço cadastrado
      if (campo === 'tipo') {
        const t = tipos.find((t) => t.nome === v);
        if (t?.preco != null) n.valor_unit = paraCampo(t.preco);
      }
      return n;
    });
    if (!nova) setEstado('alterado');
    setMsg('');
  };

  async function salvar() {
    let problema = null;
    if (!l.data) problema = 'Escolha a data';
    else if (!l.tipo) problema = 'Escolha o tipo da caixa';
    else if (!(Number(l.quantidade) > 0)) problema = 'Digite a quantidade de caixas';
    else if (numOuNulo(l.valor_unit) === null) problema = 'Digite o valor da caixa';
    if (problema) {
      setEstado(nova ? 'nova' : 'erro');
      setMsg(problema);
      return;
    }
    setEstado('salvando');
    try {
      const salvo = await onSalvar({
        id: l.id,
        data: l.data,
        tipo: l.tipo,
        quantidade: Math.round(Number(l.quantidade)),
        comprador: l.comprador || 'NÃO INFORMADO',
        valor_unit: numOuNulo(l.valor_unit),
        valor_desconto: numOuNulo(l.valor_desconto),
        total: numOuNulo(l.total) ?? auto ?? 0,
        observacao: l.observacao || '',
      });
      if (nova) {
        setL({ ...VAZIA, data: l.data, comprador: l.comprador });
        setEstado('nova');
      } else {
        setL({ ...salvo, valor_unit: paraCampo(salvo.valor_unit), valor_desconto: paraCampo(salvo.valor_desconto), total: paraCampo(salvo.total) });
        setEstado('salvo');
      }
      setMsg('');
    } catch (e) {
      setEstado('erro');
      setMsg(e.message || 'Erro ao salvar');
    }
  }

  const opcoesTipo = [...new Set([...tipos.filter((t) => t.ativo).map((t) => t.nome), l.tipo].filter(Boolean))];
  const opcoesComprador = [...new Set([...compradores, l.comprador].filter(Boolean))];

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
          <input type="date" value={l.data} onChange={mudar('data')} aria-label="Data" />
        </td>
        <td>
          <select value={l.tipo} onChange={mudar('tipo')} aria-label="Tipo da caixa">
            <option value="">—</option>
            {opcoesTipo.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input inputMode="numeric" className="num forte" value={l.quantidade} onChange={mudar('quantidade')} aria-label="Quantidade de caixas" />
        </td>
        <td>
          <select value={l.comprador} onChange={mudar('comprador')} aria-label="Comprador">
            <option value="">Não informado</option>
            {opcoesComprador.map((c) => (
              <option key={c} value={c}>
                {capitalizar(c)}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input inputMode="decimal" className="num" value={l.valor_unit} onChange={mudar('valor_unit')} aria-label="Valor da caixa" />
        </td>
        <td>
          <input inputMode="decimal" className="num" value={l.valor_desconto} onChange={mudar('valor_desconto')} placeholder="sem" aria-label="Valor com desconto" />
        </td>
        <td>
          <input
            inputMode="decimal"
            className="num forte"
            value={l.total}
            onChange={mudar('total')}
            placeholder={auto !== null ? paraCampo(auto) : ''}
            title="Calculado sozinho (quantidade × preço). Digite outro valor se o total combinado foi diferente."
            aria-label="Total"
          />
        </td>
        <td>
          <input value={l.observacao || ''} onChange={mudar('observacao')} aria-label="Observação" />
        </td>
        <td className="acoes">
          {nova ? (
            <button className="botao primario pequeno" onClick={salvar} disabled={estado === 'salvando'}>
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

const nomeMes = (ym) => {
  const [a, m] = ym.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function VendaCaixas({ dados, setDados }) {
  const [mes, setMes] = useState(isoLocal().slice(0, 7));
  const [chaveNova, setChaveNova] = useState(0);
  const tipos = dados.tipos_caixa || [];
  const compradores = useMemo(() => (dados.compradores || []).filter((c) => c.ativo).map((c) => c.nome).sort(), [dados.compradores]);

  const doMes = useMemo(
    () => (dados.vendas_caixas || []).filter((v) => String(v.data).startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id),
    [dados.vendas_caixas, mes],
  );
  const caixas = doMes.reduce((s, v) => s + (v.quantidade || 0), 0);
  const valor = doMes.reduce((s, v) => s + (Number(v.total) || 0), 0);

  const atualizar = (salvo) => setDados((d) => ({ ...d, vendas_caixas: [...(d.vendas_caixas || []).filter((x) => x.id !== salvo.id), salvo] }));
  const salvar = async (v) => {
    const s = await salvarLinha('vendas_caixas', v);
    atualizar(s);
    return s;
  };
  async function excluir(id) {
    if (!window.confirm('Excluir esta venda?')) return;
    try {
      await excluirLinha('vendas_caixas', id);
      setDados((d) => ({ ...d, vendas_caixas: d.vendas_caixas.filter((x) => x.id !== id) }));
    } catch (e) {
      window.alert('Não foi possível excluir: ' + (e.message || e));
    }
  }

  const trocarMes = (delta) => {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setChaveNova((k) => k + 1);
  };
  const hojeMes = isoLocal().slice(0, 7);
  const dataPadrao = mes === hojeMes ? isoLocal() : `${mes}-01`;

  return (
    <section className="vendas-caixas">
      <div className="barra-dia">
        <div className="seletor-dia">
          <button className="botao" onClick={() => trocarMes(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <input type="month" value={mes} onChange={(e) => e.target.value && (setMes(e.target.value), setChaveNova((k) => k + 1))} aria-label="Mês" />
          <button className="botao" onClick={() => trocarMes(1)} aria-label="Próximo mês">
            ›
          </button>
          {mes !== hojeMes && (
            <button className="botao" onClick={() => (setMes(hojeMes), setChaveNova((k) => k + 1))}>
              Este mês
            </button>
          )}
          <span className="dia-extenso">{nomeMes(mes)}</span>
        </div>
      </div>

      <div className="kpis tres">
        <Kpi rotulo="Caixas vendidas no mês" valor={num(caixas)} detalhe={`${doMes.length} ${doMes.length === 1 ? 'venda' : 'vendas'}`} />
        <Kpi rotulo="Valor vendido no mês" valor={reais(valor)} detalhe="soma dos totais" />
        <Kpi rotulo="Preço médio por caixa" valor={caixas ? reais(valor / caixas) : '—'} detalhe="valor ÷ caixas" />
      </div>

      <div className="grade-wrap">
        <table className="grade grade-caixas">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Data</th>
              <th style={{ width: 160 }}>Tipo da caixa</th>
              <th style={{ width: 80 }}>Qtd</th>
              <th style={{ width: 170 }}>Comprador</th>
              <th style={{ width: 96 }}>Valor/cx (R$)</th>
              <th style={{ width: 110 }}>Com desconto</th>
              <th style={{ width: 100 }}>Total (R$)</th>
              <th>Observação</th>
              <th style={{ width: 96 }} aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {doMes.map((v) => (
              <Linha key={v.id} item={v} tipos={tipos} compradores={compradores} onSalvar={salvar} onExcluir={excluir} />
            ))}
            <Linha key={`nova-${chaveNova}`} nova item={{ data: dataPadrao }} tipos={tipos} compradores={compradores} onSalvar={salvar} onExcluir={() => {}} />
          </tbody>
        </table>
      </div>
      <p className="dica">
        Escolha o tipo e o valor da caixa aparece sozinho. O <b>Total</b> é calculado (quantidade × preço com desconto, ou o
        preço normal); se o combinado foi outro valor, é só digitar. Comprador novo ou tipo de caixa novo: Recebimento →
        Cadastros do recebimento.
      </p>
      {doMes.length === 0 && <p className="mudo">Nenhuma venda em {nomeMes(mes).toLowerCase()} ainda.</p>}
    </section>
  );
}

