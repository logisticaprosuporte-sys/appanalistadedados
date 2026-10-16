-- Cadastra as empresas e as configurações padrão de cada uma. Rodar depois do 01.
-- Pode rodar de novo sem problema. Para uma empresa nova, copie uma linha e troque id/nome
-- (id só com letras minúsculas, números e hífen).

insert into empresas (id, nome) values
  ('elyplast', 'Elyplast'),
  ('gppharma', 'GPPharma')
on conflict (id) do update set nome = excluded.nome;

insert into parametros (empresa, chave, valor)
select e.id, p.chave, p.valor
from empresas e
cross join (values ('meta_separacao_min', '30'), ('jornada', '08:48')) as p (chave, valor)
on conflict (empresa, chave) do nothing;

-- ------------------------------------------------------------------
-- SENHA DE CADA EMPRESA (Painéis e Cadastros). Rode trocando a empresa e SUA_SENHA.
-- O mesmo comando serve para trocar a senha depois. A senha fica criptografada no banco.
--
-- insert into configuracao (empresa, chave, valor)
-- values ('elyplast', 'senha_cadastros', extensions.crypt('SUA_SENHA', extensions.gen_salt('bf')))
-- on conflict (empresa, chave) do update set valor = excluded.valor;
--
-- insert into configuracao (empresa, chave, valor)
-- values ('gppharma', 'senha_cadastros', extensions.crypt('SUA_SENHA', extensions.gen_salt('bf')))
-- on conflict (empresa, chave) do update set valor = excluded.valor;
