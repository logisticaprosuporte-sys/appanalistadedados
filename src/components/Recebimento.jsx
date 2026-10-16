import { useMemo, useRef, useState } from 'react';
import { excluirLinha, salvarLinha } from '../lib/db.js';
import { acharProduto, desdeQuando, ETAPAS, haQuantoTempo, historicoDe, paginaOP } from '../lib/recebimento.js';
import { capitalizar, isoLocal, num } from '../lib/util.js';

// Mesmos nomes da planilha antiga
const SITUACOES = [
  { id: 'recebido', nome: 'Recebimento' },
  { id: 'quarentena', nome: 'Quarentena' },
  { id: 'etiquetas', nome: 'Tirar O.P./Etiquetas' },
  { id: 'em_linha', nome: 'Em linha de produção' },
  { id: 'concluido', nome: 'Concluído' },
];
const LINHAS = ['MANUAL', 'EMPACOTADEIRA', 'ENFARDADEIRA', 'ESTOQUE', 'FORA DE LINHA'];

const etiquetasDe = (qtd, pct) => (Number(qtd) > 0 && Number(pct) > 0 ? Math.ceil(Number(qtd) / Number(pct)) : null);
const VAZIA = { data: '', situacao: 'recebido', linha: '', codigo: '', quantidade: '', qtd_pct: '', nf: '', observacao: '' };
const COLUNAS = 15;

function Linha({ item, nova, produtosMap, produtos, onSalvar, onExcluir, onAbrirOP, agora }) {
  const [l, setL] = useState(() => ({
    ...VAZIA,
    ...item,
    codigo: item.codigo ?? '',
    quantidade: item.quantidade ?? '',
    qtd_pct: item.qtd_pct ?? '',
  }));
  const [estado, setEstado] = useState(nova ? 'nova' : 'salvo');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);

  // Código interno ou do fornecedor -> produto do cadastro
  const achado = acharProduto(produtosMap, produtos, l.codigo);
  const p = achado?.produto;
  const etiquetas = etiquetasDe(l.quantidade, l.qtd_pct);
  const curvaLinha = p?.curva || l.curva || '';

  const mudar = (campo) => (e) => {
    const v = e.target.value;
    setL((x) => {
      const n = { ...x, [campo]: v };
      if (campo === 'codigo') {
        const a = acharProduto(produtosMap, produtos, v);
        if (a) {
          // Preenche como o PROCV da planilha: linha e peças por pacote do cadastro
          if (!x.linha || nova) n.linha = a.produto.linha_recebimento || '';
          n.qtd_pct = a.produto.qtd_pct ?? '';
        }
      }
      return n;
    });
    if (!nova) setEstado('alterado');
    setMsg('');
  };

  async function salvar() {
    let problema = null;
    if (!l.codigo) problema = 'Digite o código interno ou do fornecedor';
    else if (!p) problema = 'Produto não encontrado no cadastro';
    else if (l.quantidade !== '' && !(Number(l.quantidade) >= 0)) problema = 'Quantidade inválida';
    if (problema) {
      setEstado(nova ? 'nova' : 'erro');
      setMsg(problema);
      return;
    }
    setEstado('salvando');
    try {
      const mudouSituacao = !nova && l.situacao !== item.situacao;
      const historico = nova
        ? [{ situacao: l.situacao, em: new Date().toISOString() }]
        : mudouSituacao
          ? [...historicoDe(item), { situacao: l.situacao, em: new Date().toISOString() }]
          : historicoDe(item);
      const salvo = await onSalvar({
        id: l.id,
        data: l.data || isoLocal(),
        situacao: l.situacao,
        linha: l.linha || '',
        codigo: Number(p.codigo),
        descricao: p.descricao,
        fornecedor: p.fornecedor || '',
        cod_fornecedor: p.cod_fabrica || '',
        curva: curvaLinha,
        quantidade: l.quantidade === '' ? null : Math.round(Number(l.quantidade)),
        qtd_pct: l.qtd_pct === '' ? null : Number(l.qtd_pct),
        etiquetas,
        nf: String(l.nf || '').trim().toUpperCase(),
        observacao: l.observacao || '',
        historico,
      });
      if (nova) {
        setL({ ...VAZIA, data: l.data, situacao: l.situacao });
        setEstado('nova');
        setTimeout(() => ref.current?.querySelector('[data-campo="codigo"]')?.focus(), 0);
      } else {
        setL({ ...salvo, quantidade: salvo.quantidade ?? '', qtd_pct: salvo.qtd_pct ?? '' });
        setEstado('salvo');
      }
      setMsg('');
    } catch (e) {
      setEstado('erro');
      setMsg(e.message || 'Erro ao salvar');
    }
  }

  const op = paginaOP(l.linha);
  const desde = !nova ? desdeQuando(item) : null;

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
          <input type="date" value={l.data || ''} onChange={mudar('data')} aria-label="Data" />
        </td>
        <td className={`celula-situacao sit-${l.situacao}`} title={desde ? `Nesta situação ${haQuantoTempo(desde, agora)}` : ''}>
          <select value={l.situacao} onChange={mudar('situacao')} aria-label="Situação">
            {SITUACOES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select value={l.linha} onChange={mudar('linha')} aria-label="Linha">
            <option value="">—</option>
            {[...new Set([...LINHAS, l.linha].filter(Boolean))].map((x) => (
              <option key={x} value={x}>
                {capitalizar(x)}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input
            data-campo="codigo"
            list="lista-produtos-receb"
            value={l.codigo}
            onChange={mudar('codigo')}
            aria-label="Código interno ou do fornecedor"
            className={l.codigo && !p ? 'invalido' : ''}
            placeholder={nova ? 'código' : ''}
          />
        </td>
        <td className="auto centro">{curvaLinha ? <span className={`curva curva-${curvaLinha}`}>{curvaLinha}</span> : ''}</td>
        <td className="auto" title={p?.cod_fabrica}>
          {p?.cod_fabrica || ''}
        </td>
        <td className="auto descricao" title={p?.descricao}>
          {p ? p.descricao : l.codigo ? <span className="erro-txt">não encontrado</span> : ''}
        </td>
        <td>
          <input inputMode="numeric" className="num forte" value={l.quantidade} onChange={mudar('quantidade')} aria-label="Quantidade recebida" />
        </td>
        <td>
          <input inputMode="numeric" className="num" value={l.qtd_pct} onChange={mudar('qtd_pct')} aria-label="Peças por pacote" />
        </td>
        <td className="auto num forte">{etiquetas ?? ''}</td>
        <td className="auto" title={p?.fornecedor}>
          {capitalizar(p?.fornecedor || '')}
        </td>
        <td>
          <input value={l.nf || ''} onChange={mudar('nf')} aria-label="Nota fiscal" />
        </td>
        <td>
          <input value={l.observacao || ''} onChange={mudar('observacao')} aria-label="Observação" />
        </td>
        <td className="auto centro">
          {!nova && op && p ? (
            <button className="link" onClick={() => onAbrirOP(op, p.codigo)} title="Abrir a O.P. deste produto">
              O.P.
            </button>
          ) : (
            ''
          )}
        </td>
        <td className="acoes">
          {nova ? (
            <button className="botao primario pequeno" onClick={salvar} disabled={estado === 'salvando'}>
              Adicionar
            </button>
          ) : (
            <>
              <span className={`status ${estado}`}>{estado === 'salvando' ? '…' : estado === 'salvo' ? '✓' : estado === 'erro' ? '!' : '•'}</span>
              <button className="icone" title="Excluir" aria-label="Excluir" onClick={() => onExcluir(item)}>
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
          <td colSpan={COLUNAS}>⚠ {msg}</td>
        </tr>
      )}
    </>
  );
}

export default function Recebimento({ dados, setDados, onIrPara }) {
  const [filtro, setFiltro] = useState('andamento');
  const [busca, setBusca] = useState('');
  const [curva, setCurva] = useState('');
  const [chaveNova, setChaveNova] = useState(0);
  const agora = new Date();

  const produtosMap = useMemo(() => new Map(dados.produtos.map((p) => [Number(p.codigo), p])), [dados.produtos]);
  const todos = dados.recebimentos || [];
  const contagem = (id) => todos.filter((r) => r.situacao === id).length;
  const emAndamento = todos.filter((r) => r.situacao !== 'concluido').length;

  const ordem = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));
  const b = busca.trim().toUpperCase();
  // Curva do recebimento ou, se faltar, a do cadastro do produto
  const curvaDe = (r) => r.curva || produtosMap.get(Number(r.codigo))?.curva || '';
  const naSituacao = todos.filter((r) => (filtro === 'andamento' ? r.situacao !== 'concluido' : filtro === 'todos' ? true : r.situacao === filtro));
  const linhas = naSituacao
    .filter((r) => !curva || curvaDe(r) === curva)
    .filter(
      (r) =>
        !b ||
        String(r.codigo).includes(b) ||
        String(r.cod_fornecedor || '').toUpperCase().includes(b) ||
        (r.descricao || '').includes(b) ||
        (r.fornecedor || '').includes(b) ||
        (r.nf || '').includes(b),
    )
    .sort((x, y) => (ordem[x.situacao] ?? 9) - (ordem[y.situacao] ?? 9) || String(x.data).localeCompare(String(y.data)) || x.id - y.id);

  const atualizar = (salvo) => setDados((d) => ({ ...d, recebimentos: [...(d.recebimentos || []).filter((x) => x.id !== salvo.id), salvo] }));
  const salvar = async (r) => {
    const s = await salvarLinha('recebimentos', r);
    atualizar(s);
    return s;
  };
  async function excluir(r) {
    if (!window.confirm(`Excluir o recebimento do produto ${r.codigo}?`)) return;
    try {
      await excluirLinha('recebimentos', r.id);
      setDados((d) => ({ ...d, recebimentos: d.recebimentos.filter((x) => x.id !== r.id) }));
    } catch (e) {
      window.alert('Não foi possível excluir: ' + (e.message || e));
    }
  }

  const pecas = linhas.reduce((s, r) => s + (r.quantidade || 0), 0);
  const etiquetas = linhas.reduce((s, r) => s + (r.etiquetas || 0), 0);

  const FILTROS = [
    { id: 'andamento', nome: 'Em andamento', n: emAndamento },
    ...SITUACOES.map((s) => ({ id: s.id, nome: s.nome, n: contagem(s.id) })),
    { id: 'todos', nome: 'Todos', n: todos.length },
  ];

  return (
    <section className="recebimento">
      <div className="filtros receb-filtros">
        <div className="chips" role="group" aria-label="Situação">
          {FILTROS.map((f) => (
            <button key={f.id} className={`chip ${filtro === f.id ? 'ativo' : ''} ${f.id !== 'andamento' && f.id !== 'todos' ? `chip-${f.id}` : ''}`} onClick={() => (setFiltro(f.id), setChaveNova((k) => k + 1))}>
              {f.nome} <span className="chip-n">{f.n}</span>
            </button>
          ))}
        </div>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, descrição, fornecedor ou NF" />
      </div>

      <div className="filtro-curva" role="group" aria-label="Curva">
        <span className="mudo">Curva:</span>
        {['', 'A', 'B', 'C'].map((c) => (
          <button key={c || 'todas'} className={`chip pequeno-chip ${curva === c ? 'ativo' : ''} ${c ? `chip-curva-${c}` : ''}`} onClick={() => setCurva(c)}>
            {c ? `Curva ${c}` : 'Todas'} <span className="chip-n">{c ? naSituacao.filter((r) => curvaDe(r) === c).length : naSituacao.length}</span>
          </button>
        ))}
      </div>

      <div className="resumo-dia receb-resumo">
        <span>
          <strong>{linhas.length}</strong> {linhas.length === 1 ? 'item' : 'itens'}
        </span>
        <span>
          <strong>{num(pecas)}</strong> peças
        </span>
        <span>
          <strong>{num(etiquetas)}</strong> etiquetas
        </span>
      </div>

      <div className="grade-wrap">
        <table className="grade grade-receb">
          <thead>
            <tr>
              <th style={{ width: 132 }}>Data</th>
              <th style={{ width: 190 }}>Situação</th>
              <th style={{ width: 140 }}>Linha</th>
              <th style={{ width: 130 }}>Cód. interno / forn.</th>
              <th style={{ width: 62 }}>Curva</th>
              <th style={{ width: 130 }}>Cód. fornecedor</th>
              <th>Descrição</th>
              <th style={{ width: 104 }}>Qtd. recebida</th>
              <th style={{ width: 84 }}>Pç/pacote</th>
              <th style={{ width: 84 }}>Etiquetas</th>
              <th style={{ width: 200 }}>Fornecedor</th>
              <th style={{ width: 100 }}>NF</th>
              <th style={{ width: 180 }}>Observação</th>
              <th style={{ width: 50 }}>O.P.</th>
              <th style={{ width: 96 }} aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => (
              <Linha
                key={r.id}
                item={r}
                produtosMap={produtosMap}
                produtos={dados.produtos}
                onSalvar={salvar}
                onExcluir={excluir}
                onAbrirOP={(pagina, codigo) => onIrPara(pagina, `codigo=${codigo}`)}
                agora={agora}
              />
            ))}
            <Linha
              key={`nova-${chaveNova}`}
              nova
              item={{ data: isoLocal(), situacao: SITUACOES.some((s) => s.id === filtro) ? filtro : 'recebido' }}
              produtosMap={produtosMap}
              produtos={dados.produtos}
              onSalvar={salvar}
              onExcluir={() => {}}
              onAbrirOP={() => {}}
              agora={agora}
            />
          </tbody>
        </table>
      </div>
      <p className="dica">
        Igual à planilha: digite o <b>código interno ou o do fornecedor</b> na última linha, a quantidade e aperte <kbd>Enter</kbd>.
        Descrição, curva, fornecedor e etiquetas se preenchem sozinhos. Para mudar a situação, é só trocar na célula — salva
        sozinho ao sair da linha. Os concluídos ficam no filtro <b>Concluído</b>.
      </p>
      <datalist id="lista-produtos-receb">
        {dados.produtos.map((x) => (
          <option key={x.codigo} value={x.codigo} label={x.descricao} />
        ))}
      </datalist>
    </section>
  );
}
