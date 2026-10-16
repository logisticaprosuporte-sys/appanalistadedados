import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MIN_APONT_CONFIAVEL, porColaboradora, produtosDaPessoa, ritmoDetalhado, semanasDaPessoa } from '../lib/indicadores.js';
import { capitalizar, dataCurta, formatarDuracao, inicioDaSemana, num } from '../lib/util.js';
import { Detalhes, Kpi, Manchete, pct, tomMeta } from './ui.jsx';

// Diferença menor que isso é considerada "na média" (variação normal do dia a dia)
const FAIXA_MEDIA = 5;

/** 1,12 → { texto: '12% acima', tom: 'bom' } */
function lerVs(v) {
  if (v === null || v === undefined) return null;
  const d = Math.round((v - 1) * 100);
  if (Math.abs(d) < FAIXA_MEDIA) return { d, texto: 'na média', tom: '' };
  return d > 0 ? { d, texto: `${d}% acima`, tom: 'bom' } : { d, texto: `${-d}% abaixo`, tom: 'ruim' };
}

function Vs({ v, cinza }) {
  const r = lerVs(v);
  if (!r) return <span className="mudo">—</span>;
  return (
    <span className={cinza ? 'mudo' : `txt-${r.tom}`}>
      {r.texto} {!cinza && r.tom === 'bom' ? '▲' : !cinza && r.tom === 'ruim' ? '▼' : ''}
    </span>
  );
}

const COLUNAS = [
  { id: 'nome', nome: 'Pessoa', texto: true },
  { id: 'n', nome: 'Apontamentos' },
  { id: 'tempoMedio', nome: 'Tempo médio', dica: 'Duração média de cada apontamento' },
  { id: 'minPorMil', nome: 'Minutos p/ 1.000 peças', dica: 'Quanto tempo leva para fazer 1.000 peças. Menor = mais rápido', menorMelhor: true },
  { id: 'porHora', nome: 'Peças por hora' },
  { id: 'pctMeta', nome: '% da meta', dica: 'Só nos produtos que têm meta/hora cadastrada' },
  { id: 'vsColegas', nome: 'Ritmo vs colegas', dica: 'Comparado com as outras pessoas fazendo os mesmos produtos' },
  { id: 'aproveitamento', nome: 'Dia aproveitado', dica: 'Quanto da jornada teve produção lançada' },
  { id: 'produtos', nome: 'Produtos' },
];

const COLUNAS_SIMPLES = [
  { id: 'nome', nome: 'Pessoa', texto: true },
  { id: 'minPorMil', nome: 'Minutos p/ 1.000 peças', menorMelhor: true },
  { id: 'tempoMedio', nome: 'Tempo médio por apontamento' },
  { id: 'vsColegas', nome: 'Comparado às colegas' },
];

export default function PainelColaboradoras({ lista, produtos, todos, tema, jornada = '08:48' }) {
  const [ordem, setOrdem] = useState({ col: 'n', desc: true });
  const [pessoa, setPessoa] = useState(null);

  const [jh, jm] = jornada.split(':').map(Number);
  const jornadaMin = jh * 60 + (jm || 0);
  const det = useMemo(() => ritmoDetalhado(todos), [todos]);
  const linhas = useMemo(() => porColaboradora(lista, produtos, det, jornadaMin), [lista, produtos, det, jornadaMin]);

  const ordenadas = useMemo(() => {
    const c = COLUNAS.find((x) => x.id === ordem.col);
    return [...linhas].sort((a, b) => {
      const va = a[ordem.col];
      const vb = b[ordem.col];
      if (va === null) return 1;
      if (vb === null) return -1;
      const r = c.texto ? String(va).localeCompare(String(vb)) : va - vb;
      return ordem.desc ? -r : r;
    });
  }, [linhas, ordem]);

  let min = 0;
  let pecas = 0;
  let n = 0;
  for (const l of linhas) {
    min += l.min;
    pecas += l.pecas;
    n += l.n;
  }
  const aprov = linhas.filter((l) => l.aproveitamento !== null);
  const aprovMedio = aprov.length ? aprov.reduce((s, l) => s + l.aproveitamento * l.dias, 0) / aprov.reduce((s, l) => s + l.dias, 0) : null;
  const jornadaTexto = `${jh}h${String(jm || 0).padStart(2, '0')}`;

  const atual = pessoa && linhas.find((l) => l.nome === pessoa);
  const maisRapida = linhas
    .filter((l) => l.comparado >= 0.3 && l.vsColegas !== null && l.vsColegas >= 1 + FAIXA_MEDIA / 100)
    .sort((a, b) => b.vsColegas - a.vsColegas)[0];

  return (
    <>
      <Manchete>
        Em média, a equipe leva <b>{pecas ? num((min / pecas) * 1000) : '—'} minutos para fazer 1.000 peças</b>.{' '}
        {maisRapida && (
          <span className="mudo">
            Destaque: {capitalizar(maisRapida.nome)}, {lerVs(maisRapida.vsColegas).texto} das colegas nos mesmos produtos.
          </span>
        )}
      </Manchete>

      <div className="kpis tres">
        <Kpi rotulo="Minutos para 1.000 peças" valor={pecas ? num((min / pecas) * 1000) : '—'} detalhe="quanto menor, mais rápido" />
        <Kpi rotulo="Tempo médio por apontamento" valor={formatarDuracao(n ? min / n : 0)} detalhe={`${num(n)} apontamentos`} />
        <Kpi rotulo="Dia aproveitado" valor={pct(aprovMedio)} detalhe={`do dia (${jornadaTexto}) com produção lançada`} />
      </div>

      <div className="cartao" style={{ marginBottom: 12 }}>
        <div className="cartao-topo">
          <h2>Cada pessoa</h2>
          <span className="mudo">Clique numa pessoa para ver mais</span>
        </div>
        <div className="tabela-wrap">
          <table className="ranking tabela-ordenavel">
            <thead>
              <tr>
                {COLUNAS_SIMPLES.map((c) => (
                  <th
                    key={c.id}
                    className={c.texto ? '' : 'num'}
                    onClick={() => setOrdem((o) => ({ col: c.id, desc: o.col === c.id ? !o.desc : !c.texto && !c.menorMelhor }))}
                  >
                    {c.nome}
                    {ordem.col === c.id ? (ordem.desc ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => (
                <tr key={l.nome} className={`clicavel ${pessoa === l.nome ? 'selecionada' : ''}`} onClick={() => setPessoa(pessoa === l.nome ? null : l.nome)}>
                  <td className="forte">{capitalizar(l.nome)}</td>
                  <td className="num">{l.minPorMil === null ? '—' : `${num(l.minPorMil)} min`}</td>
                  <td className="num">{formatarDuracao(l.tempoMedio)}</td>
                  <td className="num">{l.comparado < 0.3 ? <span className="mudo">pouco para comparar</span> : <Vs v={l.vsColegas} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dica">
          <b>Comparado às colegas</b>: no mesmo produto e no mesmo tempo, quem fez mais peças. "12% acima" = 12% mais peças.
        </p>
      </div>

      {atual && <DetalhePessoa pessoa={atual} lista={lista} det={det} tema={tema} onFechar={() => setPessoa(null)} />}

      <Detalhes titulo="Ver tabela completa">
        <div className="cartao">
          <div className="cartao-topo">
            <h2>Todos os números</h2>
            <span className="mudo">Jornada considerada: {jornadaTexto} (muda em Cadastros da produção)</span>
          </div>
          <div className="tabela-wrap">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th className="num">Apontamentos</th>
                  <th className="num">Peças por hora</th>
                  <th className="num">% da meta</th>
                  <th className="num">Dia aproveitado</th>
                  <th className="num">Produtos</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((l) => (
                  <tr key={l.nome}>
                    <td className="forte">{capitalizar(l.nome)}</td>
                    <td className="num">{l.n}</td>
                    <td className="num">{num(l.porHora)}</td>
                    <td className={`num txt-${tomMeta(l.pctMeta)}`}>{pct(l.pctMeta)}</td>
                    <td className="num">{pct(l.aproveitamento)}</td>
                    <td className="num">{l.produtos}</td>
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
function DetalhePessoa({ pessoa, lista, det, tema, onFechar }) {
  const nome = capitalizar(pessoa.nome);
  const semanas = useMemo(() => semanasDaPessoa(lista, pessoa.nome, det, inicioDaSemana), [lista, pessoa.nome, det]);
  const prods = useMemo(() => produtosDaPessoa(lista, pessoa.nome, det), [lista, pessoa.nome, det]);

  const confiaveis = prods.filter((p) => p.situacao === 'ok');
  const melhor = [...confiaveis].sort((a, b) => b.vsColegas - a.vsColegas)[0];
  const pior = [...confiaveis].sort((a, b) => a.vsColegas - b.vsColegas)[0];
  const geral = lerVs(pessoa.vsColegas);
  const soEla = prods.filter((p) => p.situacao === 'so-ela').length;

  // Eixo simétrico em volta da média (0%), com marcas redondas
  const maiorDif = Math.max(10, ...semanas.map((s) => Math.abs(s.diferenca)));
  const passo = maiorDif > 40 ? 20 : 10;
  const escala = Math.ceil(maiorDif / passo) * passo;
  const marcas = [];
  for (let v = -escala; v <= escala; v += passo) marcas.push(v);

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <h2>{nome}</h2>
        <span className="mudo">
          {pessoa.dias} dias · {pessoa.horasDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h lançadas por dia ·{' '}
          <button className="link" onClick={onFechar}>
            fechar
          </button>
        </span>
      </div>

      <div className="resumo-pessoa">
        {geral && pessoa.comparado >= 0.3 ? (
          <p>
            Nos mesmos produtos, <b>{nome}</b> ficou{' '}
            <b className={`txt-${geral.tom}`}>{geral.texto === 'na média' ? 'na média das colegas' : `${geral.texto} das colegas`}</b>{' '}
            no período.
            <span className="mudo"> (Deu para comparar {pct(pessoa.comparado)} do tempo trabalhado.)</span>
          </p>
        ) : (
          <p className="mudo">Ainda não há produtos suficientes feitos também por outras pessoas para comparar o ritmo de {nome}.</p>
        )}
        <div className="resumo-destaques">
          {melhor && melhor.vsColegas >= 1 + FAIXA_MEDIA / 100 && (
            <span className="selo selo-bom">
              ▲ Melhor produto: <b>{melhor.codigo}</b> {melhor.descricao.slice(0, 32)} ({lerVs(melhor.vsColegas).texto})
            </span>
          )}
          {pior && pior.vsColegas <= 1 - FAIXA_MEDIA / 100 && (
            <span className="selo selo-ruim">
              ▼ Precisa de atenção: <b>{pior.codigo}</b> {pior.descricao.slice(0, 32)} ({lerVs(pior.vsColegas).texto})
            </span>
          )}
          {soEla > 0 && (
            <span className="selo">
              {soEla} {soEla === 1 ? 'produto que só' : 'produtos que só'} {nome} fez — sem comparação
            </span>
          )}
        </div>
      </div>

      <Detalhes titulo="Ver semana a semana e produto a produto">
      <div className="graficos">
        <div>
          <h3 className="sub-titulo">Ritmo vs colegas, semana a semana</h3>
          <p className="dica" style={{ marginTop: 0 }}>
            Acima da linha = mais rápido que as colegas nos mesmos produtos. Abaixo = mais lento.
          </p>
          {semanas.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={semanas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={tema.grade} />
                <XAxis dataKey="semana" tickFormatter={dataCurta} tick={{ fill: tema.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: tema.grade }} minTickGap={16} />
                <YAxis
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                  tick={{ fill: tema.texto, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  domain={[-escala, escala]}
                  ticks={marcas}
                  interval={0}
                />
                <ReferenceLine y={0} stroke={tema.texto} strokeWidth={1.5} label={{ value: 'média das colegas', position: 'insideBottomRight', fill: tema.texto, fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const s = payload[0].payload;
                    const r = lerVs(1 + s.diferenca / 100);
                    return (
                      <div className="dica-grafico">
                        <div className="dica-titulo">Semana de {dataCurta(s.semana)}</div>
                        <div className={`txt-${r.tom}`}>
                          <strong>{r.texto}</strong> {r.texto !== 'na média' ? 'das colegas' : ''}
                        </div>
                        <div className="mudo">{formatarDuracao(s.min)} comparadas</div>
                      </div>
                    );
                  }}
                />
                <Line dataKey="diferenca" stroke={tema.destaque} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: tema.superficie }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="mudo">Precisa de pelo menos 2 semanas com produtos comparáveis no período.</p>
          )}
        </div>
        <div>
          <h3 className="sub-titulo">Produto a produto</h3>
          <p className="dica" style={{ marginTop: 0 }}>
            Minutos para fazer 1.000 peças. Em cinza: poucos dados (menos de {MIN_APONT_CONFIAVEL} apontamentos) ou produto que
            ninguém mais fez.
          </p>
          <div className="tabela-wrap">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Apont.</th>
                  <th className="num">{nome}</th>
                  <th className="num">Colegas</th>
                  <th className="num">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {prods.slice(0, 12).map((p) => (
                  <tr key={p.codigo} className={p.situacao !== 'ok' ? 'linha-cinza' : ''}>
                    <td title={p.descricao}>
                      <span className="mudo">{p.codigo}</span> {p.descricao.length > 26 ? p.descricao.slice(0, 26) + '…' : p.descricao}
                    </td>
                    <td className="num">{p.n}</td>
                    <td className="num">{p.minPorMil === null ? '—' : `${num(p.minPorMil)} min`}</td>
                    <td className="num" title={p.colegasPessoas ? `${p.colegasPessoas} ${p.colegasPessoas === 1 ? 'outra pessoa' : 'outras pessoas'}` : ''}>
                      {p.colegasMinPorMil === null ? '—' : `${num(p.colegasMinPorMil)} min`}
                    </td>
                    <td className="num">
                      {p.situacao === 'so-ela' ? (
                        <span className="mudo">só {nome} fez</span>
                      ) : p.situacao === 'poucos' ? (
                        <span className="mudo">poucos dados</span>
                      ) : (
                        <Vs v={p.vsColegas} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </Detalhes>
    </div>
  );
}
