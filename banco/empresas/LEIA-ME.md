# Dados de cada empresa

Os SQLs de carga (dados das planilhas) ficam numa pasta por empresa:

```
banco/empresas/elyplast/   -> só dados da Elyplast
banco/empresas/gppharma/   -> só dados da GPPharma
```

Essas subpastas **não vão para o GitHub** (o repositório é público), só ficam no seu PC.
Todo `insert` de carga precisa ter a coluna `empresa` com o id certo (`'elyplast'` ou `'gppharma'`).
