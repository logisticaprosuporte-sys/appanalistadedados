import { useMemo, useState } from 'react';
import { parametro, salvarCadastro, salvarParametro } from '../lib/db.js';
import { capitalizar } from '../lib/util.js';

/** Tipos de caixa com preço padrão (sugerido na venda). */
function ListaTiposCaixa({ itens, recarregar, senha }) {
  const [novo, setNovo] = useState('');
  const [preco, setPreco] = useState('');
  const [precos, setPrecos] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const paraNumero = (v) => {
    const n = Number(String(v).trim().replace(',', '.'));
    return String(v).trim() === '' || !Number.isFinite(n) ? null : n;
  };

  async function executar(acao) {
    setOcupado(true);
    try {
      await acao();
      await recarregar();
    } catch (e) {
      window.alert('Não foi possível salvar: ' + (e.message || e));
    } finally {
      setOcupado(false);
    }
  }

  const adicionar = (e) => {
    e.preventDefault();
    const nome = novo.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!nome) return;
    if (itens.some((i) => i.nome === nome)) return window.alert(`${nome} já está cadastrado.`);
    executar(async () => {
      await salvarCadastro('tipos_caixa', { nome, preco: paraNumero(preco), ativo: true }, senha);
      setNovo('');
      setPreco('');
    });
  };

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <h2>Tipos de caixa</h2>
        <span className="mudo">{itens.filter((i) => i.ativo).length} ativos</span>
      </div>
      <form className="linha-form" onSubmit={adicionar}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome do tipo (ex.: VEDAPACK G)" />
        <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Preço R$" inputMode="decimal" style={{ flex: '0 0 110px' }} />
        <button className="botao primario" disabled={ocupado || !novo.trim()}>
          Adicionar
        </button>
      </form>
      <ul className="lista-nomes">
        {[...itens]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((i) => {
            const valor = precos[i.nome] ?? (i.preco == null ? '' : String(i.preco).replace('.', ','));
            return (
              <li key={i.nome} className={i.ativo ? '' : 'inativo'}>
                <span>{i.nome}</span>
                <span className="tipo-acoes">
                  <span className="mudo">R$</span>
                  <input
                    className="preco-tipo"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setPrecos({ ...precos, [i.nome]: e.target.value })}
                    onBlur={() => {
                      if (precos[i.nome] === undefined || paraNumero(precos[i.nome]) === (i.preco ?? null)) return;
                      executar(() => salvarCadastro('tipos_caixa', { nome: i.nome, preco: paraNumero(precos[i.nome]), ativo: i.ativo }, senha));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label={`Preço de ${i.nome}`}
                  />
                  <button
                    className="botao pequeno fantasma"
                    disabled={ocupado}
                    onClick={() => executar(() => salvarCadastro('tipos_caixa', { nome: i.nome, preco: i.preco ?? null, ativo: !i.ativo }, senha))}
                  >
                    {i.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </span>
              </li>
            );
          })}
      </ul>
      <p className="dica">O preço aparece sozinho na Venda de caixas quando o tipo é escolhido (dá para mudar na hora).</p>
    </div>
  );
}

function ListaNomes({ titulo, tabela, itens, recarregar, placeholder, senha }) {
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao) {
    setOcupado(true);
    try {
      await acao();
      await recarregar();
    } catch (e) {
      window.alert('Não foi possível salvar: ' + (e.message || e));
    } finally {
      setOcupado(false);
    }
  }

  const adicionar = (e) => {
    e.preventDefault();
    const nome = novo.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!nome) return;
    if (itens.some((i) => i.nome === nome)) {
      window.alert(`${capitalizar(nome)} já está cadastrado.`);
      return;
    }
    executar(async () => {
      await salvarCadastro(tabela, { nome, ativo: true }, senha);
      setNovo('');
    });
  };

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <h2>{titulo}</h2>
        <span className="mudo">{itens.filter((i) => i.ativo).length} ativos</span>
      </div>
      <form className="linha-form" onSubmit={adicionar}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={placeholder} />
        <button className="botao primario" disabled={ocupado || !novo.trim()}>
          Adicionar
        </button>
      </form>
      <ul className="lista-nomes">
        {itens.map((i) => (
          <li key={i.nome} className={i.ativo ? '' : 'inativo'}>
            <span>{capitalizar(i.nome)}</span>
            <button
              className="botao pequeno fantasma"
              disabled={ocupado}
              onClick={() => executar(() => salvarCadastro(tabela, { nome: i.nome, ativo: !i.ativo }, senha))}
            >
              {i.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </li>
        ))}
      </ul>
      <p className="dica">Desativado some das listas de lançamento, mas o histórico continua no painel.</p>
    </div>
  );
}

// Mesmas colunas da aba GERAL 24.08: [campo, rótulo, tipo, campo largo]
const GRUPOS_PRODUTO = [
  [
    'Informações gerais',
    [
      ['descricao', 'Descrição', 'texto', true],
      ['familia', 'Família (departamento)'],
      ['qtd_pct', 'Qtd. pct', 'num'],
      ['fornecedor', 'Fornecedor', 'texto', true],
      ['secao', 'Seção'],
      ['categoria', 'Categoria'],
      ['tipo', 'Tipo'],
      ['cod_fabrica', 'Cód. fábrica'],
    ],
  ],
  [
    'Linha manual / máquinas',
    [
      ['linha', 'Linha'],
      ['saco', 'Saco plástico'],
      ['caixa', 'Caixa'],
      ['qtd_cx', 'Qtd pct/CX', 'num'],
      ['qtd_palete', 'Qtd pct/palete', 'num'],
      ['camada', 'Camada', 'num'],
      ['bandeja', 'Bandeja'],
      ['empurrador', 'Empurrador'],
      ['espacador', 'Espaçador'],
    ],
  ],
  [
    'Gestão',
    [
      ['altura', 'Altura', 'num'],
      ['largura', 'Largura', 'num'],
      ['comprimento', 'Comprimento', 'num'],
      ['peso', 'Peso', 'num'],
      ['endereco', 'Endereço'],
      ['meta_hora', 'Meta/hora', 'num'],
      ['obs', 'Observação', 'texto', true],
    ],
  ],
  [
    'Recebimento',
    [
      ['curva', 'Curva (A, B ou C)'],
      ['linha_recebimento', 'Destino no recebimento'],
    ],
  ],
];

/** Meta/hora editável direto na lista: digita e salva ao sair da célula ou apertar Enter. */
function MetaEditavel({ produto, senha, onSalvo }) {
  const inicial = Number(produto.meta_hora) ? String(produto.meta_hora) : '';
  const [valor, setValor] = useState(inicial);
  const [estado, setEstado] = useState('');

  async function salvar() {
    const n = valor.trim() === '' ? null : Number(valor.replace(/\./g, '').replace(',', '.'));
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      setEstado('erro');
      return;
    }
    if ((n || null) === (Number(produto.meta_hora) || null)) return;
    setEstado('salvando');
    try {
      const atualizado = { ...produto, meta_hora: n };
      await salvarCadastro('produtos', atualizado, senha);
      onSalvo(atualizado);
      setEstado('ok');
      setTimeout(() => setEstado(''), 1500);
    } catch (e) {
      setEstado('erro');
      window.alert('Não foi possível salvar a meta: ' + (e.message || e));
    }
  }

  return (
    <span className={`meta-editavel ${estado}`}>
      <input
        inputMode="numeric"
        value={valor}
        placeholder="—"
        aria-label={`Meta/hora do produto ${produto.codigo}`}
        onChange={(e) => {
          setValor(e.target.value);
          setEstado('');
        }}
        onBlur={salvar}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="meta-status">{estado === 'salvando' ? '…' : estado === 'ok' ? '✓' : estado === 'erro' ? '!' : ''}</span>
    </span>
  );
}

function Produtos({ produtos, recarregar, senha, onProdutoSalvo }) {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // { codigo, descricao, familia, novo }
  const [ocupado, setOcupado] = useState(false);

  const [soSemMeta, setSoSemMeta] = useState(false);
  const [limite, setLimite] = useState(50);

  const familias = useMemo(() => [...new Set(produtos.map((p) => p.familia))].sort(), [produtos]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return produtos
      .filter(
        (p) =>
          (!t ||
            String(p.codigo).startsWith(t) ||
            p.descricao.includes(t) ||
            (p.endereco || '').startsWith(t) ||
            (p.fornecedor || '').includes(t)) &&
          (!soSemMeta || !Number(p.meta_hora)),
      )
      .sort((a, b) => Number(a.codigo) - Number(b.codigo));
  }, [busca, soSemMeta, produtos]);
  const achados = filtrados.slice(0, limite);

  const abrir = (p) => {
    const e = { codigo: p?.codigo ?? '', novo: !p };
    for (const [, campos] of GRUPOS_PRODUTO) {
      for (const [c, , tipo] of campos) {
        const v = p?.[c];
        e[c] = v === null || v === undefined ? '' : tipo === 'num' ? String(v).replace('.', ',') : String(v);
      }
    }
    setEditando(e);
  };

  async function salvar(e) {
    e.preventDefault();
    const codigo = Number(editando.codigo);
    const item = { codigo };
    for (const [, campos] of GRUPOS_PRODUTO) {
      for (const [c, , tipo] of campos) {
        const v = String(editando[c] ?? '').trim();
        if (tipo === 'num') {
          const n = Number(v.replace(/\./g, '').replace(',', '.'));
          item[c] = v === '' || !Number.isFinite(n) ? null : n;
        } else {
          item[c] = c === 'obs' ? v : v.toUpperCase();
        }
      }
    }
    item.familia = item.familia || 'SEM FAMÍLIA';
    if (!codigo || !item.descricao) {
      window.alert('Preencha código e descrição.');
      return;
    }
    if (editando.novo && produtos.some((p) => Number(p.codigo) === codigo)) {
      window.alert('Esse código já existe. Busque por ele para editar.');
      return;
    }
    setOcupado(true);
    try {
      await salvarCadastro('produtos', item, senha);
      await recarregar();
      setEditando(null);
      setBusca(String(codigo));
    } catch (err) {
      window.alert('Não foi possível salvar: ' + (err.message || err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="cartao produtos">
      <div className="cartao-topo">
        <h2>Produtos</h2>
        <span className="mudo">
          {filtrados.length === produtos.length
            ? `${produtos.length.toLocaleString('pt-BR')} cadastrados`
            : `${filtrados.length.toLocaleString('pt-BR')} de ${produtos.length.toLocaleString('pt-BR')}`}
        </span>
      </div>
      <div className="linha-form">
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(50);
          }}
          placeholder="Buscar por código, descrição, endereço ou fornecedor"
        />
        <label className="campo-check">
          <input type="checkbox" checked={soSemMeta} onChange={(e) => setSoSemMeta(e.target.checked)} />
          Só sem meta/hora
        </label>
        <button className="botao primario" onClick={() => abrir(null)}>
          Novo produto
        </button>
      </div>
      <p className="dica" style={{ marginTop: 0, marginBottom: 10 }}>
        A <b>Meta/h</b> dá para editar direto na lista: clique no número, digite e aperte Enter. Para o resto da ficha (bandeja, endereço, saco, caixa, medidas…), clique no produto.
      </p>

      {editando && (
        <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && setEditando(null)}>
          <form className="modal editor-produto" onSubmit={salvar} onKeyDown={(e) => e.key === 'Escape' && setEditando(null)}>
            <div className="editor-titulo">
              <strong>{editando.novo ? 'Novo produto' : `Produto ${editando.codigo}`}</strong>
              <button type="button" className="icone" aria-label="Fechar" onClick={() => setEditando(null)}>
                ✕
              </button>
            </div>
            <label className="campo">
              <span>Código</span>
              <input
                inputMode="numeric"
                value={editando.codigo}
                disabled={!editando.novo}
                onChange={(e) => setEditando({ ...editando, codigo: e.target.value })}
                autoFocus={editando.novo}
              />
            </label>
            {GRUPOS_PRODUTO.map(([grupo, campos]) => (
              <fieldset key={grupo} className="editor-grupo">
                <legend>{grupo}</legend>
                {campos.map(([c, rotulo, tipo, largo]) => (
                  <label key={c} className={largo ? 'campo largo' : 'campo'}>
                    <span>{rotulo}</span>
                    <input
                      value={editando[c]}
                      inputMode={tipo === 'num' ? 'decimal' : undefined}
                      list={c === 'familia' ? 'lista-familias' : undefined}
                      onChange={(e) => setEditando({ ...editando, [c]: e.target.value })}
                      autoFocus={!editando.novo && c === 'meta_hora'}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <div className="editor-acoes">
              <button className="botao primario" disabled={ocupado}>
                {ocupado ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" className="botao fantasma" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
            <datalist id="lista-familias">
              {familias.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </form>
        </div>
      )}

      <div className="tabela-wrap">
        <table className="ranking produtos-tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Linha</th>
              <th>Endereço</th>
              <th className="num">Meta/h</th>
              <th>Bandeja</th>
              <th>Saco</th>
              <th>Caixa</th>
              <th aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {achados.map((p) => (
              <tr key={p.codigo} className="clicavel" onClick={() => abrir(p)}>
                <td className="num">{p.codigo}</td>
                <td>{p.descricao}</td>
                <td>{capitalizar(p.linha)}</td>
                <td>{p.endereco}</td>
                <td className="num celula-meta" onClick={(e) => e.stopPropagation()}>
                  <MetaEditavel produto={p} senha={senha} onSalvo={onProdutoSalvo} />
                </td>
                <td>{p.bandeja}</td>
                <td>{p.saco}</td>
                <td>{capitalizar(p.caixa)}</td>
                <td className="acoes">
                  <button className="botao pequeno" onClick={(e) => (e.stopPropagation(), abrir(p))}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {achados.length === 0 && (
              <tr>
                <td colSpan={9} className="mudo">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtrados.length > achados.length && (
        <div className="mais">
          <button className="botao" onClick={() => setLimite((l) => l + 100)}>
            Mostrar mais ({(filtrados.length - achados.length).toLocaleString('pt-BR')} restantes)
          </button>
        </div>
      )}
    </div>
  );
}

/** Uma configuração editável (meta, jornada…), salva no banco para todos os computadores. */
function CampoParametro({ titulo, explicacao, chave, tipo, sufixo, dados, setDados, senha }) {
  const atual = parametro(dados, chave);
  const [valor, setValor] = useState(atual);
  const [estado, setEstado] = useState('');

  async function salvar(e) {
    e.preventDefault();
    const v = String(valor).trim();
    if (tipo === 'number' && !(Number(v) > 0)) return setEstado('Digite um número maior que zero.');
    if (tipo === 'time' && !/^\d{2}:\d{2}$/.test(v)) return setEstado('Digite no formato HH:MM.');
    setEstado('salvando');
    try {
      await salvarParametro(chave, v, senha);
      setDados((d) => ({ ...d, parametros: [...(d.parametros || []).filter((p) => p.chave !== chave), { chave, valor: v }] }));
      setEstado('Salvo ✓');
    } catch (err) {
      setEstado('Não foi possível salvar: ' + (err.message || err));
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <h2>{titulo}</h2>
      </div>
      <form className="linha-form parametro" onSubmit={salvar}>
        <input type={tipo} min={tipo === 'number' ? 1 : undefined} value={valor} onChange={(e) => (setValor(e.target.value), setEstado(''))} aria-label={titulo} />
        {sufixo && <span className="mudo">{sufixo}</span>}
        <button className="botao primario" disabled={estado === 'salvando' || String(valor) === String(atual)}>
          Salvar
        </button>
      </form>
      {estado && estado !== 'salvando' && <p className={estado.startsWith('Salvo') ? 'txt-bom' : 'erro-txt'}>{estado}</p>}
      <p className="dica">{explicacao}</p>
    </div>
  );
}

export default function Cadastros({ area, dados, setDados, recarregar, senha }) {
  // Atualiza um produto na tela sem baixar tudo de novo
  const produtoSalvo = (p) =>
    setDados((d) => ({ ...d, produtos: d.produtos.map((x) => (Number(x.codigo) === Number(p.codigo) ? { ...x, ...p } : x)) }));

  if (area === 'recebimento') {
    return (
      <section className="cadastros">
        <ListaNomes titulo="Compradores de caixas" tabela="compradores" itens={dados.compradores || []} recarregar={recarregar} placeholder="Nome do comprador" senha={senha} />
        <ListaTiposCaixa itens={dados.tipos_caixa || []} recarregar={recarregar} senha={senha} />
        <div className="cartao">
          <div className="cartao-topo">
            <h2>Produtos</h2>
          </div>
          <p className="dica" style={{ marginTop: 0 }}>
            Curva, destino no recebimento, código do fornecedor e endereço ficam na ficha do produto: Produção → Cadastros da
            produção → clique no produto.
          </p>
        </div>
      </section>
    );
  }
  if (area === 'expedicao') {
    return (
      <section className="cadastros">
        <ListaNomes titulo="Separadores" tabela="separadores" itens={dados.separadores || []} recarregar={recarregar} placeholder="Nome de quem separa pedidos" senha={senha} />
        <CampoParametro
          titulo="Meta de tempo por pedido"
          chave="meta_separacao_min"
          tipo="number"
          sufixo="minutos"
          explicacao="Tempo máximo esperado para separar um pedido. Passando disso, o cronômetro da separação fica vermelho e o painel conta como fora da meta."
          dados={dados}
          setDados={setDados}
          senha={senha}
        />
      </section>
    );
  }
  return (
    <section className="cadastros">
      <ListaNomes titulo="Funcionárias" tabela="funcionarios" itens={dados.funcionarios} recarregar={recarregar} placeholder="Nome da funcionária" senha={senha} />
      <ListaNomes titulo="Máquinas / linhas" tabela="maquinas" itens={dados.maquinas} recarregar={recarregar} placeholder="Nome da máquina" senha={senha} />
      <CampoParametro
        titulo="Jornada do dia"
        chave="jornada"
        tipo="time"
        sufixo="horas por dia"
        explicacao="Usada no painel (aba Colaboradoras) para calcular quanto do dia teve produção lançada."
        dados={dados}
        setDados={setDados}
        senha={senha}
      />
      <Produtos produtos={dados.produtos} recarregar={recarregar} senha={senha} onProdutoSalvo={produtoSalvo} />
    </section>
  );
}