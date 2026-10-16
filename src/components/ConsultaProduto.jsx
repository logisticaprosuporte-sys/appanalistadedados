import { nomeEmpresa } from '../lib/db.js';
import { useMemo, useState } from 'react';
import { paginaOP } from '../lib/recebimento.js';
import { capitalizar } from '../lib/util.js';
import Logo from './Logo.jsx';
import { RodapeFolha } from './ui.jsx';

const PARTES = ['Rua', 'Prédio', 'Apartamento', 'Nível'];

function partesEndereco(end) {
  return String(end || '')
    .split(/[.\-]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function Info({ rotulo, valor, grande }) {
  return (
    <div className={`info ${grande ? 'info-grande' : ''}`}>
      <span>{rotulo}</span>
      <strong>{valor === null || valor === undefined || valor === '' ? '—' : valor}</strong>
    </div>
  );
}

function FichaEndereco({ p }) {
  const partes = partesEndereco(p.endereco);
  return (
    <div className="folha folha-op ficha-endereco so-imprimir-bloco">
      <div className="op-cabecalho">
        <span className="op-marca">
          <span className="op-logo">
            <Logo tamanho={26} />
          </span>
          {nomeEmpresa().toUpperCase()}
        </span>
        <span className="op-titulo">Guia de endereçamento</span>
        <span className="op-data" />
      </div>
      <table className="ficha ficha-op">
        <tbody>
          <tr className="ficha-cab">
            <th style={{ width: '22%' }}>Código interno</th>
            <th colSpan={3}>Descrição do item</th>
          </tr>
          <tr className="ficha-destaque">
            <td className="end-codigo">{p.codigo}</td>
            <td colSpan={3} className="end-descricao">
              {p.descricao}
            </td>
          </tr>
          <tr>
            <th colSpan={4} className="ficha-secao">
              Endereço
            </th>
          </tr>
          <tr className="ficha-cab">
            {PARTES.map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
          <tr className="end-partes">
            {PARTES.map((n, i) => (
              <td key={n}>{partes[i] || ''}</td>
            ))}
          </tr>
          <tr>
            <th>Fornecedor</th>
            <td colSpan={3}>{p.fornecedor}</td>
          </tr>
          <tr>
            <th>Cód. fornecedor</th>
            <td>{p.cod_fabrica}</td>
            <th>Peças por pacote</th>
            <td>{p.qtd_pct ?? ''}</td>
          </tr>
        </tbody>
      </table>
      <RodapeFolha />
    </div>
  );
}

export default function ConsultaProduto({ dados, onIrPara }) {
  // Aceita o código pelo link (ex.: #consulta?codigo=31212)
  const [termo, setTermo] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('codigo') || '');
  const [escolhido, setEscolhido] = useState(null);

  const resultados = useMemo(() => {
    const t = termo.trim().toUpperCase();
    if (!t) return [];
    return dados.produtos
      .filter(
        (p) =>
          String(p.codigo).startsWith(t) ||
          (p.cod_fabrica && String(p.cod_fabrica).toUpperCase().includes(t)) ||
          (p.descricao || '').includes(t) ||
          (p.endereco || '').startsWith(t),
      )
      .slice(0, 25);
  }, [termo, dados.produtos]);

  // Se só um produto bate (ex.: código exato), já mostra ele
  const p = escolhido ? dados.produtos.find((x) => x.codigo === escolhido) : resultados.length === 1 ? resultados[0] : null;
  const op = p && paginaOP(p.linha_recebimento || p.linha);
  const recebendo = p ? (dados.recebimentos || []).filter((r) => Number(r.codigo) === Number(p.codigo) && r.situacao !== 'concluido') : [];

  return (
    <section className="consulta impresso">
      <style>{'@page { size: A4 landscape; margin: 0; }'}</style>
      <div className="cartao nao-imprimir" style={{ marginBottom: 12 }}>
        <label className="campo">
          <span>Procure por código interno, código do fornecedor, descrição ou endereço</span>
          <input
            type="search"
            className="busca-grande"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setEscolhido(null);
            }}
            placeholder="Ex.: 31212 · T00220003200 · FRASCO 30 ML · 5.16"
            autoFocus
          />
        </label>
      </div>

      {termo && !p && (
        <div className="cartao nao-imprimir">
          {resultados.length ? (
            <table className="ranking produtos-tabela">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Cód. fornecedor</th>
                  <th>Endereço</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((x) => (
                  <tr key={x.codigo} className="clicavel" onClick={() => setEscolhido(x.codigo)}>
                    <td className="num forte">{x.codigo}</td>
                    <td>{x.descricao}</td>
                    <td>{x.cod_fabrica}</td>
                    <td>{x.endereco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mudo">Nenhum produto encontrado.</p>
          )}
        </div>
      )}

      {p && (
        <>
          <div className="cartao produto-ficha nao-imprimir">
            <div className="produto-topo">
              <div>
                <span className="mudo">Código interno</span>
                <h1>{p.codigo}</h1>
                <p className="produto-desc">{p.descricao}</p>
              </div>
              <div className="produto-endereco">
                <span>Endereço</span>
                <strong>{p.endereco || '—'}</strong>
              </div>
            </div>
            <div className="infos">
              <Info rotulo="Cód. do fornecedor" valor={p.cod_fabrica} />
              <Info rotulo="Fornecedor" valor={capitalizar(p.fornecedor)} />
              <Info rotulo="Curva" valor={p.curva} />
              <Info rotulo="Destino no recebimento" valor={capitalizar(p.linha_recebimento)} />
              <Info rotulo="Linha de produção" valor={capitalizar(p.linha)} />
              <Info rotulo="Peças por pacote" valor={p.qtd_pct} />
              <Info rotulo="Saco plástico" valor={p.saco} />
              <Info rotulo="Caixa" valor={capitalizar(p.caixa)} />
              <Info rotulo="Pacotes por caixa" valor={p.qtd_cx} />
              <Info rotulo="Família" valor={capitalizar(p.familia)} />
            </div>
            {recebendo.length > 0 && (
              <p className="aviso-inline">
                📦 Este produto está no recebimento agora ({recebendo.length} {recebendo.length === 1 ? 'entrada' : 'entradas'}).
              </p>
            )}
            <div className="produto-acoes">
              <button className="botao primario" onClick={() => window.print()}>
                Imprimir ficha de endereço
              </button>
              {op && (
                <button className="botao" onClick={() => onIrPara(op, `codigo=${p.codigo}`)}>
                  Abrir O.P. {op === 'op-manual' ? 'Manual' : 'Máquinas'}
                </button>
              )}
              {escolhido && (
                <button className="botao fantasma" onClick={() => setEscolhido(null)}>
                  ← voltar à lista
                </button>
              )}
            </div>
          </div>
          <FichaEndereco p={p} />
        </>
      )}
    </section>
  );
}
