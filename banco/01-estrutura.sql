-- Estrutura do banco MULTIEMPRESA (projeto appanalistadedados).
-- Rodar UMA vez num projeto NOVO do Supabase: SQL Editor > New query > colar > Run.
-- NÃO rodar no banco do site de produção da Elyplast (aquele usa os SQLs da pasta supabase/ do outro projeto).
--
-- Toda tabela tem a coluna "empresa". O site só lê e grava as linhas da empresa escolhida,
-- e cada empresa tem a própria senha de Painéis/Cadastros. Assim os dados nunca se misturam.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Empresas ----------
create table if not exists empresas (
  id    text primary key check (id ~ '^[a-z0-9-]+$'),  -- ex.: elyplast, gppharma
  nome  text not null,
  ativo boolean not null default true
);

-- ---------- Cadastros ----------
create table if not exists maquinas (
  empresa text not null references empresas (id),
  nome    text not null,
  ativo   boolean not null default true,
  primary key (empresa, nome)
);

create table if not exists funcionarios (
  empresa text not null references empresas (id),
  nome    text not null,
  ativo   boolean not null default true,
  primary key (empresa, nome)
);

create table if not exists produtos (
  empresa           text   not null references empresas (id),
  codigo            bigint not null,
  descricao         text   not null,
  familia           text   not null default 'SEM FAMÍLIA',
  qtd_pct           numeric,
  fornecedor        text   not null default '',
  secao             text   not null default '',
  categoria         text   not null default '',
  tipo              text   not null default '',
  cod_fabrica       text   not null default '',
  linha             text   not null default '',
  saco              text   not null default '',
  caixa             text   not null default '',
  qtd_cx            numeric,
  qtd_palete        numeric,
  camada            numeric,
  bandeja           text   not null default '',
  empurrador        text   not null default '',
  espacador         text   not null default '',
  altura            numeric,
  largura           numeric,
  comprimento       numeric,
  peso              numeric,
  endereco          text   not null default '',
  meta_hora         numeric,
  obs               text   not null default '',
  curva             text   not null default '',
  linha_recebimento text   not null default '',
  primary key (empresa, codigo)
);

create table if not exists separadores (
  empresa text not null references empresas (id),
  nome    text not null,
  ativo   boolean not null default true,
  primary key (empresa, nome)
);

create table if not exists compradores (
  empresa text not null references empresas (id),
  nome    text not null,
  ativo   boolean not null default true,
  primary key (empresa, nome)
);

create table if not exists tipos_caixa (
  empresa text not null references empresas (id),
  nome    text not null,
  preco   numeric,
  ativo   boolean not null default true,
  primary key (empresa, nome)
);

-- Configurações editáveis (meta de separação, jornada) — uma lista por empresa
create table if not exists parametros (
  empresa text not null references empresas (id),
  chave   text not null,
  valor   text not null,
  primary key (empresa, chave)
);

-- Senha de cada empresa (criptografada). Sem regras de acesso = o site não consegue ler esta tabela.
create table if not exists configuracao (
  empresa text not null references empresas (id),
  chave   text not null,
  valor   text not null,
  primary key (empresa, chave)
);

-- ---------- Lançamentos ----------
create table if not exists apontamentos (
  id         bigint generated always as identity primary key,
  empresa    text   not null references empresas (id),
  data       date   not null,
  maquina    text   not null,
  codigo     bigint not null,
  descricao  text   not null default '',
  familia    text   not null default 'SEM FAMÍLIA',
  pessoa     text   not null,
  apoio      text   not null default '',
  inicio     time,
  fim        time,
  previsto   integer,
  realizado  integer not null check (realizado >= 0),
  observacao text   not null default '',
  criado_em  timestamptz not null default now()
);
create index if not exists apontamentos_empresa_data_idx on apontamentos (empresa, data);

create table if not exists saidas (
  id         bigint generated always as identity primary key,
  empresa    text   not null references empresas (id),
  data       date   not null,
  hora       time,
  codigo     bigint not null,
  descricao  text   not null default '',
  quantidade integer not null check (quantidade >= 0),
  observacao text   not null default '',
  criado_em  timestamptz not null default now()
);
create index if not exists saidas_empresa_data_idx on saidas (empresa, data);

create table if not exists separacoes (
  id         bigint generated always as identity primary key,
  empresa    text   not null references empresas (id),
  data       date   not null,
  pedido     text   not null,
  separador  text   not null,
  inicio     time   not null,
  fim        time,
  itens      integer check (itens >= 0),
  volumes    integer check (volumes >= 0),
  observacao text   not null default '',
  criado_em  timestamptz not null default now()
);
create index if not exists separacoes_empresa_data_idx on separacoes (empresa, data);

create table if not exists recebimentos (
  id             bigint generated always as identity primary key,
  empresa        text   not null references empresas (id),
  data           date   not null,
  nf             text   not null default '',
  codigo         bigint not null,
  descricao      text   not null default '',
  fornecedor     text   not null default '',
  cod_fornecedor text   not null default '',
  linha          text   not null default '',
  curva          text   not null default '',
  quantidade     integer check (quantidade >= 0),
  qtd_pct        numeric,
  etiquetas      integer,
  situacao       text   not null default 'recebido',
  historico      jsonb  not null default '[]',
  observacao     text   not null default '',
  criado_em      timestamptz not null default now()
);
create index if not exists recebimentos_empresa_situacao_idx on recebimentos (empresa, situacao);

create table if not exists vendas_caixas (
  id             bigint generated always as identity primary key,
  empresa        text    not null references empresas (id),
  data           date    not null,
  tipo           text    not null,
  quantidade     integer not null check (quantidade >= 0),
  comprador      text    not null default 'NÃO INFORMADO',
  valor_unit     numeric,
  valor_desconto numeric,
  total          numeric not null default 0,
  observacao     text    not null default '',
  criado_em      timestamptz not null default now()
);
create index if not exists vendas_caixas_empresa_data_idx on vendas_caixas (empresa, data);

-- ---------- Regras de acesso ----------
-- Sem login: quem tem o link lê e lança. Cadastros e configurações só mudam com a senha da empresa.
-- (O filtro por empresa é feito pelo site. Para trancar de verdade cada empresa, o próximo passo é login.)
alter table empresas      enable row level security;
alter table maquinas      enable row level security;
alter table funcionarios  enable row level security;
alter table produtos      enable row level security;
alter table separadores   enable row level security;
alter table compradores   enable row level security;
alter table tipos_caixa   enable row level security;
alter table parametros    enable row level security;
alter table configuracao  enable row level security;
alter table apontamentos  enable row level security;
alter table saidas        enable row level security;
alter table separacoes    enable row level security;
alter table recebimentos  enable row level security;
alter table vendas_caixas enable row level security;

do $$
declare t text;
begin
  -- só leitura pelo site
  foreach t in array array['empresas', 'maquinas', 'funcionarios', 'produtos', 'separadores', 'compradores', 'tipos_caixa', 'parametros'] loop
    execute format('drop policy if exists "leitura" on %I', t);
    execute format('create policy "leitura" on %I for select to anon using (true)', t);
  end loop;
  -- lançamentos: leitura e gravação livres
  foreach t in array array['apontamentos', 'saidas', 'separacoes', 'recebimentos', 'vendas_caixas'] loop
    execute format('drop policy if exists "acesso livre" on %I', t);
    execute format('create policy "acesso livre" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Funções com senha (cada empresa tem a sua) ----------
create or replace function senha_cadastros_ok(p_empresa text, senha text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from configuracao
    where empresa = p_empresa and chave = 'senha_cadastros' and valor = crypt(senha, valor)
  );
$$;

create or replace function conferir_senha(p_empresa text, senha text)
returns void language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not senha_cadastros_ok(p_empresa, senha) then
    raise exception 'Senha incorreta';
  end if;
end;
$$;

create or replace function salvar_funcionario(p_empresa text, senha text, p_nome text, p_ativo boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into funcionarios (empresa, nome, ativo) values (p_empresa, upper(trim(p_nome)), p_ativo)
  on conflict (empresa, nome) do update set ativo = excluded.ativo;
end;
$$;

create or replace function salvar_maquina(p_empresa text, senha text, p_nome text, p_ativo boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into maquinas (empresa, nome, ativo) values (p_empresa, upper(trim(p_nome)), p_ativo)
  on conflict (empresa, nome) do update set ativo = excluded.ativo;
end;
$$;

create or replace function salvar_separador(p_empresa text, senha text, p_nome text, p_ativo boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into separadores (empresa, nome, ativo) values (p_empresa, upper(trim(p_nome)), p_ativo)
  on conflict (empresa, nome) do update set ativo = excluded.ativo;
end;
$$;

create or replace function salvar_comprador(p_empresa text, senha text, p_nome text, p_ativo boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into compradores (empresa, nome, ativo) values (p_empresa, upper(trim(p_nome)), p_ativo)
  on conflict (empresa, nome) do update set ativo = excluded.ativo;
end;
$$;

create or replace function salvar_tipo_caixa(p_empresa text, senha text, p_nome text, p_preco numeric, p_ativo boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into tipos_caixa (empresa, nome, preco, ativo) values (p_empresa, upper(trim(p_nome)), p_preco, p_ativo)
  on conflict (empresa, nome) do update set preco = excluded.preco, ativo = excluded.ativo;
end;
$$;

create or replace function salvar_parametro(p_empresa text, senha text, p_chave text, p_valor text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into parametros (empresa, chave, valor) values (p_empresa, p_chave, p_valor)
  on conflict (empresa, chave) do update set valor = excluded.valor;
end;
$$;

-- Produto recebe a ficha inteira (jsonb). A empresa vem sempre do parâmetro, nunca da ficha.
create or replace function salvar_produto(p_empresa text, senha text, p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform conferir_senha(p_empresa, senha);
  insert into produtos (empresa, codigo, descricao, familia, qtd_pct, fornecedor, secao, categoria, tipo, cod_fabrica, linha, saco, caixa, qtd_cx, qtd_palete, camada, bandeja, empurrador, espacador, altura, largura, comprimento, peso, endereco, meta_hora, obs, curva, linha_recebimento)
  select p_empresa, codigo, descricao, coalesce(nullif(familia, ''), 'SEM FAMÍLIA'), qtd_pct, coalesce(fornecedor, ''), coalesce(secao, ''), coalesce(categoria, ''), coalesce(tipo, ''), coalesce(cod_fabrica, ''), coalesce(linha, ''), coalesce(saco, ''), coalesce(caixa, ''), qtd_cx, qtd_palete, camada, coalesce(bandeja, ''), coalesce(empurrador, ''), coalesce(espacador, ''), altura, largura, comprimento, peso, coalesce(endereco, ''), meta_hora, coalesce(obs, ''), coalesce(curva, ''), coalesce(linha_recebimento, '')
  from jsonb_populate_record(null::produtos, p - 'empresa')
  on conflict (empresa, codigo) do update set
    descricao = excluded.descricao,
    familia = excluded.familia,
    qtd_pct = excluded.qtd_pct,
    fornecedor = excluded.fornecedor,
    secao = excluded.secao,
    categoria = excluded.categoria,
    tipo = excluded.tipo,
    cod_fabrica = excluded.cod_fabrica,
    linha = excluded.linha,
    saco = excluded.saco,
    caixa = excluded.caixa,
    qtd_cx = excluded.qtd_cx,
    qtd_palete = excluded.qtd_palete,
    camada = excluded.camada,
    bandeja = excluded.bandeja,
    empurrador = excluded.empurrador,
    espacador = excluded.espacador,
    altura = excluded.altura,
    largura = excluded.largura,
    comprimento = excluded.comprimento,
    peso = excluded.peso,
    endereco = excluded.endereco,
    meta_hora = excluded.meta_hora,
    obs = excluded.obs,
    curva = excluded.curva,
    linha_recebimento = excluded.linha_recebimento;
end;
$$;

revoke execute on function conferir_senha(text, text) from public, anon;
grant execute on function senha_cadastros_ok(text, text) to anon;
grant execute on function salvar_funcionario(text, text, text, boolean) to anon;
grant execute on function salvar_maquina(text, text, text, boolean) to anon;
grant execute on function salvar_separador(text, text, text, boolean) to anon;
grant execute on function salvar_comprador(text, text, text, boolean) to anon;
grant execute on function salvar_tipo_caixa(text, text, text, numeric, boolean) to anon;
grant execute on function salvar_parametro(text, text, text, text) to anon;
grant execute on function salvar_produto(text, text, jsonb) to anon;
