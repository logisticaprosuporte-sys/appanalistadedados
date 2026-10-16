import { nomeEmpresa } from '../lib/db.js';
import { useMemo, useState } from 'react';
import { capitalizar, isoLocal, num } from '../lib/util.js';
import Logo from './Logo.jsx';
import { RodapeFolha } from './ui.jsx';

function valor(v, decimais = 0) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: decimais });
  return v;
}

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function tempoEstimado(qtd, meta) {
  if (!qtd || !meta) return '';
  const min = Math.round((qtd / meta) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

// Código vindo do link (ex.: #op-manual?codigo=31669)
function codigoDoLink() {
  const q = window.location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get('codigo') || '' : '';
}

/** Seis quadrinhos para anotar à mão (horários / quantidades) */
const Quadros = () => (
  <div className="quadros">
    {Array.from({ length: 6 }, (_, i) => (
      <span key={i} />
    ))}
  </div>
);

function Cabecalho({ titulo, data }) {
  return (
    <div className="op-cabecalho">
      <span className="op-marca">
        <span className="op-logo">
          <Logo tamanho={26} />
        </span>
        {nomeEmpresa().toUpperCase()}
      </span>
      <span className="op-titulo">{titulo}</span>
      <span className="op-data">
        Data <strong>{dataBR(data)}</strong>
      </span>
    </div>
  );
}

function Produto({ p, codigo, terceiro, quarto }) {
  return (
    <>
      <tr className="ficha-cab">
        <th>Código</th>
        <th>Descrição</th>
        <th>Fracionado</th>
        <th>{terceiro}</th>
      </tr>
      <tr className="ficha-destaque">
        <td>{codigo}</td>
        <td className="op-descricao">{p.descricao}</td>
        <td>{valor(p.qtd_pct)}</td>
        <td>{quarto}</td>
      </tr>
    </>
  );
}

function Estimativa({ p, qtd }) {
  if (!(qtd > 0)) return null;
  return (
    <tr>
      <th>Quant. a produzir</th>
      <td className="forte">{num(qtd)}</td>
      <th>Tempo estimado</th>
      <td className="forte">{tempoEstimado(qtd, p.meta_hora) || 'sem meta'}</td>
    </tr>
  );
}

const COLUNAS = (
  <colgroup>
    <col style={{ width: '19%' }} />
    <col style={{ width: '47%' }} />
    <col style={{ width: '17%' }} />
    <col style={{ width: '17%' }} />
  </colgroup>
);

function FichaManual({ p, codigo, qtd, data }) {
  return (
    <div className="folha folha-op">
      <Cabecalho titulo="Ordem de produção · Linha manual" data={data} />
      <table className="ficha ficha-op">
        {COLUNAS}
        <tbody>
          <Produto p={p} codigo={codigo} terceiro="Meta/hora" quarto={valor(p.meta_hora)} />
          <tr>
            <th>Saco plástico</th>
            <td>{p.saco}</td>
            <th>Caixa</th>
            <td>{capitalizar(p.caixa)}</td>
          </tr>
          <tr>
            <th>Quant. p/ caixa</th>
            <td>{valor(p.qtd_cx)}</td>
            <th>Total fracionado</th>
            <td></td>
          </tr>
          <tr>
            <th>Endereço</th>
            <td className="forte">{p.endereco}</td>
            <th>Linha</th>
            <td>{capitalizar(p.linha)}</td>
          </tr>
          <tr>
            <th>Fornecedor</th>
            <td colSpan={3}>{p.fornecedor}</td>
          </tr>
          <Estimativa p={p} qtd={qtd} />
          <tr>
            <th>Fracionado por</th>
            <td></td>
            <th>Conferido por</th>
            <td></td>
          </tr>
          <tr className="ficha-obs">
            <th>Observações</th>
            <td colSpan={3}>{p.obs}</td>
          </tr>
          <tr>
            <th colSpan={4} className="ficha-secao">
              Marcar horário
            </th>
          </tr>
          {['Início / retorno', 'Parada / término', 'Quantidade'].map((r) => (
            <tr key={r} className="ficha-quadros">
              <th>{r}</th>
              <td colSpan={3}>
                <Quadros />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <RodapeFolha />
    </div>
  );
}

function FichaMaquinas({ p, codigo, qtd, data, op1, op2 }) {
  return (
    <div className="folha folha-op">
      <Cabecalho titulo="Ordem de produção · Máquinas" data={data} />
      <table className="ficha ficha-op">
        {COLUNAS}
        <tbody>
          <tr>
            <th>Operador 1</th>
            <td className="forte">{capitalizar(op1)}</td>
            <th>Operador 2</th>
            <td className="forte">{capitalizar(op2)}</td>
          </tr>
          <Produto p={p} codigo={codigo} terceiro="Linha" quarto={capitalizar(p.linha)} />
          <tr>
            <th colSpan={2} className="ficha-secao">
              Setup da máquina
            </th>
            <th colSpan={2} className="ficha-secao">
              Embalagem
            </th>
          </tr>
          <tr>
            <th>Bandeja</th>
            <td>{p.bandeja}</td>
            <th>Saco plástico</th>
            <td>{p.saco}</td>
          </tr>
          <tr>
            <th>Empurrador</th>
            <td>{p.empurrador}</td>
            <th>Quant. p/ palete</th>
            <td>{valor(p.qtd_palete)}</td>
          </tr>
          <tr>
            <th>Espaçador</th>
            <td>{p.espacador}</td>
            <th>Camada</th>
            <td>{valor(p.camada)}</td>
          </tr>
          <tr>
            <th>Endereço</th>
            <td className="forte">{p.endereco}</td>
            <th>Meta/hora</th>
            <td>{valor(p.meta_hora)}</td>
          </tr>
          <Estimativa p={p} qtd={qtd} />
          <tr>
            <th colSpan={4} className="ficha-secao">
              Registro de apontamentos
            </th>
          </tr>
          <tr>
            <th>Tempo de setup</th>
            <td></td>
            <th>Total fracionado</th>
            <td></td>
          </tr>
          <tr>
            <th>Início da operação</th>
            <td></td>
            <th>Final da operação</th>
            <td></td>
          </tr>
          <tr>
            <th>Quant. produzida</th>
            <td></td>
            <th>Quant. de refugo</th>
            <td></td>
          </tr>
          <tr>
            <th>Motivo do refugo</th>
            <td colSpan={3}></td>
          </tr>
          <tr>
            <th>Verificado por</th>
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
      <RodapeFolha />
    </div>
  );
}

export default function OrdemProducao({ tipo, dados }) {
  const [codigo, setCodigo] = useState(codigoDoLink);
  const [qtd, setQtd] = useState('');
  const [data, setData] = useState(isoLocal());
  const [op1, setOp1] = useState('');
  const [op2, setOp2] = useState('');

  const produtos = useMemo(() => new Map(dados.produtos.map((p) => [Number(p.codigo), p])), [dados.produtos]);
  const pessoas = useMemo(() => dados.funcionarios.filter((f) => f.ativo).map((f) => f.nome).sort(), [dados.funcionarios]);
  const p = produtos.get(Number(codigo));
  const maquinas = tipo === 'maquinas';

  return (
    <section className="impresso">
      <style>{'@page { size: A4 landscape; margin: 0; }'}</style>
      <div className="filtros nao-imprimir">
        <label className="campo">
          <span>Código do produto</span>
          <input list="lista-produtos-op" inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus placeholder="Ex.: 31669" />
        </label>
        <label className="campo">
          <span>Quantidade a produzir (opcional)</span>
          <input inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} placeholder="Para estimar o tempo" />
        </label>
        <label className="campo">
          <span>Data</span>
          <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        </label>
        {maquinas && (
          <>
            <label className="campo">
              <span>Operador 1</span>
              <select value={op1} onChange={(e) => setOp1(e.target.value)}>
                <option value="">—</option>
                {pessoas.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Operador 2</span>
              <select value={op2} onChange={(e) => setOp2(e.target.value)}>
                <option value="">—</option>
                {pessoas.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="botao primario" disabled={!p} onClick={() => window.print()}>
          Imprimir O.P.
        </button>
      </div>

      {!codigo && <div className="vazio nao-imprimir">Digite o código do produto para montar a ordem de produção.</div>}
      {codigo && !p && <div className="vazio nao-imprimir">Código {codigo} não está cadastrado.</div>}
      {p &&
        (maquinas ? (
          <FichaMaquinas p={p} codigo={codigo} qtd={Number(qtd)} data={data} op1={op1} op2={op2} />
        ) : (
          <FichaManual p={p} codigo={codigo} qtd={Number(qtd)} data={data} />
        ))}

      <datalist id="lista-produtos-op">
        {dados.produtos.map((x) => (
          <option key={x.codigo} value={x.codigo} label={x.descricao} />
        ))}
      </datalist>
    </section>
  );
}
