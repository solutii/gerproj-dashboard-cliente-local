# Testes Automatizados — Fase 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar Vitest na aplicação `gerproj-dashboard-cliente-local`, escrever a primeira fatia de testes automatizados (unit dos formatters, integração das rotas do fluxo de finalização/validação, e do helper `executeFirebirdTransaction`), e ativar CI (GitHub Actions) rodando lint + testes em cada push/PR.

**Architecture:** Vitest com `environment: 'node'` roda unit e integração no mesmo comando (`npm test`). Testes de integração das rotas `/api/*` mockam `@/lib/firebird/firebird-client` (e, quando aplicável, `@/lib/auth/link-validacao` e `@/lib/rate-limit`) via `vi.mock` — nenhum teste desta fase toca um banco Firebird real. Cada arquivo de teste fica ao lado do arquivo que testa (`route.ts` → `route.test.ts`).

**Tech Stack:** Vitest (`vitest.config.ts` na raiz), TypeScript, Next.js 15 App Router (`next/server`: `NextRequest`/`NextResponse`), `vi.mock`/`vi.hoisted` para dublês de teste.

**Spec:** `docs/superpowers/specs/2026-09-14-testes-automatizados-design.md`

## Global Constraints

- Nenhum teste de integração conecta em Firebird real — tudo mockado via `@/lib/firebird/firebird-client` (`firebirdQuery`, `firebirdExecute`, `firebirdExecuteTransaction`).
- Testes ficam colocados ao lado do arquivo original: `arquivo.ts` → `arquivo.test.ts`.
- `vitest.config.ts` resolve o alias `@/*` para `./src/*`, igual ao `tsconfig.json`.
- `npm test` roda Vitest em modo não-interativo (`vitest run`), usado tanto localmente quanto no CI.
- CI (`.github/workflows/test.yml`) roda em push/PR para a branch `main`, executando `npm run lint` e `npm test`.
- Esta fase NÃO cobre e2e (Playwright) nem outras rotas além de `validar-tudo`, `salvar-validacao`, `avaliacao` e o helper `executeFirebirdTransaction` — isso é Fase 2/3 do spec.
- Como o código de produção já existe e está commitado, cada tarefa segue "escrever teste → rodar → confirmar que passa" (não há passo de "implementação" nem de "ver falhar primeiro", já que não estamos adicionando comportamento novo).

---

### Task 1: Configurar Vitest + primeiro teste unitário (`formatar-numeros.ts`)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)
- Test: `src/formatters/formatar-numeros.test.ts`

**Interfaces:**
- Consumes: `formatarNumeros`, `formatarPrioridade` de `src/formatters/formatar-numeros.ts` (já existentes, não mudam).
- Produces: comando `npm test` funcional para todas as tarefas seguintes; alias `@/*` resolvido em testes.

- [ ] **Step 1: Instalar o Vitest**

Run: `npm install --save-dev vitest`

Isso adiciona `vitest` em `devDependencies` no `package.json` (o npm escolhe a versão estável mais recente compatível).

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
// vitest.config.ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
```

- [ ] **Step 3: Adicionar scripts de teste no `package.json`**

Em `"scripts"`, adicionar (mantendo os demais scripts existentes):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escrever o teste de `formatar-numeros.ts`**

```ts
// src/formatters/formatar-numeros.test.ts
import { describe, expect, it } from 'vitest';
import { formatarNumeros, formatarPrioridade } from './formatar-numeros';

describe('formatarNumeros', () => {
    it('formata número inteiro com separador de milhar', () => {
        expect(formatarNumeros(1234567)).toBe('1.234.567');
    });

    it('aceita valor em string, descartando caracteres não numéricos', () => {
        expect(formatarNumeros('OS-000123')).toBe('123');
    });

    it('retorna string vazia para null/undefined', () => {
        expect(formatarNumeros(null)).toBe('');
        expect(formatarNumeros(undefined)).toBe('');
    });

    it('trata o número 0 como valor válido (não como "vazio")', () => {
        expect(formatarNumeros(0)).toBe('0');
    });

    it('retorna string vazia quando não sobra nenhum dígito', () => {
        expect(formatarNumeros('abc')).toBe('');
    });
});

describe('formatarPrioridade', () => {
    it('prefixa a prioridade com "P-"', () => {
        expect(formatarPrioridade(3)).toBe('P-3');
    });
});
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- src/formatters/formatar-numeros.test.ts`
Expected: PASS — 6 testes, 0 falhas. Isso confirma que o Vitest, o alias `@/*` e o `tsconfig` estão funcionando corretamente antes de seguir para as próximas tarefas.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/formatters/formatar-numeros.test.ts
git commit -m "test: configura Vitest e adiciona testes de formatarNumeros/formatarPrioridade"
```

---

### Task 2: Testes unitários de `formatar-data.ts`

**Files:**
- Test: `src/formatters/formatar-data.test.ts`

**Interfaces:**
- Consumes: `formatarDataParaBR`, `formatarDataHoraChamado` de `src/formatters/formatar-data.ts` (já existentes).

- [ ] **Step 1: Escrever o teste**

```ts
// src/formatters/formatar-data.test.ts
import { describe, expect, it } from 'vitest';
import { formatarDataHoraChamado, formatarDataParaBR } from './formatar-data';

describe('formatarDataParaBR', () => {
    it('retorna placeholder para valor vazio', () => {
        expect(formatarDataParaBR(null)).toBe('---------------');
        expect(formatarDataParaBR(undefined)).toBe('---------------');
        expect(formatarDataParaBR('')).toBe('---------------');
    });

    it('mantém valor já no formato dd/mm/yyyy', () => {
        expect(formatarDataParaBR('25/12/2026')).toBe('25/12/2026');
    });

    it('converte formato ISO yyyy-mm-dd para dd/mm/yyyy', () => {
        expect(formatarDataParaBR('2026-01-05')).toBe('05/01/2026');
    });

    it('converte ISO com hora (yyyy-mm-ddTHH:mm) quando incluirHora=true', () => {
        expect(formatarDataParaBR('2026-01-05T14:30:00', true)).toBe('05/01/2026 - 14:30');
    });

    it('devolve o valor original quando não reconhece o formato', () => {
        expect(formatarDataParaBR('não é uma data')).toBe('não é uma data');
    });
});

describe('formatarDataHoraChamado', () => {
    it('junta data e hora formatadas com um traço', () => {
        expect(formatarDataHoraChamado('2026-01-05', '1430')).toBe('05/01/2026 - 14:30');
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- src/formatters/formatar-data.test.ts`
Expected: PASS — 6 testes, 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add src/formatters/formatar-data.test.ts
git commit -m "test: adiciona testes de formatarDataParaBR/formatarDataHoraChamado"
```

---

### Task 3: Testes unitários de `formatar-hora.ts` (`formatarHora`)

**Files:**
- Test: `src/formatters/formatar-hora.test.ts`

**Interfaces:**
- Consumes: `formatarHora` de `src/formatters/formatar-hora.ts` (já existente).

- [ ] **Step 1: Escrever o teste**

```ts
// src/formatters/formatar-hora.test.ts
import { describe, expect, it } from 'vitest';
import { formatarHora } from './formatar-hora';

describe('formatarHora', () => {
    it('retorna "-" para valor vazio', () => {
        expect(formatarHora(null)).toBe('-');
        expect(formatarHora(undefined)).toBe('-');
        expect(formatarHora('')).toBe('-');
    });

    it('aceita formato HH:MM:SS', () => {
        expect(formatarHora('15:00:00')).toBe('15:00');
    });

    it('aceita formato HHMM (4 dígitos)', () => {
        expect(formatarHora('1500')).toBe('15:00');
    });

    it('retorna "-" para formato não reconhecido', () => {
        expect(formatarHora('meio-dia')).toBe('-');
    });

    it('retorna "-" para hora ou minuto fora do intervalo válido', () => {
        expect(formatarHora('2500')).toBe('-');
        expect(formatarHora('0075')).toBe('-');
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- src/formatters/formatar-hora.test.ts`
Expected: PASS — 5 testes, 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add src/formatters/formatar-hora.test.ts
git commit -m "test: adiciona testes de formatarHora"
```

---

### Task 4: Teste de `executeFirebirdTransaction` (`firebird.ts`)

**Files:**
- Test: `src/lib/firebird/firebird.test.ts`

**Interfaces:**
- Consumes: `executeFirebirdTransaction(statements: Array<{ sql: string; params?: any[] }>): Promise<void>` de `src/lib/firebird/firebird.ts` (já existente).
- Mocka os módulos `node-firebird` e `node-firebird/lib/wire/serialize` (para não abrir conexão real nem quebrar no patch de encoding que roda no topo de `firebird.ts`).

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/firebird/firebird.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeFirebirdTransaction } from './firebird';

const { mockPoolGet, mockDbTransaction, mockDbDetach } = vi.hoisted(() => ({
    mockPoolGet: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockDbDetach: vi.fn(),
}));

vi.mock('node-firebird', () => ({
    default: {
        ISOLATION_READ_COMMITTED: 'ISOLATION_READ_COMMITTED',
        pool: vi.fn(() => ({ get: mockPoolGet })),
    },
}));

vi.mock('node-firebird/lib/wire/serialize', () => ({
    XdrReader: class {
        readText() {
            return '';
        }
    },
    XdrWriter: class {
        addText() {
            return this;
        }
    },
}));

function criarTransactionMock() {
    return {
        query: vi.fn(),
        commit: vi.fn((cb: (err: Error | null) => void) => cb(null)),
        rollback: vi.fn((cb?: () => void) => cb?.()),
    };
}

function conectarComo(transaction: ReturnType<typeof criarTransactionMock>) {
    mockDbTransaction.mockImplementation(
        (_iso: unknown, cb: (err: Error | null, tx: unknown) => void) => cb(null, transaction)
    );
    mockPoolGet.mockImplementation((cb: (err: Error | null, db: unknown) => void) =>
        cb(null, { transaction: mockDbTransaction, detach: mockDbDetach })
    );
}

describe('executeFirebirdTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('roda todos os statements na mesma transação e comita uma vez', async () => {
        const transaction = criarTransactionMock();
        transaction.query.mockImplementation(
            (_sql: string, _params: unknown[], cb: (err: Error | null) => void) => cb(null)
        );
        conectarComo(transaction);

        await executeFirebirdTransaction([
            {
                sql: `UPDATE CHAMADO SET STATUS_CHAMADO = 'FINALIZADO' WHERE COD_CHAMADO = ?`,
                params: [123],
            },
            {
                sql: `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?)`,
                params: [1, 123, 'FINALIZADO'],
            },
        ]);

        expect(transaction.query).toHaveBeenCalledTimes(2);
        expect(transaction.commit).toHaveBeenCalledTimes(1);
        expect(transaction.rollback).not.toHaveBeenCalled();
        expect(mockDbDetach).toHaveBeenCalledTimes(1);
    });

    it('faz rollback de tudo quando um statement no meio falha', async () => {
        const transaction = criarTransactionMock();
        const erro = new Error('coluna inválida');
        let chamada = 0;
        transaction.query.mockImplementation(
            (_sql: string, _params: unknown[], cb: (err: Error | null) => void) => {
                chamada += 1;
                cb(chamada === 1 ? null : erro);
            }
        );
        conectarComo(transaction);

        await expect(
            executeFirebirdTransaction([
                {
                    sql: `UPDATE CHAMADO SET STATUS_CHAMADO = 'FINALIZADO' WHERE COD_CHAMADO = ?`,
                    params: [123],
                },
                {
                    sql: `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?)`,
                    params: [1, 123, 'FINALIZADO'],
                },
            ])
        ).rejects.toThrow('coluna inválida');

        expect(transaction.commit).not.toHaveBeenCalled();
        expect(transaction.rollback).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- src/lib/firebird/firebird.test.ts`
Expected: PASS — 2 testes, 0 falhas.

Se der erro do tipo "Cannot find module 'node-firebird/lib/wire/serialize'" ou similar relacionado ao patch de encoding: confirme que os dois `vi.mock(...)` estão presentes exatamente como acima — eles substituem tanto o pacote `node-firebird` quanto o submódulo interno usado no patch de leitura/escrita no topo de `firebird.ts`, evitando que o teste tente carregar o driver real.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebird/firebird.test.ts
git commit -m "test: cobre commit/rollback atômico de executeFirebirdTransaction"
```

---

### Task 5: Testes de integração de `salvar-validacao/route.ts`

**Files:**
- Test: `src/app/api/salvar-validacao/route.test.ts`

**Interfaces:**
- Consumes: `POST` de `src/app/api/salvar-validacao/route.ts` (já existente); mocka `firebirdQuery`/`firebirdExecute` de `@/lib/firebird/firebird-client` e `verificarLinkValidacao` de `@/lib/auth/link-validacao`.

- [ ] **Step 1: Escrever o teste**

```ts
// src/app/api/salvar-validacao/route.test.ts
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { firebirdQueryMock, firebirdExecuteMock, verificarLinkValidacaoMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
    verificarLinkValidacaoMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

vi.mock('@/lib/auth/link-validacao', () => ({
    verificarLinkValidacao: verificarLinkValidacaoMock,
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/salvar-validacao', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/salvar-validacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando cod_os não é informado', async () => {
        const response = await POST(criarRequest({ concordaPagar: true }));
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Número da OS é obrigatório');
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando o link de validação é inválido', async () => {
        verificarLinkValidacaoMock.mockReturnValue(null);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-invalido' })
        );

        expect(response.status).toBe(403);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando a OS não existe', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-valido' })
        );

        expect(response.status).toBe(404);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando a OS pertence a outro cliente', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 999 }]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-valido' })
        );

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando reprova sem informar observação', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);

        const response = await POST(
            criarRequest({
                cod_os: 10,
                concordaPagar: false,
                observacao: '  ',
                linkToken: 'token-valido',
            })
        );

        expect(response.status).toBe(400);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('aprova a OS e grava VALCLI_OS=SIM, OBSCLI_OS=null', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, observacao: '', linkToken: 'token-valido' })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.valcli_os).toBe('SIM');

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [sql, params] = firebirdExecuteMock.mock.calls[0];
        expect(sql).toContain('UPDATE OS');
        expect(params[0]).toBe('SIM');
        expect(params[1]).toBeNull();
        expect(params[3]).toBe(10);
    });

    it('reprova a OS e grava VALCLI_OS=NAO com a observação informada', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({
                cod_os: 10,
                concordaPagar: false,
                observacao: 'Horas divergentes do combinado',
                linkToken: 'token-valido',
            })
        );

        expect(response.status).toBe(200);
        const [, params] = firebirdExecuteMock.mock.calls[0];
        expect(params[0]).toBe('NAO');
        expect(params[1]).toBe('Horas divergentes do combinado');
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- src/app/api/salvar-validacao/route.test.ts`
Expected: PASS — 7 testes, 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/salvar-validacao/route.test.ts
git commit -m "test: cobre validações e escrita de /api/salvar-validacao"
```

---

### Task 6: Testes de integração de `avaliacao/route.ts`

**Files:**
- Test: `src/app/api/chamados/[codChamado]/avaliacao/route.test.ts`

**Interfaces:**
- Consumes: `POST` e `GET` de `src/app/api/chamados/[codChamado]/avaliacao/route.ts` (já existentes); mocka `firebirdQuery`/`firebirdExecute` de `@/lib/firebird/firebird-client`.

- [ ] **Step 1: Escrever o teste**

```ts
// src/app/api/chamados/[codChamado]/avaliacao/route.test.ts
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const { firebirdQueryMock, firebirdExecuteMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados/55/avaliacao', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/chamados/[codChamado]/avaliacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codChamado não é um número válido', async () => {
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: 'abc' },
        });
        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando a avaliação está fora do intervalo 1-5', async () => {
        const response = await POST(criarRequest({ avaliacao: 6, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o chamado não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(404);
    });

    it('retorna 403 quando o chamado pertence a outro cliente', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 1, COD_CLIENTE: 999 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o chamado ainda não está finalizado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'EM ATENDIMENTO', AVALIA_CHAMADO: 1, COD_CLIENTE: 9 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Apenas chamados finalizados podem ser avaliados');
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o chamado já foi avaliado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 4, COD_CLIENTE: 9 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Este chamado já foi avaliado anteriormente');
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('salva a avaliação quando o chamado está finalizado e ainda não foi avaliado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 1, COD_CLIENTE: 9 },
        ]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({ avaliacao: 5, observacao: 'Ótimo atendimento', codCliente: '9' }),
            { params: { codChamado: '55' } }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [sql, params] = firebirdExecuteMock.mock.calls[0];
        expect(sql).toContain('UPDATE CHAMADO');
        expect(params).toEqual([5, 'Ótimo atendimento', 55]);
    });
});

describe('GET /api/chamados/[codChamado]/avaliacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 404 quando o chamado não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);
        const response = await GET(new NextRequest('http://localhost/api/chamados/55/avaliacao'), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(404);
    });

    it('retorna os dados da avaliação e foiAvaliado calculado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_CHAMADO: 55,
                AVALIA_CHAMADO: 4,
                OBSAVAL_CHAMADO: 'Bom atendimento',
                STATUS_CHAMADO: 'FINALIZADO',
            },
        ]);

        const response = await GET(new NextRequest('http://localhost/api/chamados/55/avaliacao'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.foiAvaliado).toBe(true);
        expect(body.avaliacao).toBe(4);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- "src/app/api/chamados/[codChamado]/avaliacao/route.test.ts"`
Expected: PASS — 9 testes, 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/chamados/[codChamado]/avaliacao/route.test.ts"
git commit -m "test: cobre regras de negócio de /api/chamados/[codChamado]/avaliacao"
```

---

### Task 7: Testes de integração de `validar-tudo/route.ts`

**Files:**
- Test: `src/app/api/chamados/[codChamado]/validar-tudo/route.test.ts`

**Interfaces:**
- Consumes: `POST` de `src/app/api/chamados/[codChamado]/validar-tudo/route.ts` (já existente); mocka `firebirdExecute`/`firebirdExecuteTransaction`/`firebirdQuery` de `@/lib/firebird/firebird-client`, `verificarLinkValidacao` de `@/lib/auth/link-validacao`, e `excedeuLimite`/`obterIp` de `@/lib/rate-limit` (evita depender do estado real do rate limiter, que é compartilhado entre testes via módulo).

- [ ] **Step 1: Escrever o teste**

```ts
// src/app/api/chamados/[codChamado]/validar-tudo/route.test.ts
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const {
    firebirdExecuteMock,
    firebirdExecuteTransactionMock,
    firebirdQueryMock,
    verificarLinkValidacaoMock,
    excedeuLimiteMock,
} = vi.hoisted(() => ({
    firebirdExecuteMock: vi.fn(),
    firebirdExecuteTransactionMock: vi.fn(),
    firebirdQueryMock: vi.fn(),
    verificarLinkValidacaoMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdExecute: firebirdExecuteMock,
    firebirdExecuteTransaction: firebirdExecuteTransactionMock,
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('@/lib/auth/link-validacao', () => ({
    verificarLinkValidacao: verificarLinkValidacaoMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados/55/validar-tudo', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/chamados/[codChamado]/validar-tudo', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest({ token: 'qualquer' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(429);
        expect(verificarLinkValidacaoMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando codChamado não é válido', async () => {
        const response = await POST(criarRequest({ token: 'qualquer' }), {
            params: { codChamado: 'abc' },
        });
        expect(response.status).toBe(400);
    });

    it('retorna 403 quando o token é inválido ou expirado', async () => {
        verificarLinkValidacaoMock.mockReturnValue(null);

        const response = await POST(criarRequest({ token: 'invalido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando o token é de outro chamado', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 999, codCliente: '9' });

        const response = await POST(criarRequest({ token: 'de-outro-chamado' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('aprova todas as OS e finaliza o chamado atomicamente', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdExecuteMock.mockResolvedValueOnce(undefined);
        firebirdQueryMock
            .mockResolvedValueOnce([{ DATA: null, HORA: null }])
            .mockResolvedValueOnce([{ ID: 501 }]);
        firebirdExecuteTransactionMock.mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest({ token: 'valido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [updateOsSql, updateOsParams] = firebirdExecuteMock.mock.calls[0];
        expect(updateOsSql).toContain('UPDATE OS');
        expect(updateOsParams[1]).toBe('55');

        expect(firebirdExecuteTransactionMock).toHaveBeenCalledTimes(1);
        const statements = firebirdExecuteTransactionMock.mock.calls[0][0];
        expect(statements).toHaveLength(2);
        expect(statements[0].sql).toContain('UPDATE CHAMADO');
        expect(statements[0].sql).toContain("STATUS_CHAMADO <> 'FINALIZADO'");
        expect(statements[0].params[1]).toBe(55);
        expect(statements[1].sql).toContain('INSERT INTO HISTCHAMADO');
        expect(statements[1].params).toEqual([
            501,
            55,
            expect.any(String),
            expect.any(String),
            'FINALIZADO',
        ]);
    });

    it('retorna 500 quando a transação de finalização falha', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdExecuteMock.mockResolvedValueOnce(undefined);
        firebirdQueryMock
            .mockResolvedValueOnce([{ DATA: null, HORA: null }])
            .mockResolvedValueOnce([{ ID: 501 }]);
        firebirdExecuteTransactionMock.mockRejectedValueOnce(new Error('conexão perdida'));

        const response = await POST(criarRequest({ token: 'valido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Erro ao validar chamado');
    });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- "src/app/api/chamados/[codChamado]/validar-tudo/route.test.ts"`
Expected: PASS — 6 testes, 0 falhas.

- [ ] **Step 3: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os arquivos de teste criados nas Tasks 1-7 passam juntos, sem interferência entre eles (cada `vi.mock` é isolado por arquivo de teste).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/chamados/[codChamado]/validar-tudo/route.test.ts"
git commit -m "test: cobre validar-tudo (rate limit, token, finalização atômica, erro)"
```

---

### Task 8: CI — GitHub Actions rodando lint + testes

**Files:**
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: scripts `npm run lint` e `npm test` do `package.json` (lint já existia; `test` foi criado na Task 1).

- [ ] **Step 1: Criar o workflow**

```yaml
# .github/workflows/test.yml
name: Test

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: npm

            - run: npm ci
            - run: npm run lint
            - run: npm test
```

> A raiz do repositório git (`git rev-parse --show-toplevel`) já é a própria pasta `gerproj-dashboard-cliente-local` — por isso o workflow não precisa de `working-directory`/`cache-dependency-path`.

- [ ] **Step 2: Validar o YAML localmente**

Run: `python -c "import yaml, sys; yaml.safe_load(open('.github/workflows/test.yml'))" 2>NUL || echo "sem PyYAML disponível — revisar visualmente a indentação"`

(Se não houver Python/PyYAML disponível, revise visualmente: chaves alinhadas, sem tabs, `steps` como lista.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: roda lint e testes automaticamente em push/PR para main"
```

- [ ] **Step 4: Push e verificar a execução**

Run: `git push`

Depois do push, confira na aba "Actions" do repositório no GitHub que o workflow "Test" rodou e passou (lint + `npm test` verdes). Esse é o critério final de sucesso da Fase 1: CI verde protegendo o fluxo de finalização/validação de chamado contra regressões.
