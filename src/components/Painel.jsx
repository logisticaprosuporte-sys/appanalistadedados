import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTema } from '../lib/cores.js';
import { parametro } from '../lib/db.js';
import PainelMeta from './PainelMeta.jsx';
import PainelColaboradoras from './PainelColaboradoras.jsx';
import PainelSetup from './PainelSetup.jsx';
import { capitalizar, compacto, dataCurta, dataLonga, duracaoMin, formatarDuracao, isoLocal, num, somarDias } from '../lib/util.js';

export const PERIODOS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: '7d', nome: 'Últimos 7 dias' },
  { id: '30d', nome: 'Últimos 30 dias' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'mespassado', nome: 'Mês passado' },
  { id: 'ano', nome: 'Este ano' },
  { id: 'tudo', nome: 'Tudo' },
  { id: 'custom', nome: 'Escolher datas…' },
];

const DIMENSOES = [
  { id: 'maquina', nome: 'Máquina', plural: 'máquina' },
  { id: 'pessoa', nome: 'Funcionária', plural: 'funcionária' },
  { id: 'familia', nome: 'Família', plural: 'família' },
];

const MAX_FATIAS = 5;

const ABAS_PAINEL = [
  { id: 'geral', nome: 'Visão geral' },
  { id: 'meta', nome: 'Meta/hora' },
  { id: 'colab', nome: 'Colaboradoras' },
  { id: 'setup', nome: 'Máquinas & setup' },
];

export function intervalo(periodo, de, ate) {
  const hoje = isoLocal();
  const [a, m] = hoje.split('-');
  switch (periodo) {
    case 'hoje':
      return [hoje, hoje];
    case '7d':
      return [somarDias(hoje, -6), hoje];
    case '30d':
      return [somarDias(hoje, -29), hoje];
    case 'mes':
      return [`${a}-${m}-01`, hoje];
    case 'mespassado': {
      const ini = isoLocal(new Date(Number(a), Number(m) - 2, 1));
      return [ini, somarDias(`${a}-${m}-01`, -1)];
    }
    case 'ano':
      return [`${a}-01-01`, hoje];
    case 'custom':
      return [de || '0000-01-01', ate || '9999-12-31'];
    default:
      return ['0000-01-01', '9999-12-31'];
  }
}

function agrupar(lista, chave) {
  const m = new Map();
  for (const a of lista) {
    const k = a[chave] || '—';
    const g = m.get(k) || { nome: k, pecas: 0, min: 0, pecasComTempo: 0, n: 0 };
    g.pecas += a.realizado || 0;
    g.n += 1;
    const d = duracaoMin(a.inicio, a.fim);
    if (d) {
      g.min += d;
      g.pecasComTempo += a.realizado || 0;
    }
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, porHora: g.min ? (g.pecasComTempo / g.min) * 60 : null }))
    .sort((x, y) => y.pecas - x.pecas);
}

// Segunda-feira da semana da data
function semanaDe(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  return somarDias(iso, -dow);
}

function Kpi({ rotulo, valor, detalhe }) {
  return (
    <div className="kpi">
      <span className="kpi-rotulo">{rotulo}</span>
      <span className="kpi-valor">{valor}</span>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  );
}

function DicaGrafico({ active, payload, rotulo }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dica-grafico">
      <div className="dica-titulo">{rotulo(p)}</div>
      <div>
        <strong>{num(p.pecas)}</strong> peças
      </div>
      {p.pct !== undefined && <div className="mudo">{p.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total</div>}
    </div>
  );
}

export default function Painel({ dados }) {
  const tema = useTema();
  const [periodo, setPeriodo] = useState('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [maquina, setMaquina] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [familia, setFamilia] = useState('');
  const [dimensao, setDimensao] = useState('maquina');
  const [aba, setAba] = useState('geral');
  const produtosMap = useMemo(() => new Map(dados.produtos.map((p) => [Number(p.codigo), p])), [dados.produtos]);

  const todos = dados.apontamentos;
  const maquinas = useMemo(() => dados.maquinas.map((m) => m.nome), [dados.maquinas]);
  const pessoas = useMemo(() => [...new Set(todos.map((a) => a.pessoa))].filter(Boolean).sort(), [todos]);
  const familias = useMemo(() => [...new Set(todos.map((a) => a.familia))].filter(Boolean).sort(), [todos]);

  // Cor fixa por entidade: ordem de cadastro para máquinas, ranking geral para as outras
  const coresPorDimensao = useMemo(() => {
    const mapa = (nomes) => new Map(nomes.slice(0, tema.series.length).map((n, i) => [n, tema.series[i]]));
    return {
      maquina: mapa(maquinas),
      pessoa: mapa(agrupar(todos, 'pessoa').map((g) => g.nome)),
      familia: mapa(agrupar(todos, 'familia').map((g) => g.nome)),
    };
  }, [todos, maquinas, tema]);

  const [ini, fim] = intervalo(periodo, de, ate);
  const filtrados = useMemo(
    () =>
      todos.filter(
        (a) =>
          a.data >= ini &&
          a.data <= fim &&
          (!maquina || a.maquina === maquina) &&
          (!pessoa || a.pessoa === pessoa) &&
          (!familia || a.familia === familia),
      ),
    [todos, ini, fim, maquina, pessoa, familia],
  );

  // Para a mensagem de "vazio": último dia com lançamento nesses filtros (sem olhar o período)
  const ultimoLancamento = useMemo(() => {
    if (filtrados.length) return null;
    let ultimo = '';
    for (const a of todos) {
      if ((!maquina || a.maquina === maquina) && (!pessoa || a.pessoa === pessoa) && (!familia || a.familia === familia) && a.data > ultimo) {
        ultimo = a.data;
      }
    }
    return ultimo || null;
  }, [filtrados.length, todos, maquina, pessoa, familia]);

  // Barras: por dia (ou por semana quando o período é longo)
  const porSemana = useMemo(() => {
    if (!filtrados.length) return false;
    const primeiro = filtrados.reduce((m, a) => (a.data < m ? a.data : m), filtrados[0].data);
    const ultimo = filtrados.reduce((m, a) => (a.data > m ? a.data : m), filtrados[0].data);
    const [a1, m1, d1] = primeiro.split('-').map(Number);
    const [a2, m2, d2] = ultimo.split('-').map(Number);
    return (new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000 > 45;
  }, [filtrados]);
  const chaveBarra = (iso) => (porSemana ? semanaDe(iso) : iso);

  const barras = useMemo(() => {
    const m = new Map();
    for (const a of filtrados) {
      const k = chaveBarra(a.data);
      m.set(k, (m.get(k) || 0) + (a.realizado || 0));
    }
    return [...m.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([data, pecas]) => ({ data, pecas }));
  }, [filtrados, porSemana]);

  // Clique numa barra: números, pizza e ranking passam a mostrar só aquele dia/semana
  const [selecao, setSelecao] = useState(null);
  useEffect(() => setSelecao(null), [ini, fim, maquina, pessoa, familia]);
  const selecaoValida = selecao && barras.some((b) => b.data === selecao) ? selecao : null;
  const foco = useMemo(
    () => (selecaoValida ? filtrados.filter((a) => chaveBarra(a.data) === selecaoValida) : filtrados),
    [filtrados, selecaoValida, porSemana],
  );
  const rotuloSelecao = selecaoValida
    ? porSemana
      ? `semana de ${dataCurta(selecaoValida)}`
      : dataLonga(selecaoValida).toLowerCase()
    : null;
  const aoClicarGrafico = (e) => {
    const k = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.data;
    if (k) setSelecao((s) => (s === k ? null : k));
  };

  const total = foco.reduce((s, a) => s + (a.realizado || 0), 0);
  let minutos = 0;
  let pecasComTempo = 0;
  for (const a of foco) {
    const d = duracaoMin(a.inicio, a.fim);
    if (d) {
      minutos += d;
      pecasComTempo += a.realizado || 0;
    }
  }
  const porHora = minutos ? (pecasComTempo / minutos) * 60 : 0;
  const dias = new Set(foco.map((a) => a.data)).size;

  // Pizza: até 5 fatias + "Outros"
  const grupos = useMemo(() => agrupar(foco, dimensao), [foco, dimensao]);
  const fatias = useMemo(() => {
    const cores = coresPorDimensao[dimensao];
    const topo = grupos.slice(0, MAX_FATIAS).map((g) => ({ ...g, cor: cores.get(g.nome) || tema.outros }));
    const resto = grupos.slice(MAX_FATIAS);
    if (resto.length) {
      topo.push({ nome: `Outros (${resto.length})`, pecas: resto.reduce((s, g) => s + g.pecas, 0), cor: tema.outros });
    }
    return topo.map((f) => ({ ...f, pct: total ? (f.pecas / total) * 100 : 0 }));
  }, [grupos, dimensao, coresPorDimensao, tema, total]);

  const temFiltro = maquina || pessoa || familia;
  const dimAtual = DIMENSOES.find((d) => d.id === dimensao);
  const maiorGrupo = grupos[0]?.pecas || 1;

  return (
    <section className="painel">
      <div className="filtros">
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
        <div className="campo">
          <span>Máquina</span>
          <div className="chips" role="group" aria-label="Máquina">
            <button className={!maquina ? 'chip ativo' : 'chip'} onClick={() => setMaquina('')}>
              Todas
            </button>
            {maquinas.map((m) => (
              <button key={m} className={maquina === m ? 'chip ativo' : 'chip'} onClick={() => setMaquina(maquina === m ? '' : m)}>
                {capitalizar(m)}
              </button>
            ))}
          </div>
        </div>
        <label className="campo">
          <span>Funcionária</span>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            <option value="">Todas</option>
            {pessoas.map((p) => (
              <option key={p} value={p}>
                {capitalizar(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Família</span>
          <select value={familia} onChange={(e) => setFamilia(e.target.value)}>
            <option value="">Todas</option>
            {familias.map((f) => (
              <option key={f} value={f}>
                {capitalizar(f)}
              </option>
            ))}
          </select>
        </label>
        {temFiltro && (
          <button
            className="botao fantasma"
            onClick={() => {
              setMaquina('');
              setPessoa('');
              setFamilia('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="abas-painel" role="tablist" aria-label="Seções do painel">
        {ABAS_PAINEL.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => setAba(a.id)}>
            {a.nome}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <>
      {selecaoValida && (
        <div className="selecao">
          <span>
            Mostrando só <strong>{rotuloSelecao}</strong>
          </span>
          <button className="botao pequeno" onClick={() => setSelecao(null)}>
            Ver período todo ✕
          </button>
        </div>
      )}

      <div className="kpis">
        <Kpi rotulo="Peças produzidas" valor={compacto(total)} detalhe={total >= 10_000 ? `${num(total)} peças` : null} />
        <Kpi rotulo="Peças por hora" valor={num(porHora)} detalhe="ritmo médio" />
        <Kpi rotulo="Horas trabalhadas" valor={formatarDuracao(minutos)} detalhe={`em ${dias} ${dias === 1 ? 'dia' : 'dias'}`} />
        <Kpi rotulo="Média por dia" valor={compacto(dias ? total / dias : 0)} detalhe="peças" />
      </div>

      {filtrados.length === 0 ? (
        <div className="vazio">
          {ultimoLancamento ? (
            <>
              <p style={{ margin: '0 0 12px' }}>
                Nada lançado {periodo === 'custom' ? 'nessas datas' : `em "${PERIODOS.find((p) => p.id === periodo)?.nome.toLowerCase()}"`}
                {[maquina && capitalizar(maquina), pessoa && capitalizar(pessoa), familia && capitalizar(familia)].filter(Boolean).length > 0 &&
                  ` para ${[maquina && capitalizar(maquina), pessoa && capitalizar(pessoa), familia && capitalizar(familia)].filter(Boolean).join(' · ')}`}
                . O último lançamento foi em <strong>{dataLonga(ultimoLancamento).toLowerCase()}</strong>.
              </p>
              <button
                className="botao"
                onClick={() => {
                  setDe(somarDias(ultimoLancamento, -29));
                  setAte(ultimoLancamento);
                  setPeriodo('custom');
                }}
              >
                Ver os 30 dias até {dataCurta(ultimoLancamento)}
              </button>
            </>
          ) : (
            'Nenhum apontamento com esses filtros.'
          )}
        </div>
      ) : (
        <>
          <div className="graficos">
            <div className="cartao">
              <div className="cartao-topo">
                <h2>
                  Comparativo por {dimAtual.plural}
                  {selecaoValida && <span className="mudo"> · {porSemana ? rotuloSelecao : dataCurta(selecaoValida)}</span>}
                </h2>
                <div className="segmentado" role="group" aria-label="Comparar por">
                  {DIMENSOES.map((d) => (
                    <button key={d.id} className={dimensao === d.id ? 'ativo' : ''} onClick={() => setDimensao(d.id)}>
                      {d.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pizza">
                <div className="pizza-grafico">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={fatias}
                        dataKey="pecas"
                        nameKey="nome"
                        innerRadius="62%"
                        outerRadius="96%"
                        startAngle={90}
                        endAngle={-270}
                        stroke={tema.superficie}
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {fatias.map((f) => (
                          <Cell key={f.nome} fill={f.cor} />
                        ))}
                      </Pie>
                      <Tooltip content={<DicaGrafico rotulo={(p) => capitalizar(p.nome)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pizza-centro">
                    <strong>{compacto(total)}</strong>
                    <span>peças</span>
                  </div>
                </div>
                <ul className="legenda">
                  {fatias.map((f) => (
                    <li key={f.nome}>
                      <span className="bolinha" style={{ background: f.cor }} />
                      <span className="leg-nome">{capitalizar(f.nome)}</span>
                      <span className="leg-pct">{f.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>
                      <span className="leg-valor">{compacto(f.pecas)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="cartao">
              <div className="cartao-topo">
                <h2>Produção por {porSemana ? 'semana' : 'dia'}</h2>
                <span className="mudo">Clique numa barra para ver só {porSemana ? 'a semana' : 'o dia'}</span>
              </div>
              <ResponsiveContainer width="100%" height={260} className="grafico-clicavel">
                <BarChart
                  data={barras}
                  margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                  barCategoryGap={2}
                  onClick={aoClicarGrafico}
                >
                  <CartesianGrid vertical={false} stroke={tema.grade} />
                  <XAxis
                    dataKey="data"
                    tickFormatter={dataCurta}
                    tick={{ fill: tema.texto, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: tema.grade }}
                    minTickGap={16}
                  />
                  <YAxis
                    tickFormatter={compacto}
                    tick={{ fill: tema.texto, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: tema.grade, opacity: 0.5 }}
                    content={<DicaGrafico rotulo={(p) => (porSemana ? `Semana de ${dataCurta(p.data)}` : dataCurta(p.data))} />}
                  />
                  <Bar dataKey="pecas" fill={tema.destaque} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                    {barras.map((b) => (
                      <Cell
                        key={b.data}
                        fill={tema.destaque}
                        fillOpacity={selecaoValida && b.data !== selecaoValida ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="cartao">
            <div className="cartao-topo">
              <h2>Ranking por {dimAtual.plural}</h2>
              <span className="mudo">{grupos.length} no período</span>
            </div>
            <div className="tabela-wrap">
              <table className="ranking">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{dimAtual.nome}</th>
                    <th className="num">Peças</th>
                    <th className="barra-col" aria-hidden="true"></th>
                    <th className="num">Horas</th>
                    <th className="num">Peças/hora</th>
                    <th className="num">Apontamentos</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, i) => (
                    <tr key={g.nome}>
                      <td className="mudo">{i + 1}</td>
                      <td>
                        <span
                          className="bolinha"
                          style={{ background: coresPorDimensao[dimensao].get(g.nome) || tema.outros }}
                        />
                        {capitalizar(g.nome)}
                      </td>
                      <td className="num forte">{num(g.pecas)}</td>
                      <td className="barra-col">
                        <span className="barrinha" style={{ width: `${(g.pecas / maiorGrupo) * 100}%` }} />
                      </td>
                      <td className="num">{formatarDuracao(g.min)}</td>
                      <td className="num">{g.porHora ? num(g.porHora) : '—'}</td>
                      <td className="num">{g.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}

      {aba !== 'geral' && filtrados.length === 0 && <div className="vazio">Nenhum apontamento com esses filtros nesse período.</div>}
      {aba === 'meta' && filtrados.length > 0 && <PainelMeta lista={filtrados} produtos={produtosMap} todos={todos} tema={tema} />}
      {aba === 'colab' && filtrados.length > 0 && <PainelColaboradoras lista={filtrados} produtos={produtosMap} todos={todos} tema={tema} jornada={parametro(dados, 'jornada')} />}
      {aba === 'setup' && filtrados.length > 0 && (
        <PainelSetup lista={filtrados} tema={tema} coresMaquina={coresPorDimensao.maquina} />
      )}
    </section>
  );
}
