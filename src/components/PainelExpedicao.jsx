import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTema } from '../lib/cores.js';
import { capitalizar, compacto, dataCurta, duracaoMin, formatarDuracao, num } from '../lib/util.js';
import { intervalo, PERIODOS } from './Painel.jsx';
import { metaSeparacao } from './Separacao.jsx';
import { BarrasHorizontais, Detalhes, Kpi, Manchete, pct } from './ui.jsx';

function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function PainelExpedicao({ dados }) {
  const tema = useTema();
  const [periodo, setPeriodo] = useState('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [separador, setSeparador] = useState('');
  const meta = metaSeparacao(dados);

  const todas = dados.separacoes || [];
  const nomes = useMemo(() => [...new Set(todas.map((s) => s.separador))].sort(), [todas]);
  const emAndamento = todas.filter((s) => !s.fim).length;

  const [ini, fim] = intervalo(periodo, de, ate);
  const lista = useMemo(
    () =>
      todas
        .filter((s) => s.fim && s.data >= ini && s.data <= fim && (!separador || s.separador === separador))
        .map((s) => ({ ...s, min: duracaoMin(s.inicio, s.fim) }))
        .filter((s) => s.min !== null),
    [todas, ini, fim, separador],
  );

  // ---- números gerais ----
  const total = lista.length;
  const minutos = lista.reduce((s, x) => s + x.min, 0);
  const media = total ? minutos / total : null;
  const med = mediana(lista.map((x) => x.min));
  const noPrazo = total ? lista.filter((x) => x.min <= meta).length / total : null;
  const dias = new Set(lista.map((x) => x.data)).size;
  const comItens = lista.filter((x) => x.itens);
  const itensPorHora = comItens.length ? comItens.reduce((s, x) => s + x.itens, 0) / (comItens.reduce((s, x) => s + x.min, 0) / 60) : null;

  // ---- por separador ----
  const porSeparador = useMemo(() => {
    const m = new Map();
    for (const x of lista) {
      const g = m.get(x.separador) || { nome: x.separador, n: 0, min: 0, tempos: [], itens: 0, minItens: 0, noPrazo: 0 };
      g.n += 1;
      g.min += x.min;
      g.tempos.push(x.min);
      if (x.itens) {
        g.itens += x.itens;
        g.minItens += x.min;
      }
      if (x.min <= meta) g.noPrazo += 1;
      m.set(x.separador, g);
    }
    return [...m.values()]
      .map((g) => ({
        ...g,
        media: g.min / g.n,
        rapido: Math.min(...g.tempos),
        lento: Math.max(...g.tempos),
        itensHora: g.minItens ? g.itens / (g.minItens / 60) : null,
        pctPrazo: g.noPrazo / g.n,
      }))
      .sort((a, b) => a.media - b.media);
  }, [lista, meta]);

  // ---- detalhes ----
  const porDia = useMemo(() => {
    const m = new Map();
    for (const x of lista) m.set(x.data, (m.get(x.data) || 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, pedidos]) => ({ data, pedidos }));
  }, [lista]);
  const porHora = useMemo(() => {
    const m = new Map();
    for (const x of lista) {
      const h = Number(x.inicio.slice(0, 2));
      m.set(h, (m.get(h) || 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a - b).map(([h, pedidos]) => ({ hora: `${String(h).padStart(2, '0')}h`, pedidos }));
  }, [lista]);
  const maisDemorados = useMemo(() => [...lista].sort((a, b) => b.min - a.min).slice(0, 10), [lista]);
  const pico = porHora.reduce((m, h) => (!m || h.pedidos > m.pedidos ? h : m), null);

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
        <label className="campo">
          <span>Separador</span>
          <select value={separador} onChange={(e) => setSeparador(e.target.value)}>
            <option value="">Todos</option>
            {nomes.map((n) => (
              <option key={n} value={n}>
                {capitalizar(n)}
              </option>
            ))}
          </select>
        </label>
        <div className="campo">
          <span>Meta por pedido</span>
          <span className="meta-fixa" title="Para mudar: Expedição → Cadastros da expedição">{meta} min</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="vazio">
          Nenhuma separação finalizada nesse período{separador ? ` para ${capitalizar(separador)}` : ''}.
          {emAndamento > 0 && ` (${emAndamento} em andamento agora.)`}
        </div>
      ) : (
        <>
          <Manchete>
            Foram separados <b>{num(total)} {total === 1 ? 'pedido' : 'pedidos'}</b>, em média <b>{formatarDuracao(media)} cada</b>.{' '}
            <span className="mudo">
              {pct(noPrazo)} ficaram dentro da meta de {meta} min.
              {emAndamento > 0 && ` ${emAndamento} em separação agora.`}
            </span>
          </Manchete>

          <div className="kpis tres">
            <Kpi rotulo="Pedidos separados" valor={num(total)} detalhe={`média de ${(dias ? total / dias : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia`} />
            <Kpi rotulo="Tempo médio por pedido" valor={formatarDuracao(media)} detalhe={`metade dos pedidos levou até ${formatarDuracao(med)}`} />
            <Kpi
              rotulo={`Dentro da meta (${meta} min)`}
              valor={pct(noPrazo)}
              detalhe={`${num(Math.round(noPrazo * total))} de ${num(total)} pedidos`}
              tom={noPrazo >= 0.8 ? 'bom' : noPrazo >= 0.6 ? 'atencao' : 'ruim'}
            />
          </div>

          <div className="cartao" style={{ marginBottom: 12 }}>
            <div className="cartao-topo">
              <h2>Quanto tempo cada pessoa leva por pedido</h2>
              <span className="mudo">A risca preta é a meta ({meta} min) · verde = dentro da meta</span>
            </div>
            <BarrasHorizontais
              itens={porSeparador.map((g) => ({
                nome: g.nome,
                rotulo: capitalizar(g.nome),
                valor: g.media,
                texto: formatarDuracao(g.media),
                titulo: `${g.n} pedidos`,
                tom: g.media <= meta ? 'bom' : 'ruim',
              }))}
              referencia={meta}
              rotuloReferencia={`Meta: ${meta} min`}
            />
          </div>

          <Detalhes>
            <div className="cartao" style={{ marginBottom: 12 }}>
              <div className="cartao-topo">
                <h2>Por separador</h2>
              </div>
              <div className="tabela-wrap">
                <table className="ranking">
                  <thead>
                    <tr>
                      <th>Separador</th>
                      <th className="num">Pedidos</th>
                      <th className="num">Tempo médio</th>
                      <th className="num">Mais rápido</th>
                      <th className="num">Mais demorado</th>
                      <th className="num">Itens por hora</th>
                      <th className="num">Dentro da meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porSeparador.map((g) => (
                      <tr key={g.nome}>
                        <td className="forte">{capitalizar(g.nome)}</td>
                        <td className="num">{g.n}</td>
                        <td className={`num forte ${g.media <= meta ? 'txt-bom' : 'txt-ruim'}`}>{formatarDuracao(g.media)}</td>
                        <td className="num">{formatarDuracao(g.rapido)}</td>
                        <td className="num">{formatarDuracao(g.lento)}</td>
                        <td className="num">{g.itensHora ? num(g.itensHora) : '—'}</td>
                        <td className="num">{pct(g.pctPrazo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {itensPorHora && <p className="dica">Equipe: {num(itensPorHora)} itens separados por hora (nos pedidos em que os itens foram informados).</p>}
            </div>

            <div className="graficos">
              <div className="cartao">
                <div className="cartao-topo">
                  <h2>Pedidos separados por dia</h2>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porDia} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke={tema.grade} />
                    <XAxis dataKey="data" tickFormatter={dataCurta} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} minTickGap={16} />
                    <YAxis allowDecimals={false} tickFormatter={compacto} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      cursor={{ fill: tema.grade, opacity: 0.5 }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="dica-grafico">
                            <div className="dica-titulo">{dataCurta(payload[0].payload.data)}</div>
                            <strong>{payload[0].payload.pedidos}</strong> pedidos
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="pedidos" fill={tema.destaque} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="cartao">
                <div className="cartao-topo">
                  <h2>Horário com mais separações</h2>
                  {pico && <span className="mudo">Pico: {pico.hora}</span>}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porHora} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke={tema.grade} />
                    <XAxis dataKey="hora" tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} />
                    <YAxis allowDecimals={false} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      cursor={{ fill: tema.grade, opacity: 0.5 }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="dica-grafico">
                            <div className="dica-titulo">Iniciados às {payload[0].payload.hora}</div>
                            <strong>{payload[0].payload.pedidos}</strong> pedidos
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="pedidos" fill={tema.destaque} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="cartao">
              <div className="cartao-topo">
                <h2>Pedidos que mais demoraram</h2>
              </div>
              <div className="tabela-wrap">
                <table className="ranking">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Pedido</th>
                      <th>Separador</th>
                      <th className="num">Itens</th>
                      <th className="num">Tempo</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maisDemorados.map((x) => (
                      <tr key={x.id}>
                        <td>{dataCurta(x.data)}</td>
                        <td className="forte">{x.pedido}</td>
                        <td>{capitalizar(x.separador)}</td>
                        <td className="num">{x.itens ?? '—'}</td>
                        <td className={`num forte ${x.min <= meta ? '' : 'txt-ruim'}`}>{formatarDuracao(x.min)}</td>
                        <td className="mudo">{x.observacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Detalhes>
        </>
      )}
    </section>
  );
}
