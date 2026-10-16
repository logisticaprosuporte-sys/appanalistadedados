# App analista de dados

Versão **multiempresa** do sistema da Elyplast, para análise de dados com gráficos. Cada empresa
(ex.: **Elyplast**, **GPPharma**) tem os próprios dados e a própria senha: nada se mistura.

O site de produção da Elyplast (repositório `Automacaoelyplast`) continua separado e não é afetado.

- Ao abrir, o site pergunta **qual empresa**. Tudo o que aparece e tudo o que é lançado fica só nela.
- O botão **Trocar empresa** (no topo) volta para a escolha.
- Telas: produção, expedição, recebimento, painéis com gráficos e cadastros (iguais às do sistema Elyplast).

Feito com Vite + React + Recharts. Dados no Supabase (Postgres).

## Banco de dados (pasta `banco/`)

Os SQLs deste projeto ficam em [`banco/`](banco/), separados dos SQLs antigos do site de produção.
Use um **projeto novo** do Supabase (não o da produção da Elyplast).

1. Supabase → **New project** (região *South America (São Paulo)*).
2. **SQL Editor → New query** → cole [`banco/01-estrutura.sql`](banco/01-estrutura.sql) → **Run**.
3. Nova query → [`banco/02-empresas.sql`](banco/02-empresas.sql) → **Run** (cadastra Elyplast e GPPharma).
4. Defina a senha de cada empresa com o comando que está no final do `02-empresas.sql`.
5. **Project Settings → API**: copie a **Project URL** e a chave **anon public**.

Toda tabela tem a coluna `empresa` (`elyplast`, `gppharma`…). Para incluir outra empresa, adicione uma linha no `02-empresas.sql` e rode de novo.

Os dados de carga de cada empresa ficam em `banco/empresas/<empresa>/` — essas pastas **não vão para o GitHub**, porque este repositório é público.

## Site (Vercel)

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe este repositório.
2. **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave anon public
   - `VITE_EMPRESA` (opcional) = `elyplast` ou `gppharma` para travar o site numa empresa só (um link por empresa).
3. **Deploy**.

Sem as variáveis do Supabase o site abre em **modo demonstração** (salva só no navegador, separado por empresa).

## Rodar no PC

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` para usar o banco de verdade.
