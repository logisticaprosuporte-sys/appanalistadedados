import { useMemo, useState } from 'react';
import { capitalizar, isoLocal, num } from '../lib/util.js';
import { RodapeFolha } from './ui.jsx';

const LINHAS_FOLHA = 25;

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function ControleDiario({ dados }) {
  const [dia, setDia] = useState(isoLocal());
  const [pessoa, setPessoa] = useState('');
  const [maquina, setMaquina] = useState('');
  const [preencher, setPreencher] = useState(true);

  const pessoas = useMemo(() => dados.funcionarios.filter((f) => f.ativo).map((f) => f.nome).sort(), [dados.funcionarios]);
  const maquinas = useMemo(() => dados.maquinas.filter((m) => m.ativo).map((m) => m.nome), [dados.maquinas]);

  const lancados = useMemo(
    () =>
      dados.apontamentos
        .filter((a) => a.data === dia && (!pessoa || a.pessoa === pessoa) && (!maquina || a.maquina === maquina))
        .sort((a, b) => (a.pessoa + (a.inicio || '')).localeCompare(b.pessoa + (b.inicio || ''))),
    [dados.apontamentos, dia, pessoa, maquina],
  );

  const linhas = preencher ? lancados : [];
  const vazias = Math.max(0, LINHAS_FOLHA - linhas.length);
  const total = linhas.reduce((s, a) => s + (a.realizado || 0), 0);

  return (
    <section className="impresso">
      <style>{'@page { size: A4 landscape; margin: 0; }'}</style>
      <div className="filtros nao-imprimir">
        <label className="campo">
          <span>Dia</span>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
        </label>
        <label className="campo">
          <span>Funcionária</span>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            <option value="">Todas</option>
            {pessoas.map((n) => (
              <option key={n} value={n}>
                {capitalizar(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Máquina</span>
          <select value={maquina} onChange={(e) => setMaquina(e.target.value)}>
            <option value="">Todas</option>
            {maquinas.map((m) => (
              <option key={m} value={m}>
                {capitalizar(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-check">
          <input type="checkbox" checked={preencher} onChange={(e) => setPreencher(e.target.checked)} />
          Preencher com o que já foi lançado ({lancados.length})
        </label>
        <button className="botao primario" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      <div className="folha folha-diaria">
        <table className="ficha lista">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%' }} />
            <col />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={7} className="ficha-titulo">
                CONTROLE DE PRODUÇÃO DIÁRIA
                {(pessoa || maquina) && (
                  <span className="ficha-sub">
                    {' '}
                    · {[pessoa && capitalizar(pessoa), maquina && capitalizar(maquina)].filter(Boolean).join(' · ')}
                  </span>
                )}
              </th>
            </tr>
            <tr className="ficha-cab">
              <th>Data</th>
              <th>Nome</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Início</th>
              <th>Término</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((a) => (
              <tr key={a.id}>
                <td>{dataBR(a.data)}</td>
                <td>{capitalizar(a.pessoa)}</td>
                <td>{a.codigo}</td>
                <td>{a.descricao}</td>
                <td>{a.inicio}</td>
                <td>{a.fim}</td>
                <td className="num">{num(a.realizado)}</td>
              </tr>
            ))}
            {Array.from({ length: vazias }, (_, i) => (
              <tr key={`v${i}`} className="ficha-linha">
                <td>{i === 0 && !linhas.length ? dataBR(dia) : ''}</td>
                <td>{i === 0 && !linhas.length && pessoa ? capitalizar(pessoa) : ''}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
            {linhas.length > 0 && (
              <tr>
                <th colSpan={6} className="num">
                  Total lançado
                </th>
                <td className="num forte">{num(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="ficha-assinatura">Ass.: ____________________________________</p>
        <RodapeFolha />
      </div>
    </section>
  );
}
