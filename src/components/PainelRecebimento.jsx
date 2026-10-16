import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTema } from '../lib/cores.js';
import { desdeQuando, ETAPAS, historicoDe, tempoPorEtapa } from '../lib/recebimento.js';
import { capitalizar, compacto, num } from '../lib/util.js';
import { intervalo, PERIODOS } from './Painel.jsx';
import { BarrasHorizontais, Detalhes, Kpi, Manchete } from './ui.jsx';
import { reais } from './VendaCaixas.jsx';

const DIAS_PARADO = 3;

function tempoTexto(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h`;
  const d = min / 60 / 24;
  return `${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${d < 1.05 ? 'dia' : 'dias'}`;
}

function FiltroPeriodo({ periodo, setPeriodo, de, setDe, ate, setAte }) {
  return (
    <>
      <label className="campo">
        <span>Período</span>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      {periodo === 'custom' && (
        <>
          <label className="campo">
            <span>De</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="campo">
            <span>Até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
        </>
      )}
    </>
  );
}

// ---------------- Aba Recebimento ----------------
function AbaRecebimento({ dados, ini, fim }) {
  const agora = new Date();
  const todos = dados.recebimentos || [];
  const doPeriodo = todos.filter((r) => r.data >= ini && r.data <= fim);
  const abertos = todos.filter((r) => r.situacao !== 'concluido');
  const parados = abertos.filter((r) => {
    const d = desdeQuando(r);
    return d && (agora - d) / 86400000 > DIAS_PARADO;
  });
  const pecas = doPeriodo.reduce((s, r) => s + (r.quantidade || 0), 0);
  const etiquetas = doPeriodo.reduce((s, r) => s + (r.etiquetas || 0), 0);

  // Tempo médio em cada etapa e do registro até entrar na linha
  const tempos = useMemo(() => {
    const soma = {};
    const n = {};
    const ateLinha = [];
    for (const r of doPeriodo) {
      const t = tempoPorEtapa(r, agora);
      for (const [k, v] of Object.entries(t)) {
        soma[k] = (soma[k] || 0) + v;
        n[k] = (n[k] || 0) + 1;
      }
      const h = historicoDe(r);
      const linha = h.find((x) => x.situacao === 'em_linha');
      if (h.length && linha) ateLinha.push((new Date(linha.em) - new Date(h[0].em)) / 60000);
    }
    const media = (k) => (n[k] ? soma[k] / n[k] : null);
    return { media, ateLinha: ateLinha.length ? ateLinha.reduce((s, x) => s + x, 0) / ateLinha.length : null };
  }, [doPeriodo]);

  const porEtapa = ETAPAS.slice(0, 4).map((e) => ({
    nome: e.id,
    rotulo: e.nome,
    valor: abertos.filter((r) => r.situacao === e.id).length,
    texto: String(abertos.filter((r) => r.situacao === e.id).length),
  }));

  const porFornecedor = useMemo(() => {
    const m = new Map();
    for (const r of doPeriodo) {
      const k = r.fornecedor || 'SEM FORNECEDOR';
      const g = m.get(k) || { nome: k, n: 0, pecas: 0 };
      g.n += 1;
      g.pecas += r.quantidade || 0;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [doPeriodo]);

  return (
    <>
      <Manchete>
        Entraram <b>{num(doPeriodo.length)} {doPeriodo.length === 1 ? 'mercadoria' : 'mercadorias'}</b> no período (
        {compacto(pecas)} peças).{' '}
        <span className="mudo">
          {abertos.length} em andamento agora
          {parados.length > 0 ? `, ${parados.length} parada${parados.length === 1 ? '' : 's'} há mais de ${DIAS_PARADO} dias.` : '.'}
        </span>
      </Manchete>

      <div className="kpis tres">
        <Kpi rotulo="Mercadorias recebidas" valor={num(doPeriodo.length)} detalhe={`${num(pecas)} peças · ${num(etiquetas)} etiquetas`} />
        <Kpi
          rotulo="Na quarentena agora"
          valor={num(abertos.filter((r) => r.situacao === 'quarentena').length)}
          detalhe={`em média ${tempoTexto(tempos.media('quarentena'))} na quarentena`}
        />
        <Kpi rotulo="Tempo até entrar na linha" valor={tempoTexto(tempos.ateLinha)} detalhe="da chegada até a linha de produção" />
      </div>

      <div className="cartao" style={{ marginBottom: 12 }}>
        <div className="cartao-topo">
          <h2>Onde estão as mercadorias agora</h2>
          <span className="mudo">Itens ainda não concluídos</span>
        </div>
        <BarrasHorizontais itens={porEtapa} />
        {parados.length > 0 && (
          <p className="aviso-inline">
            ⏳ Parados há mais de {DIAS_PARADO} dias:{' '}
            {parados
              .slice(0, 6)
              .map((r) => `${r.codigo} (${ETAPAS.find((e) => e.id === r.situacao)?.nome})`)
              .join(' · ')}
            {parados.length > 6 && ` e mais ${parados.length - 6}`}
          </p>
        )}
      </div>

      <Detalhes>
        <div className="graficos">
          <div className="cartao">
            <div className="cartao-topo">
              <h2>Tempo médio em cada etapa</h2>
            </div>
            <table className="ranking">
              <tbody>
                {ETAPAS.slice(0, 4).map((e) => (
                  <tr key={e.id}>
                    <td>{e.nome}</td>
                    <td className="num forte">{tempoTexto(tempos.media(e.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cartao">
            <div className="cartao-topo">
              <h2>Entradas por fornecedor</h2>
            </div>
            <table className="ranking">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th className="num">Entradas</th>
                  <th className="num">Peças</th>
                </tr>
              </thead>
              <tbody>
                {porFornecedor.slice(0, 10).map((g) => (
                  <tr key={g.nome}>
                    <td>{capitalizar(g.nome)}</td>
                    <td className="num">{g.n}</td>
                    <td className="num">{num(g.pecas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Detalhes>
    </>
  );
}

// ---------------- Aba Venda de caixas ----------------
function AbaCaixas({ dados, ini, fim, tema }) {
  const vendas = (dados.vendas_caixas || []).filter((v) => v.data >= ini && v.data <= fim);
  const caixas = vendas.reduce((s, v) => s + (v.quantidade || 0), 0);
  const valor = vendas.reduce((s, v) => s + (Number(v.total) || 0), 0);

  const agrupar = (chave) => {
    const m = new Map();
    for (const v of vendas) {
      const k = v[chave] || 'NÃO INFORMADO';
      const g = m.get(k) || { nome: k, caixas: 0, valor: 0, n: 0 };
      g.caixas += v.quantidade || 0;
      g.valor += Number(v.total) || 0;
      g.n += 1;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  };
  const porComprador = agrupar('comprador');
  const porTipo = agrupar('tipo');
  const porMes = useMemo(() => {
    const m = new Map();
    for (const v of vendas) {
      const k = String(v.data).slice(0, 7);
      m.set(k, (m.get(k) || 0) + (Number(v.total) || 0));
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, valor]) => ({ mes, valor }));
  }, [vendas]);
  const nomeMesCurto = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

  if (!vendas.length) return <div className="vazio">Nenhuma venda de caixas nesse período.</div>;

  return (
    <>
      <Manchete>
        Foram vendidas <b>{num(caixas)} caixas</b>, somando <b>{reais(valor)}</b>.{' '}
        {porComprador[0] && (
          <span className="mudo">
            Quem mais comprou: {capitalizar(porComprador[0].nome)} ({reais(porComprador[0].valor)}).
          </span>
        )}
      </Manchete>
      <div className="kpis tres">
        <Kpi rotulo="Caixas vendidas" valor={num(caixas)} detalhe={`${vendas.length} vendas`} />
        <Kpi rotulo="Valor vendido" valor={reais(valor)} detalhe="soma dos totais" />
        <Kpi rotulo="Preço médio por caixa" valor={caixas ? reais(valor / caixas) : '—'} detalhe="valor ÷ caixas" />
      </div>
      <div className="cartao" style={{ marginBottom: 12 }}>
        <div className="cartao-topo">
          <h2>Quem mais comprou</h2>
          <span className="mudo">Em reais, no período</span>
        </div>
        <BarrasHorizontais
          itens={porComprador.slice(0, 8).map((g) => ({ nome: g.nome, rotulo: capitalizar(g.nome), valor: g.valor, texto: reais(g.valor), titulo: `${num(g.caixas)} caixas` }))}
        />
      </div>
      <Detalhes>
        <div className="graficos">
          <div className="cartao">
            <div className="cartao-topo">
              <h2>Por tipo de caixa</h2>
            </div>
            <table className="ranking">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="num">Caixas</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {porTipo.map((g) => (
                  <tr key={g.nome}>
                    <td>{g.nome}</td>
                    <td className="num">{num(g.caixas)}</td>
                    <td className="num">{reais(g.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cartao">
            <div className="cartao-topo">
              <h2>Valor por mês</h2>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porMes} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={4}>
                <CartesianGrid vertical={false} stroke={tema.grade} />
                <XAxis dataKey="mes" tickFormatter={nomeMesCurto} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} />
                <YAxis tickFormatter={(v) => `R$ ${compacto(v)}`} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  cursor={{ fill: tema.grade, opacity: 0.5 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="dica-grafico">
                        <div className="dica-titulo">{nomeMesCurto(payload[0].payload.mes)}</div>
                        <strong>{reais(payload[0].payload.valor)}</strong>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="valor" fill={tema.destaque} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Detalhes>
    </>
  );
}

const ABAS = [
  { id: 'receb', nome: 'Recebimento' },
  { id: 'caixas', nome: 'Venda de caixas' },
];

export default function PainelRecebimento({ dados }) {
  const tema = useTema();
  const [aba, setAba] = useState('receb');
  const [periodo, setPeriodo] = useState('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [ini, fim] = intervalo(periodo, de, ate);

  return (
    <section className="painel">
      <div className="filtros">
        <FiltroPeriodo periodo={periodo} setPeriodo={setPeriodo} de={de} setDe={setDe} ate={ate} setAte={setAte} />
      </div>
      <div className="abas-painel" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => setAba(a.id)}>
            {a.nome}
          </button>
        ))}
      </div>
      {aba === 'receb' ? <AbaRecebimento dados={dados} ini={ini} fim={fim} /> : <AbaCaixas dados={dados} ini={ini} fim={fim} tema={tema} />}
    </section>
  );
}
