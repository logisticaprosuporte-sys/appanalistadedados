import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resumoSetupPorMaquina, TROCA_MAX_MIN, trocasDeProduto } from '../lib/indicadores.js';
import { capitalizar, dataCurta, formatarDuracao, inicioDaSemana, num } from '../lib/util.js';
import { BarrasHorizontais, Detalhes, Kpi, Manchete, pct } from './ui.jsx';

export default function PainelSetup({ lista, tema, coresMaquina }) {
  const trocas = useMemo(() => trocasDeProduto(lista), [lista]);
  const maquinas = useMemo(() => resumoSetupPorMaquina(lista, trocas), [lista, trocas]);

  const total = trocas.reduce((s, t) => s + t.min, 0);
  const minProducao = maquinas.reduce((s, m) => s + m.minProducao, 0);
  const diasMaquina = maquinas.reduce((s, m) => s + m.dias, 0);

  // Tempo médio de troca por semana, uma linha por máquina
  const nomes = maquinas.map((m) => m.nome);
  const semanas = useMemo(() => {
    const m = new Map();
    for (const t of trocas) {
      const k = inicioDaSemana(t.data);
      const g = m.get(k) || { semana: k };
      g[`${t.maquina}_s`] = (g[`${t.maquina}_s`] || 0) + t.min;
      g[`${t.maquina}_n`] = (g[`${t.maquina}_n`] || 0) + 1;
      m.set(k, g);
    }
    return [...m.values()]
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .map((g) => {
        const o = { semana: g.semana };
        for (const n of nomes) if (g[`${n}_n`]) o[n] = Math.round(g[`${n}_s`] / g[`${n}_n`]);
        return o;
      });
  }, [trocas, nomes.join('|')]);

  const maisDemoradas = useMemo(() => [...trocas].sort((a, b) => b.min - a.min).slice(0, 10), [trocas]);
  const custoPorProduto = useMemo(() => {
    const m = new Map();
    for (const t of trocas) {
      const g = m.get(t.para) || { codigo: t.para, descricao: t.paraDescricao, n: 0, min: 0, maquinas: new Set() };
      g.n += 1;
      g.min += t.min;
      g.maquinas.add(t.maquina);
      m.set(t.para, g);
    }
    return [...m.values()]
      .filter((g) => g.n >= 2)
      .map((g) => ({ ...g, medio: g.min / g.n }))
      .sort((a, b) => b.min - a.min)
      .slice(0, 10);
  }, [trocas]);

  if (!maquinas.length) {
    return <div className="vazio">Nenhum apontamento de máquina (Joana, Joaquina, Julia) nesse período/filtro.</div>;
  }

  return (
    <>
      <Manchete>
        As máquinas trocaram de produto <b>{num(trocas.length)} vezes</b> e ficaram <b>{formatarDuracao(total)} paradas</b>{' '}
        trocando.{' '}
        <span className="mudo">Em média, {trocas.length ? formatarDuracao(total / trocas.length) : '—'} por troca.</span>
      </Manchete>

      <div className="kpis tres">
        <Kpi rotulo="Trocas de produto" valor={num(trocas.length)} detalhe={`cerca de ${(diasMaquina ? trocas.length / diasMaquina : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por máquina por dia`} />
        <Kpi rotulo="Tempo médio por troca" valor={trocas.length ? formatarDuracao(total / trocas.length) : '—'} detalhe="quanto menor, melhor" />
        <Kpi rotulo="Tempo parado trocando" valor={formatarDuracao(total)} detalhe={`${pct(total + minProducao ? total / (total + minProducao) : null, 1)} do tempo das máquinas`} />
      </div>

      <div className="cartao" style={{ marginBottom: 12 }}>
        <div className="cartao-topo">
          <h2>Tempo médio de cada troca, por máquina</h2>
          <span className="mudo">Quanto menor, melhor</span>
        </div>
        <BarrasHorizontais
          itens={maquinas
            .filter((m) => m.medio !== null)
            .map((m) => ({ nome: m.nome, rotulo: capitalizar(m.nome), valor: m.medio, texto: formatarDuracao(m.medio) }))}
        />
      </div>

      <Detalhes>
      <div className="cartao" style={{ marginBottom: 12 }}>
        <div className="cartao-topo">
          <h2>Por máquina</h2>
        </div>
        <div className="tabela-wrap">
          <table className="ranking">
            <thead>
              <tr>
                <th>Máquina</th>
                <th className="num">Dias</th>
                <th className="num">Trocas</th>
                <th className="num">Trocas/dia</th>
                <th className="num">Tempo médio</th>
                <th className="num">Maior troca</th>
                <th className="num">Total parado</th>
                <th className="num">% em setup</th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map((m) => (
                <tr key={m.nome}>
                  <td className="forte">
                    <span className="bolinha" style={{ background: coresMaquina.get(m.nome) || tema.outros }} />
                    {capitalizar(m.nome)}
                  </td>
                  <td className="num">{m.dias}</td>
                  <td className="num">{m.trocas}</td>
                  <td className="num">{m.porDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="num forte">{m.medio === null ? '—' : formatarDuracao(m.medio)}</td>
                  <td className="num">{m.maior ? formatarDuracao(m.maior) : '—'}</td>
                  <td className="num">{formatarDuracao(m.total)}</td>
                  <td className="num">{pct(m.pctSetup, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {semanas.length > 1 && (
        <div className="cartao" style={{ marginBottom: 12 }}>
          <div className="cartao-topo">
            <h2>Tempo médio de troca por semana (minutos)</h2>
            <span className="mudo">Linha descendo = trocas ficando mais rápidas</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={semanas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={tema.grade} />
              <XAxis dataKey="semana" tickFormatter={dataCurta} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} minTickGap={16} />
              <YAxis tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="dica-grafico">
                      <div className="dica-titulo">Semana de {dataCurta(label)}</div>
                      {payload.map((p) => (
                        <div key={p.dataKey}>
                          <span className="bolinha" style={{ background: p.color }} />
                          {capitalizar(p.dataKey)}: <strong>{p.value} min</strong>
                        </div>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Legend formatter={(v) => <span style={{ color: tema.texto }}>{capitalizar(v)}</span>} />
              {nomes.map((n) => (
                <Line key={n} dataKey={n} stroke={coresMaquina.get(n) || tema.outros} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: tema.superficie }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="graficos">
        <div className="cartao">
          <div className="cartao-topo">
            <h2>Trocas mais demoradas</h2>
          </div>
          <div className="tabela-wrap">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Máquina</th>
                  <th>Saiu → entrou</th>
                  <th className="num">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {maisDemoradas.map((t, i) => (
                  <tr key={i}>
                    <td>{dataCurta(t.data)}</td>
                    <td>{capitalizar(t.maquina)}</td>
                    <td title={`${t.deDescricao} → ${t.paraDescricao}`}>
                      {t.de} → <strong>{t.para}</strong>
                      <div className="mudo pequeno">{t.paraDescricao}</div>
                    </td>
                    <td className="num forte">{formatarDuracao(t.min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="cartao">
          <div className="cartao-topo">
            <h2>Produtos que mais custam setup</h2>
            <span className="mudo">Tempo de troca para colocar o produto na máquina</span>
          </div>
          <div className="tabela-wrap">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Produto que entrou</th>
                  <th className="num">Trocas</th>
                  <th className="num">Média</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {custoPorProduto.map((g) => (
                  <tr key={g.codigo}>
                    <td>
                      <strong>{g.codigo}</strong>
                      <div className="mudo pequeno">{g.descricao}</div>
                    </td>
                    <td className="num">{g.n}</td>
                    <td className="num">{formatarDuracao(g.medio)}</td>
                    <td className="num forte">{formatarDuracao(g.min)}</td>
                  </tr>
                ))}
                {custoPorProduto.length === 0 && (
                  <tr>
                    <td colSpan={4} className="mudo">
                      Poucas trocas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="dica">
        Como é calculado: na mesma máquina e no mesmo dia, quando muda o produto, o tempo entre o fim do anterior e o início
        do próximo conta como troca/setup. Intervalos acima de {TROCA_MAX_MIN} min ou que passam pelo almoço não entram (são
        pausa).
      </p>
      </Detalhes>
    </>
  );
}
