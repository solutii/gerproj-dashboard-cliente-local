# Testes automatizados — gerproj-dashboard-cliente-local

## Contexto

A aplicação `gerproj-dashboard-cliente-local` (Next.js 15 + Firebird via `node-firebird`) não tem
nenhum framework de teste configurado hoje. O gatilho imediato é a rota
`src/app/api/chamados/[codChamado]/validar-tudo/route.ts`, que recentemente passou a executar um
UPDATE em `CHAMADO` e um INSERT em `HISTCHAMADO` numa única transação atômica
(`firebirdExecuteTransaction`, em `src/lib/firebird/firebird.ts`) — esse tipo de lógica (idempotência,
atomicidade, cálculo de datas a partir de dados existentes) é exatamente o tipo de coisa que regride
silenciosamente sem teste automatizado.

## Objetivo

Introduzir uma stack de testes de três camadas (unit, integração, e2e) e implementar a primeira fatia
cobrindo o fluxo de finalização/validação de chamado, com CI ativado a partir dessa fatia.

## Arquitetura

| Camada | Ferramenta | Cobre | Depende de banco? |
|---|---|---|---|
| Unit | Vitest | Funções puras: formatters, cálculos | Não |
| Integração | Vitest + mock do Firebird | Rotas `/api/*`: lógica de negócio, SQL montado, transações | Não (mockado) |
| E2E | Playwright | Fluxo real de UI num navegador | Sim (ambiente de dev/staging) |

Unit e integração rodam no mesmo runner (Vitest) via `npm test` — a diferença é só o que cada arquivo
de teste importa (uma função pura vs. um `route.ts` inteiro). E2E é um comando separado
(`npm run test:e2e`), mais lento, fora do CI padrão nesta fase.

## Estratégia de mock do Firebird

Nos testes de integração, `vi.mock('@/lib/firebird/firebird-client')` substitui `firebirdQuery`,
`firebirdExecute` e `firebirdExecuteTransaction` por `vi.fn()`. Cada teste configura o retorno
esperado (`mockResolvedValueOnce(...)`) para cada chamada que a rota faz, na ordem, e depois valida:

- a resposta HTTP (status + body) da rota
- o SQL e os params passados para cada chamada mockada — garante que o `UPDATE`/`INSERT` certo foi
  montado, incluindo cláusulas de guarda (ex: `AND STATUS_CHAMADO <> 'FINALIZADO'`)

Isso cobre bugs como: uma rota que esquece a cláusula de idempotência, ou que chama
`firebirdExecute` duas vezes em sequência em vez de `firebirdExecuteTransaction` uma vez (perdendo
atomicidade) — sem precisar de conexão real com o Firebird do cliente.

## Organização dos arquivos

Testes colocados ao lado do arquivo que testam (convenção padrão do Next.js App Router + Vitest):

```
src/app/api/chamados/[codChamado]/validar-tudo/route.ts
src/app/api/chamados/[codChamado]/validar-tudo/route.test.ts

src/lib/firebird/firebird.ts
src/lib/firebird/firebird.test.ts

src/formatters/formatar-data.ts
src/formatters/formatar-data.test.ts
```

`vitest.config.ts` na raiz aponta `test.include` para `**/*.test.ts(x)`, com o alias `@/` resolvido
igual ao `tsconfig.json`.

## Fases

### Fase 1 — Unit + integração do fluxo de finalização/validação + CI

- **Unit**: `formatters/formatar-data.ts`, `formatar-hora.ts`, `formatar-numeros.ts` — casos-limite
  (string vazia, `null`/`undefined`, formato inesperado, formato `HHMM` vs `HH:MM`).
- **Integração** (mockando Firebird):
  - `validar-tudo/route.ts` — UPDATE+INSERT atômicos via `firebirdExecuteTransaction`, idempotência
    (`STATUS_CHAMADO <> 'FINALIZADO'`), cálculo de `CONCLUSAO_CHAMADO` a partir da última OS do
    chamado (e fallback para "agora" quando não há OS), rate limit, validação de token.
  - `salvar-validacao/route.ts` — UPDATE de aprovação/reprovação individual de OS.
  - `avaliacao/route.ts` — regras de negócio: só chamado `FINALIZADO` pode ser avaliado, não pode
    avaliar duas vezes, permissão por `COD_CLIENTE`.
  - `firebird.ts` — teste direto de `executeFirebirdTransaction`: commit único ao final, rollback
    completo quando um statement no meio da lista falha.
- **CI**: `.github/workflows/test.yml` rodando `npm run lint` + `npm test` em push/PR para a branch
  principal.

### Fase 2 — Ampliar cobertura de integração (não detalhada rota-a-rota)

Autenticação (login, esqueci-senha, alterar-senha) e as demais rotas de `/api/chamados`,
`/api/dashboard` etc., seguindo o mesmo padrão de mock e organização da Fase 1, aplicado de forma
incremental.

### Fase 3 — E2E (Playwright)

- Setup do Playwright.
- Cenários no fluxo de validação do cliente (`/validar/[token]`): token válido → aprovar OS
  individual; token válido → "Validar chamado" (aprovar tudo); token inválido/expirado → bloqueado.
- Roda via `npm run test:e2e`, fora do CI padrão por enquanto (mais lento, precisa de ambiente com
  dados de teste).

## Fora de escopo (por ora)

- Banco Firebird de teste real (Docker/schema dedicado) — decisão explícita de mockar em vez de
  subir infraestrutura extra.
- E2E no CI — fica para quando houver ambiente de dados de teste estável.
- Testes da aplicação `gerproj-solutii` (fora do escopo desta conversa/spec).
