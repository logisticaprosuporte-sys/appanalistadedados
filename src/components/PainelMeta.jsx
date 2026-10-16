import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { metaPor, resumoMeta, ritmoPorProduto } from '../lib/indicadores.js';
import { capitalizar, compacto, dataCurta, inicioDaSemana, num } from '../lib/util.js';
import { BarrasHorizontais, Detalhes, Kpi, Manchete, pct, ROTULO_TOM, tomMeta } from './ui.jsx';

const COR_TOM = { bom: '#0ca30c', atencao: '#e0a100', ruim: '#d03b3b' };

function Legenda() {
  return (
    <div className="legenda-tom">
      {Object.entries(ROTULO_TOM).map(([t, r]) => (
        <span key={t}>
          <span className="bolinha" style={{ background: COR_TOM[t] }} />
          {r} {t === 'bom' ? '(≥100%)' : t === 'atencao' ? '(80–99%)' : '(<80%)'}
        </span>
      ))}
    </div>
  );
}

export default function PainelMeta({ lista, produtos, todos, tema }) {
  const [verSemMeta, setVerSemMeta] = useState(false);
  const r = useMemo(() => resumoMeta(lista, produtos), [lista, produtos]);
  const ritmos = useMemo(() => ritmoPorProduto(todos), [todos]);

  // Por dia; quando o período passa de 45 dias, por semana
  const porSemana = useMemo(() => {
    const datas = lista.map((a) => a.data).sort();
    if (datas.length < 2) return false;
    const [a1, m1, d1] = datas[0].split('-').map(Number);
    const [a2, m2, d2] = datas[datas.length - 1].split('-').map(Number);
    return (new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000 > 45;
  }, [lista]);
  const porDia = useMemo(
    () =>
      metaPor(lista, produtos, porSemana ? (a) => inicioDaSemana(a.data) : 'data').sort((a, b) => a.nome.localeCompare(b.nome)),
    [lista, produtos, porSemana],
  );
  const porMaquina = useMemo(() => metaPor(lista, produtos, 'maquina').sort((a, b) => a.pct - b.pct), [lista, produtos]);
  const porFamilia = useMemo(() => metaPor(lista, produtos, 'familia').sort((a, b) => a.pct - b.pct), [lista, produtos]);
  const piores = useMemo(
    () =>
      metaPor(lista, produtos, 'codigo')
        .filter((g) => g.n >= 2)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 10),
    [lista, produtos],
  );

  const tom = tomMeta(r.pct);
  const barras = (lista) =>
    lista.map((g) => ({ nome: g.nome, rotulo: capitalizar(g.nome), valor: g.pct, texto: pct(g.pct), tom: tomMeta(g.pct) }));

  return (
    <>
      <Manchete>
        {r.pct === null ? (
          'Ainda não há produtos com meta/hora cadastrada nesse período.'
        ) : (
          <>
            A produção ficou em <b className={`txt-${tom}`}>{pct(r.pct)} da meta/hora</b>.{' '}
            <span className="mudo">
              Foram feitas {compacto(r.realizado)} peças; a meta pedia {compacto(r.esperado)}.
            </span>
          </>
        )}
      </Manchete>

      <div className="kpis tres">
        <Kpi rotulo="Da meta/hora" valor={pct(r.pct)} detalhe={tom ? ROTULO_TOM[tom] : 'sem meta cadastrada'} tom={tom} />
        <Kpi
          rotulo={r.diferenca >= 0 ? 'Peças acima da meta' : 'Peças que faltaram'}
          valor={compacto(Math.abs(r.diferenca))}
          detalhe="para bater a meta no período"
        />
        <div className="kpi">
          <span className="kpi-rotulo">Produtos sem meta</span>
          <span className="kpi-valor">{r.semMeta.length}</span>
          {r.semMeta.length > 0 ? (
            <button className="link" onClick={() => setVerSemMeta((v) => !v)}>
              {verSemMeta ? 'esconder lista' : 'ver quais são'}
            </button>
          ) : (
            <span className="kpi-detalhe">todos têm meta</span>
          )}
        </div>
      </div>

      {verSemMeta && (
        <div className="cartao" style={{ marginBottom: 12 }}>
          <div className="cartao-topo">
            <h2>Produtos sem meta/hora</h2>
            <span className="mudo">"Sugestão" = o ritmo que a equipe já faz nesse produto</span>
          </div>
          <div className="tabela-wrap">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className="num">Sugestão de meta/h</th>
                </tr>
              </thead>
              <tbody>
                {r.semMeta.map((p) => {
                  const h = ritmos.get(p.codigo);
                  return (
                    <tr key={p.codigo}>
                      <td className="num">{p.codigo}</td>
                      <td>{p.descricao}</td>
                      <td className="num forte">{h && h.n >= 3 ? num(h.mediana) : <span className="mudo">poucos dados</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="dica">Para cadastrar: Produção → Cadastros → clique no produto → Meta/hora.</p>
        </div>
      )}

      {porMaquina.length > 0 && (
        <div className="cartao" style={{ marginBottom: 12 }}>
          <div className="cartao-topo">
            <h2>Cada máquina, quanto da meta fez</h2>
            <span className="mudo">A risca preta é 100% da meta</span>
          </div>
          <BarrasHorizontais itens={barras([...porMaquina].reverse())} referencia={1} rotuloReferencia="100% da meta" />
        </div>
      )}

      {porDia.length > 0 && (
        <Detalhes>
          <div className="cartao" style={{ marginBottom: 12 }}>
            <div className="cartao-topo">
              <h2>% da meta por {porSemana ? 'semana' : 'dia'}</h2>
              <Legenda />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porDia} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={tema.grade} />
                <XAxis dataKey="nome" tickFormatter={dataCurta} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} minTickGap={16} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                <ReferenceLine y={1} stroke={tema.texto} strokeWidth={1.5} />
                <Tooltip
                  cursor={{ fill: tema.grade, opacity: 0.5 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="dica-grafico">
                        <div className="dica-titulo">
                          {porSemana ? 'Semana de ' : ''}
                          {dataCurta(payload[0].payload.nome)}
                        </div>
                        <strong>{pct(payload[0].payload.pct)}</strong> da meta
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                  {porDia.map((d) => (
                    <Cell key={d.nome} fill={COR_TOM[tomMeta(d.pct)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="graficos">
            <div className="cartao">
              <div className="cartao-topo">
                <h2>Por família</h2>
              </div>
              <BarrasHorizontais itens={barras([...porFamilia].reverse())} referencia={1} rotuloReferencia="100% da meta" />
            </div>
            <div className="cartao">
              <div className="cartao-topo">
                <h2>Produtos mais longe da meta</h2>
              </div>
              <table className="ranking">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Meta/h</th>
                    <th className="num">Fez/h</th>
                  </tr>
                </thead>
                <tbody>
                  {piores.map((g) => (
                    <tr key={g.nome} title={g.descricao}>
                      <td>
                        <span className="mudo">{g.nome}</span> {g.descricao.length > 24 ? g.descricao.slice(0, 24) + '…' : g.descricao}
                      </td>
                      <td className="num">{num(g.meta)}</td>
                      <td className={`num forte txt-${tomMeta(g.pct)}`}>{num(g.porHora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Detalhes>
      )}
    </>
  );
}