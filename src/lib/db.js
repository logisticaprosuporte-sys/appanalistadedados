// Acesso aos dados. Com as variáveis do Supabase configuradas usa o banco de verdade;
// sem elas entra no "modo demonstração", que guarda tudo só neste navegador.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const modoDemo = !URL || !CHAVE;
const supabase = modoDemo ? null : createClient(URL, CHAVE);

// ---------- empresa ----------
// Tudo o que o site lê e grava fica preso à empresa escolhida (coluna "empresa" no banco),
// então os dados de uma empresa nunca aparecem nem são gravados na outra.
let empresa = null;
let nome = '';
export const empresaAtual = () => empresa;
export const nomeEmpresa = () => nome;
export function definirEmpresa(e) {
  empresa = e?.id || null;
  nome = e?.nome || '';
  demoCache = null;
}
function exigirEmpresa() {
  if (!empresa) throw new Error('Nenhuma empresa escolhida');
  return empresa;
}

// Com VITE_EMPRESA configurada na Vercel o site fica travado numa empresa só (um link por empresa)
export const EMPRESA_FIXA = import.meta.env.VITE_EMPRESA || null;

const EMPRESAS_DEMO = [
  { id: 'elyplast', nome: 'Elyplast' },
  { id: 'gppharma', nome: 'GPPharma' },
];

export async function listarEmpresas() {
  if (modoDemo) return EMPRESAS_DEMO;
  const { data, error } = await supabase.from('empresas').select('*').eq('ativo', true).order('nome');
  if (error) throw error;
  return data;
}

// Inclui (sem id) ou altera (com id) uma linha, sempre dentro da empresa escolhida
function gravar(tabela, id, linha) {
  const e = exigirEmpresa();
  const q = id
    ? supabase.from(tabela).update(linha).eq('id', id).eq('empresa', e)
    : supabase.from(tabela).insert({ ...linha, empresa: e });
  return q.select().single();
}

async function apagar(tabela, id) {
  const { error } = await supabase.from(tabela).delete().eq('id', id).eq('empresa', exigirEmpresa());
  if (error) throw error;
}

const COLUNAS = ['data', 'maquina', 'codigo', 'descricao', 'familia', 'pessoa', 'apoio', 'inicio', 'fim', 'previsto', 'realizado', 'observacao'];

function limpar(a) {
  const out = {};
  for (const c of COLUNAS) if (c in a) out[c] = a[c];
  return out;
}

// O Supabase devolve no máximo 1000 linhas por vez
async function buscarTudo(tabela, ordem) {
  const todas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select('*').eq('empresa', exigirEmpresa()).order(ordem).range(de, de + 999);
    if (error) throw error;
    todas.push(...data);
    if (data.length < 1000) return todas;
  }
}

// Horário vem do banco como "08:30:00"
const hora = (t) => (t ? String(t).slice(0, 5) : null);

// ---------- modo demonstração ----------
const CHAVE_LOCAL = () => `analista-demo-${exigirEmpresa()}`;

async function demoCarregar() {
  try {
    const salvo = localStorage.getItem(CHAVE_LOCAL());
    if (salvo) return JSON.parse(salvo);
  } catch {}
  const base = { maquinas: [], funcionarios: [], produtos: [], apontamentos: [], saidas: [] };
  return base;
}

function demoSalvar(dados) {
  try {
    localStorage.setItem(CHAVE_LOCAL(), JSON.stringify(dados));
  } catch {}
}

let demoCache = null;
async function demo() {
  if (!demoCache) {
    demoCache = await demoCarregar();
  }
  return demoCache;
}

// ---------- API usada pelas telas ----------
export async function carregarTudo() {
  if (modoDemo) {
    const d = await demo();
    return { saidas: [], separadores: [], separacoes: [], parametros: [], recebimentos: [], vendas_caixas: [], compradores: [], tipos_caixa: [], ...structuredClone(d) };
  }
  const [maquinas, funcionarios, produtos, apontamentos, saidas, separadores, separacoes, parametros, recebimentos, vendas_caixas, compradores, tipos_caixa] = await Promise.all([
    buscarTudo('maquinas', 'nome'),
    buscarTudo('funcionarios', 'nome'),
    buscarTudo('produtos', 'codigo'),
    buscarTudo('apontamentos', 'id'),
    buscarTudo('saidas', 'id'),
    buscarTudo('separadores', 'nome'),
    buscarTudo('separacoes', 'id'),
    buscarTudo('parametros', 'chave'),
    buscarTudo('recebimentos', 'id'),
    buscarTudo('vendas_caixas', 'id'),
    buscarTudo('compradores', 'nome'),
    buscarTudo('tipos_caixa', 'nome'),
  ]);
  return {
    maquinas,
    funcionarios,
    produtos,
    apontamentos: apontamentos.map((a) => ({ ...a, inicio: hora(a.inicio), fim: hora(a.fim) })),
    saidas: saidas.map((s) => ({ ...s, hora: hora(s.hora) })),
    separadores,
    separacoes: separacoes.map(ajustarSeparacao),
    parametros,
    recebimentos,
    vendas_caixas,
    compradores,
    tipos_caixa,
  };
}

// ---------- expedição: separação de pedidos ----------
const COLUNAS_SEPARACAO = ['data', 'pedido', 'separador', 'inicio', 'fim', 'itens', 'volumes', 'observacao'];
const ajustarSeparacao = (s) => ({ ...s, inicio: hora(s.inicio), fim: hora(s.fim) });

/** Só as separações (para atualizar a tela a cada pouco sem baixar tudo de novo). */
export async function carregarSeparacoes() {
  if (modoDemo) return structuredClone((await demo()).separacoes || []);
  return (await buscarTudo('separacoes', 'id')).map(ajustarSeparacao);
}

export async function salvarSeparacao(s) {
  const linha = {};
  for (const c of COLUNAS_SEPARACAO) if (c in s) linha[c] = s[c];
  if (modoDemo) {
    const d = await demo();
    d.separacoes = d.separacoes || [];
    if (s.id) {
      const i = d.separacoes.findIndex((x) => x.id === s.id);
      d.separacoes[i] = { ...d.separacoes[i], ...linha };
      demoSalvar(d);
      return d.separacoes[i];
    }
    const nova = { ...linha, id: Math.max(0, ...d.separacoes.map((x) => x.id)) + 1 };
    d.separacoes.push(nova);
    demoSalvar(d);
    return nova;
  }
  const { data, error } = await gravar('separacoes', s.id, linha);
  if (error) throw error;
  return ajustarSeparacao(data);
}

export async function excluirSeparacao(id) {
  if (modoDemo) {
    const d = await demo();
    d.separacoes = (d.separacoes || []).filter((x) => x.id !== id);
    demoSalvar(d);
    return;
  }
  await apagar('separacoes', id);
}

// ---------- controle de saídas ----------
const COLUNAS_SAIDA = ['data', 'hora', 'codigo', 'descricao', 'quantidade', 'observacao'];

export async function salvarSaida(s) {
  const linha = {};
  for (const c of COLUNAS_SAIDA) if (c in s) linha[c] = s[c];
  if (modoDemo) {
    const d = await demo();
    d.saidas = d.saidas || [];
    if (s.id) {
      const i = d.saidas.findIndex((x) => x.id === s.id);
      d.saidas[i] = { ...d.saidas[i], ...linha };
      demoSalvar(d);
      return d.saidas[i];
    }
    const nova = { ...linha, id: Math.max(0, ...d.saidas.map((x) => x.id)) + 1 };
    d.saidas.push(nova);
    demoSalvar(d);
    return nova;
  }
  const { data, error } = await gravar('saidas', s.id, linha);
  if (error) throw error;
  return { ...data, hora: hora(data.hora) };
}

export async function excluirSaida(id) {
  if (modoDemo) {
    const d = await demo();
    d.saidas = (d.saidas || []).filter((x) => x.id !== id);
    demoSalvar(d);
    return;
  }
  await apagar('saidas', id);
}

export async function salvarApontamento(a) {
  const linha = limpar(a);
  if (modoDemo) {
    const d = await demo();
    if (a.id) {
      const i = d.apontamentos.findIndex((x) => x.id === a.id);
      d.apontamentos[i] = { ...d.apontamentos[i], ...linha };
      demoSalvar(d);
      return d.apontamentos[i];
    }
    const novo = { ...linha, id: Math.max(0, ...d.apontamentos.map((x) => x.id)) + 1 };
    d.apontamentos.push(novo);
    demoSalvar(d);
    return novo;
  }
  const { data, error } = await gravar('apontamentos', a.id, linha);
  if (error) throw error;
  return { ...data, inicio: hora(data.inicio), fim: hora(data.fim) };
}

export async function excluirApontamento(id) {
  if (modoDemo) {
    const d = await demo();
    d.apontamentos = d.apontamentos.filter((x) => x.id !== id);
    demoSalvar(d);
    return;
  }
  await apagar('apontamentos', id);
}

// Cadastros só podem ser alterados com a senha da empresa (conferida no banco, ver banco/01-estrutura.sql)
export async function verificarSenha(senha) {
  if (modoDemo) return Boolean(senha);
  const { data, error } = await supabase.rpc('senha_cadastros_ok', { p_empresa: exigirEmpresa(), senha });
  if (error) throw error;
  return data === true;
}

/** tabela: 'maquinas' | 'funcionarios' (chave = nome) ou 'produtos' (chave = codigo) */
export async function salvarCadastro(tabela, item, senha) {
  const chave = tabela === 'produtos' ? 'codigo' : 'nome';
  if (modoDemo) {
    const d = await demo();
    d[tabela] = d[tabela] || [];
    const i = d[tabela].findIndex((x) => x[chave] === item[chave]);
    if (i >= 0) d[tabela][i] = { ...d[tabela][i], ...item };
    else d[tabela].push(item);
    demoSalvar(d);
    return;
  }
  const chamada =
    tabela === 'produtos'
      ? ['salvar_produto', { senha, p: item }]
      : tabela === 'tipos_caixa'
        ? ['salvar_tipo_caixa', { senha, p_nome: item.nome, p_preco: item.preco ?? null, p_ativo: item.ativo }]
        : [{ maquinas: 'salvar_maquina', funcionarios: 'salvar_funcionario', separadores: 'salvar_separador', compradores: 'salvar_comprador' }[tabela], { senha, p_nome: item.nome, p_ativo: item.ativo }];
  const [funcao, args] = chamada;
  const { error } = await supabase.rpc(funcao, { p_empresa: exigirEmpresa(), ...args });
  if (error) throw error;
}

// ---------- configurações (meta de separação, jornada) ----------
export const PADROES = { meta_separacao_min: '30', jornada: '08:48' };

/** Valor de uma configuração, com o padrão se ainda não existir no banco. */
export function parametro(dados, chave) {
  return (dados?.parametros || []).find((p) => p.chave === chave)?.valor ?? PADROES[chave];
}

export async function salvarParametro(chave, valor, senha) {
  if (modoDemo) {
    const d = await demo();
    d.parametros = (d.parametros || []).filter((p) => p.chave !== chave);
    d.parametros.push({ chave, valor });
    demoSalvar(d);
    return;
  }
  const { error } = await supabase.rpc('salvar_parametro', { p_empresa: exigirEmpresa(), senha, p_chave: chave, p_valor: valor });
  if (error) throw error;
}
// ---------- recebimento e venda de caixas (tabelas simples, mesma lógica) ----------
const COLUNAS_TABELA = {
  recebimentos: ['data', 'nf', 'codigo', 'descricao', 'fornecedor', 'cod_fornecedor', 'linha', 'curva', 'quantidade', 'qtd_pct', 'etiquetas', 'situacao', 'historico', 'observacao'],
  vendas_caixas: ['data', 'tipo', 'quantidade', 'comprador', 'valor_unit', 'valor_desconto', 'total', 'observacao'],
};

/** Inclui (sem id) ou altera (com id) uma linha de recebimentos / vendas_caixas. */
export async function salvarLinha(tabela, obj) {
  const linha = {};
  for (const c of COLUNAS_TABELA[tabela]) if (c in obj) linha[c] = obj[c];
  if (modoDemo) {
    const d = await demo();
    d[tabela] = d[tabela] || [];
    if (obj.id) {
      const i = d[tabela].findIndex((x) => x.id === obj.id);
      d[tabela][i] = { ...d[tabela][i], ...linha };
      demoSalvar(d);
      return d[tabela][i];
    }
    const nova = { ...linha, id: Math.max(0, ...d[tabela].map((x) => x.id)) + 1, criado_em: new Date().toISOString() };
    d[tabela].push(nova);
    demoSalvar(d);
    return nova;
  }
  const { data, error } = await gravar(tabela, obj.id, linha);
  if (error) throw error;
  return data;
}

export async function excluirLinha(tabela, id) {
  if (modoDemo) {
    const d = await demo();
    d[tabela] = (d[tabela] || []).filter((x) => x.id !== id);
    demoSalvar(d);
    return;
  }
  await apagar(tabela, id);
}