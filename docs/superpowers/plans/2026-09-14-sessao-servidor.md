# Sessão Real no Servidor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir sessão HMAC assinada em cookie `httpOnly` e um `middleware.ts` que gateia as
rotas de API do `gerproj-dashboard-cliente-local`, fechando os achados críticos 1 e 2 do
levantamento de segurança de 2026-09-14 (nenhuma rota verificava sessão no servidor;
`/api/usuarios` e `/api/admin/clientes` sem autorização).

**Architecture:** Um módulo `session.ts` assina/verifica tokens HMAC-SHA256 via Web Crypto
(`crypto.subtle` — compatível com o runtime Edge do middleware, ao contrário do `node:crypto` usado
nos dois tokens HMAC já existentes no projeto). `POST /api/login` passa a emitir o cookie de sessão
além do JSON de resposta de sempre. `src/middleware.ts` valida esse cookie em toda requisição a
`/api/*`, exceto 7 rotas públicas (login, logout, esqueci-senha, gerar-link-validacao,
salvar-validacao, validar-tudo e a leitura de OS usada pelo fluxo público de validação), e exige
papel ADM extra em 4 rotas administrativas.

**Tech Stack:** Next.js 15 (App Router, middleware Edge), TypeScript, Web Crypto API, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-sessao-servidor-design.md`

## Global Constraints

- Sem dependência nova — mesmo padrão HMAC-SHA256 já usado em `cliente-token.ts`/`link-validacao.ts`,
  só que com Web Crypto (`crypto.subtle`) em vez de `node:crypto`, porque o middleware roda em
  runtime Edge por padrão.
- Cookie de sessão: nome `sessao`, `HttpOnly; SameSite=Lax; Path=/`, `Secure` só quando
  `NODE_ENV==='production'` (evita quebrar `npm run dev` em `http://localhost`), `Max-Age` de 8 horas
  (28800s), renovado (sliding window) a cada requisição autenticada que passa pelo middleware.
- Rotas públicas (sem sessão): `/api/login`, `/api/esqueci-senha`, `/api/logout`,
  `/api/gerar-link-validacao`, `/api/salvar-validacao`, `/api/chamados/[codChamado]/validar-tudo`,
  `/api/chamados/[codChamado]/os`.
- Rotas ADM-only (sessão + `loginType==='consultor' && tipoUsuario==='ADM'`): `/api/usuarios`,
  `/api/admin/clientes`, `/api/clientes-ativos`, `/api/recursos-ativos`.
- `POST /api/chamados` continua acessível a qualquer sessão válida, mas exige sessão ADM
  especificamente quando o corpo trouxer `codClienteSelecionado`, `codRecursoSelecionado` ou
  `prioridadeSelecionada`.
- Nenhuma das ~23 rotas "gerais" restantes muda de comportamento interno nesta rodada — o middleware
  só adiciona a barreira de sessão; a correção do IDOR de `codCliente` (achado grave, catalogado no
  spec) fica para outra rodada.
- Testes seguem o padrão já estabelecido no projeto: Vitest, mocks via `vi.hoisted`/`vi.mock`, nunca
  tocando Firebird real. `session.ts` é testado com as funções reais (não mockadas) nos testes das
  rotas que o consomem, igual ao padrão já usado para `bcryptjs`/`senha-consultor.ts` em
  `login/route.test.ts`.

---

### Task 1: Módulo de sessão (`session.ts`) + segredo de teste

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`
- Modify: `vitest.config.ts`
- Modify: `.env` (local, não versionado)

**Interfaces:**
- Produces: `SessaoPayloadCliente`, `SessaoPayloadConsultor`, `SessaoPayload` (union), e as funções
  `assinarSessao(payload: SessaoPayload): Promise<string | null>`,
  `verificarSessao(token: string | null | undefined): Promise<SessaoPayload | null>`,
  `renovarSessao(payload: SessaoPayload): Promise<string | null>`, mais as constantes
  `SESSAO_COOKIE_NOME` (string) e `SESSAO_MAX_AGE_SEGUNDOS` (number) — usadas por todas as tarefas
  seguintes.

- [ ] **Step 1: Gerar e adicionar `SESSAO_SECRET` ao `.env` local**

Run:
```bash
node -e "console.log('SESSAO_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
```

`.env` já está no `.gitignore` (`.env*`) — esse segredo nunca é commitado. **Esse mesmo comando
precisa ser rodado (com um valor novo, não o mesmo) no ambiente de produção/hospedagem quando o
deploy acontecer** — sem `SESSAO_SECRET` configurado lá, `assinarSessao`/`verificarSessao` retornam
sempre `null` e ninguém consegue logar.

- [ ] **Step 2: Configurar `SESSAO_SECRET` para os testes em `vitest.config.ts`**

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        env: {
            SESSAO_SECRET: 'segredo-de-teste-nao-usar-em-producao',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
```

- [ ] **Step 3: Escrever o teste de `session.ts`**

```ts
// src/lib/auth/session.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    assinarSessao,
    renovarSessao,
    verificarSessao,
    type SessaoPayloadCliente,
} from './session';

const payloadCliente: SessaoPayloadCliente = {
    loginType: 'cliente',
    codCliente: '9',
    codRecurso: null,
    nomeRecurso: null,
    userEmail: 'cliente@teste.com',
    exp: Date.now() + 60_000,
};

describe('session (HMAC de sessão)', () => {
    it('assina e verifica um payload válido', async () => {
        const token = await assinarSessao(payloadCliente);
        expect(token).toBeTruthy();

        const verificado = await verificarSessao(token);
        expect(verificado).toEqual(payloadCliente);
    });

    it('retorna null quando o token foi adulterado', async () => {
        const token = await assinarSessao(payloadCliente);
        const adulterado = token!.slice(0, -1) + (token!.endsWith('A') ? 'B' : 'A');

        expect(await verificarSessao(adulterado)).toBeNull();
    });

    it('retorna null quando a sessão está expirada', async () => {
        const token = await assinarSessao({ ...payloadCliente, exp: Date.now() - 1000 });

        expect(await verificarSessao(token)).toBeNull();
    });

    it('retorna null para token malformado ou ausente', async () => {
        expect(await verificarSessao('nao-e-um-token-valido')).toBeNull();
        expect(await verificarSessao(null)).toBeNull();
        expect(await verificarSessao(undefined)).toBeNull();
    });

    it('renovarSessao gera um novo token com expiração adiante no tempo', async () => {
        const original = await assinarSessao(payloadCliente);
        const renovado = await renovarSessao(payloadCliente);

        expect(renovado).toBeTruthy();
        expect(renovado).not.toBe(original);

        const payloadRenovado = await verificarSessao(renovado);
        expect(payloadRenovado?.exp).toBeGreaterThan(payloadCliente.exp);
    });

    describe('sem SESSAO_SECRET configurado', () => {
        beforeEach(() => {
            vi.stubEnv('SESSAO_SECRET', '');
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('assinarSessao retorna null', async () => {
            expect(await assinarSessao(payloadCliente)).toBeNull();
        });

        it('verificarSessao retorna null mesmo com um token válido de antes', async () => {
            vi.stubEnv('SESSAO_SECRET', 'outro-valor-temporario');
            const token = await assinarSessao(payloadCliente);
            vi.stubEnv('SESSAO_SECRET', '');

            expect(await verificarSessao(token)).toBeNull();
        });
    });
});
```

- [ ] **Step 4: Rodar o teste para confirmar que falha (módulo ainda não existe)**

Run: `npm test -- src/lib/auth/session.test.ts`
Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 5: Implementar `session.ts`**

```ts
// src/lib/auth/session.ts
//
// Sessão real do servidor — substitui o "login" que hoje vive só no
// localStorage do navegador (useAuthStore.ts). Segue o mesmo padrão HMAC de
// cliente-token.ts/link-validacao.ts, mas usa Web Crypto (crypto.subtle) em
// vez de node:crypto — middleware.ts roda em runtime Edge por padrão no
// Next.js, e Web Crypto é a única API de assinatura disponível nos dois
// runtimes (Edge e Node) ao mesmo tempo.
//
// SESSAO_SECRET é lido a cada chamada (não capturado numa const no topo do
// módulo, diferente dos outros dois tokens) — isso deixa o módulo testável
// com vi.stubEnv() e evita depender da ordem de import/carregamento do
// arquivo em relação à configuração do ambiente.

const VALIDADE_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface SessaoPayloadCliente {
    loginType: 'cliente';
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;
    userEmail: string;
    exp: number;
}

export interface SessaoPayloadConsultor {
    loginType: 'consultor';
    codUsuario: number;
    idUsuario: string;
    nomeUsuario: string;
    tipoUsuario: 'USU' | 'ADM';
    permissoes: { permtar: boolean; perproj1: boolean; perproj2: boolean };
    userEmail: string;
    exp: number;
}

export type SessaoPayload = SessaoPayloadCliente | SessaoPayloadConsultor;

export const SESSAO_COOKIE_NOME = 'sessao';
export const SESSAO_MAX_AGE_SEGUNDOS = VALIDADE_MS / 1000;

function obterSecret(): string | undefined {
    return process.env.SESSAO_SECRET;
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
    const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function obterChave(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function assinarSessao(payload: SessaoPayload): Promise<string | null> {
    const secret = obterSecret();
    if (!secret) return null;

    const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const chave = await obterChave(secret);
    const assinaturaBuf = await crypto.subtle.sign(
        'HMAC',
        chave,
        new TextEncoder().encode(payloadB64)
    );
    const assinaturaB64 = bytesToBase64Url(new Uint8Array(assinaturaBuf));

    return `${payloadB64}.${assinaturaB64}`;
}

export async function verificarSessao(
    token: string | null | undefined
): Promise<SessaoPayload | null> {
    const secret = obterSecret();
    if (!token || !secret) return null;

    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [payloadB64, assinaturaB64] = partes;
    if (!payloadB64 || !assinaturaB64) return null;

    try {
        const chave = await obterChave(secret);
        const assinaturaValida = await crypto.subtle.verify(
            'HMAC',
            chave,
            base64UrlToBytes(assinaturaB64),
            new TextEncoder().encode(payloadB64)
        );
        if (!assinaturaValida) return null;

        const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
        const payload = JSON.parse(json) as SessaoPayload;
        if (typeof payload.exp !== 'number') return null;
        if (Date.now() > payload.exp) return null;

        return payload;
    } catch {
        return null;
    }
}

/** Reassina a sessão com uma nova expiração (sliding window) — usado pelo middleware a cada requisição autenticada. */
export async function renovarSessao(payload: SessaoPayload): Promise<string | null> {
    return assinarSessao({ ...payload, exp: Date.now() + VALIDADE_MS } as SessaoPayload);
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- src/lib/auth/session.test.ts`
Expected: PASS — 7 testes, 0 falhas.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts vitest.config.ts
git commit -m "feat: adiciona módulo de sessão HMAC (session.ts) via Web Crypto"
```

---

### Task 2: `middleware.ts` — gate de sessão para `/api/*`

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Interfaces:**
- Consumes: `assinarSessao`, `renovarSessao`, `verificarSessao`, `SESSAO_COOKIE_NOME`,
  `SESSAO_MAX_AGE_SEGUNDOS`, `SessaoPayloadCliente`, `SessaoPayloadConsultor` de
  `@/lib/auth/session` (Task 1).
- Produces: `export async function middleware(request: NextRequest)` — usado pelo runtime do
  Next.js automaticamente (nenhuma tarefa seguinte importa isso diretamente).

- [ ] **Step 1: Escrever o teste do middleware**

```ts
// src/middleware.test.ts
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
    assinarSessao,
    type SessaoPayloadCliente,
    type SessaoPayloadConsultor,
} from '@/lib/auth/session';
import { middleware } from './middleware';

function criarRequest(pathname: string, cookie?: string) {
    return new NextRequest(`http://localhost${pathname}`, {
        headers: cookie ? { cookie } : undefined,
    });
}

const payloadCliente: SessaoPayloadCliente = {
    loginType: 'cliente',
    codCliente: '9',
    codRecurso: null,
    nomeRecurso: null,
    userEmail: 'cliente@teste.com',
    exp: Date.now() + 60_000,
};

const payloadAdm: SessaoPayloadConsultor = {
    loginType: 'consultor',
    codUsuario: 1,
    idUsuario: 'jsilva',
    nomeUsuario: 'João Silva',
    tipoUsuario: 'ADM',
    permissoes: { permtar: true, perproj1: true, perproj2: true },
    userEmail: 'jsilva@solutii.com.br',
    exp: Date.now() + 60_000,
};

const payloadUsu: SessaoPayloadConsultor = { ...payloadAdm, tipoUsuario: 'USU' };

describe('middleware', () => {
    it('deixa passar rotas públicas sem cookie', async () => {
        const response = await middleware(criarRequest('/api/login'));
        expect(response.status).toBe(200);
    });

    it('deixa passar /api/logout sem cookie', async () => {
        const response = await middleware(criarRequest('/api/logout'));
        expect(response.status).toBe(200);
    });

    it('deixa passar validar-tudo sem cookie (rota pública dinâmica)', async () => {
        const response = await middleware(criarRequest('/api/chamados/501/validar-tudo'));
        expect(response.status).toBe(200);
    });

    it('deixa passar a leitura de OS sem cookie (usada pelo fluxo público /validar/[token])', async () => {
        const response = await middleware(criarRequest('/api/chamados/501/os'));
        expect(response.status).toBe(200);
    });

    it('retorna 401 numa rota protegida sem cookie de sessão', async () => {
        const response = await middleware(criarRequest('/api/chamados'));
        expect(response.status).toBe(401);
    });

    it('retorna 401 quando o cookie de sessão é inválido', async () => {
        const response = await middleware(criarRequest('/api/chamados', 'sessao=token-forjado'));
        expect(response.status).toBe(401);
    });

    it('deixa passar uma rota comum com sessão válida', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/chamados', `sessao=${token}`));
        expect(response.status).toBe(200);
    });

    it('renova o cookie de sessão numa requisição autenticada', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/chamados', `sessao=${token}`));

        const novoCookie = response.cookies.get('sessao');
        expect(novoCookie?.value).toBeTruthy();
        expect(novoCookie?.value).not.toBe(token);
    });

    it('retorna 403 quando um cliente comum tenta acessar rota ADM-only', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/usuarios', `sessao=${token}`));
        expect(response.status).toBe(403);
    });

    it('retorna 403 quando um consultor não-ADM tenta acessar rota ADM-only', async () => {
        const token = await assinarSessao(payloadUsu);
        const response = await middleware(criarRequest('/api/admin/clientes', `sessao=${token}`));
        expect(response.status).toBe(403);
    });

    it('deixa passar um consultor ADM numa rota ADM-only', async () => {
        const token = await assinarSessao(payloadAdm);
        const response = await middleware(criarRequest('/api/recursos-ativos', `sessao=${token}`));
        expect(response.status).toBe(200);
    });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- src/middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'`

- [ ] **Step 3: Implementar `middleware.ts`**

```ts
// src/middleware.ts
//
// Gate de sessão pra /api/* — fecha os achados críticos 1 e 2 do
// levantamento de segurança de 2026-09-14 (nenhuma rota verificava sessão
// no servidor). Roda em runtime Edge por padrão no Next.js; session.ts usa
// Web Crypto exatamente por isso.
import { NextRequest, NextResponse } from 'next/server';
import {
    renovarSessao,
    SESSAO_COOKIE_NOME,
    SESSAO_MAX_AGE_SEGUNDOS,
    verificarSessao,
} from '@/lib/auth/session';

// Protegidas por mecanismo próprio (chave interna, token HMAC do link de
// e-mail), são o próprio ponto de entrada, ou precisam funcionar mesmo sem
// sessão (logout). /os é usada tanto pela tela logada quanto pelo fluxo
// público /validar/[token] (ver spec — correção pós-brainstorm).
const ROTAS_PUBLICAS = new Set([
    '/api/login',
    '/api/esqueci-senha',
    '/api/logout',
    '/api/gerar-link-validacao',
    '/api/salvar-validacao',
]);

const REGEX_VALIDAR_TUDO = /^\/api\/chamados\/\d+\/validar-tudo$/;
const REGEX_OS = /^\/api\/chamados\/\d+\/os$/;

function isRotaPublica(pathname: string): boolean {
    return (
        ROTAS_PUBLICAS.has(pathname) ||
        REGEX_VALIDAR_TUDO.test(pathname) ||
        REGEX_OS.test(pathname)
    );
}

// Além de sessão válida, exigem loginType='consultor' && tipoUsuario='ADM'.
const ROTAS_ADM = new Set([
    '/api/usuarios',
    '/api/admin/clientes',
    '/api/clientes-ativos',
    '/api/recursos-ativos',
]);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isRotaPublica(pathname)) {
        return NextResponse.next();
    }

    const token = request.cookies.get(SESSAO_COOKIE_NOME)?.value;
    const sessao = await verificarSessao(token);

    if (!sessao) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (
        ROTAS_ADM.has(pathname) &&
        !(sessao.loginType === 'consultor' && sessao.tipoUsuario === 'ADM')
    ) {
        return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const response = NextResponse.next();

    const novoToken = await renovarSessao(sessao);
    if (novoToken) {
        response.cookies.set(SESSAO_COOKIE_NOME, novoToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSAO_MAX_AGE_SEGUNDOS,
        });
    }

    return response;
}

export const config = {
    matcher: ['/api/:path*'],
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/middleware.test.ts`
Expected: PASS — 11 testes, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat: middleware.ts gateia /api/* com sessão real (achados críticos 1 e 2)"
```

---

### Task 3: `POST /api/login` emite o cookie de sessão

**Files:**
- Modify: `src/app/api/login/route.ts:1-10` (imports), `:311-340` (sucesso consultor), `:352-369`
  (sucesso cliente)
- Modify: `src/app/api/login/route.test.ts`

**Interfaces:**
- Consumes: `assinarSessao`, `SESSAO_COOKIE_NOME`, `SESSAO_MAX_AGE_SEGUNDOS`,
  `SessaoPayloadConsultor`, `SessaoPayloadCliente` de `@/lib/auth/session` (Task 1).

- [ ] **Step 1: Adicionar o import de `session.ts` no topo do arquivo**

Em `src/app/api/login/route.ts`, junto aos imports já existentes (linha 1-9):

```ts
import {
    assinarSessao,
    SESSAO_COOKIE_NOME,
    SESSAO_MAX_AGE_SEGUNDOS,
} from '@/lib/auth/session';
```

- [ ] **Step 2: Adicionar o helper de cookie e emitir o cookie nos dois pontos de sucesso**

Logo antes de `// ==================== HANDLER PRINCIPAL ====================` (linha 278), adicionar:

```ts
function anexarCookieSessao(response: NextResponse, token: string | null): void {
    if (!token) return;
    response.cookies.set(SESSAO_COOKIE_NOME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSAO_MAX_AGE_SEGUNDOS,
    });
}
```

No bloco de sucesso do consultor (linha 332-333), trocar:

```ts
                            const resposta = construirRespostaConsultor(consultor);
                            return NextResponse.json(resposta, { status: 200 });
```

por:

```ts
                            const resposta = construirRespostaConsultor(consultor);
                            const response = NextResponse.json(resposta, { status: 200 });
                            const sessaoToken = await assinarSessao({
                                loginType: 'consultor',
                                codUsuario: consultor.COD_USUARIO,
                                idUsuario: consultor.ID_USUARIO,
                                nomeUsuario: consultor.NOME_USUARIO,
                                tipoUsuario: consultor.TIPO_USUARIO,
                                permissoes: {
                                    permtar: consultor.PERMTAR_USUARIO === 'SIM',
                                    perproj1: consultor.PERPROJ1_USUARIO === 'SIM',
                                    perproj2: consultor.PERPROJ2_USUARIO === 'SIM',
                                },
                                userEmail: email,
                                exp: Date.now() + SESSAO_MAX_AGE_SEGUNDOS * 1000,
                            });
                            anexarCookieSessao(response, sessaoToken);
                            return response;
```

No bloco de sucesso do cliente (linha 367-368), trocar:

```ts
                            const resposta = construirRespostaCliente(usuario);
                            return NextResponse.json(resposta, { status: 200 });
```

por:

```ts
                            const resposta = construirRespostaCliente(usuario);
                            const response = NextResponse.json(resposta, { status: 200 });
                            const sessaoToken = await assinarSessao({
                                loginType: 'cliente',
                                codCliente: usuario.cod_cliente ?? null,
                                codRecurso: usuario.codrec_os ?? null,
                                nomeRecurso: usuario.nome ?? null,
                                userEmail: email,
                                exp: Date.now() + SESSAO_MAX_AGE_SEGUNDOS * 1000,
                            });
                            anexarCookieSessao(response, sessaoToken);
                            return response;
```

- [ ] **Step 3: Atualizar os dois testes de sucesso existentes em `login/route.test.ts`**

No teste `'autentica um consultor ADM com sucesso'`, adicionar ao final (antes do fechamento do `it`):

```ts
        const cookie = response.cookies.get('sessao');
        expect(cookie?.value).toBeTruthy();
```

No teste `'autentica um cliente com sucesso'`, adicionar:

```ts
        const cookie = response.cookies.get('sessao');
        expect(cookie?.value).toBeTruthy();
```

- [ ] **Step 4: Adicionar um teste de integração ponta a ponta do cookie**

No topo de `login/route.test.ts`, importar `verificarSessao` de `@/lib/auth/session` (não
mockado — a mesma abordagem já usada para `bcryptjs`/`encodeSenhaConsultor` nesse arquivo). No fim
do `describe('POST /api/login', ...)`, adicionar:

```ts
    it('o cookie de sessão emitido é válido e reflete os dados do cliente autenticado', async () => {
        readFileMock.mockResolvedValueOnce(
            JSON.stringify([
                {
                    email: 'cliente@teste.com',
                    password: bcrypt.hashSync('Senha123!', 8),
                    cod_cliente: '10',
                    codrec_os: '5',
                    nome: 'Cliente Teste',
                },
            ])
        );

        const response = await POST(
            criarRequest({ email: 'cliente@teste.com', password: 'Senha123!' })
        );

        const cookie = response.cookies.get('sessao');
        const sessao = await verificarSessao(cookie?.value);
        expect(sessao).toMatchObject({ loginType: 'cliente', codCliente: '10' });
    });
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/api/login/route.test.ts`
Expected: PASS — 9 testes, 0 falhas (8 já existentes + 1 novo; os 2 de sucesso ganharam a asserção extra).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/login/route.ts src/app/api/login/route.test.ts
git commit -m "feat: POST /api/login emite cookie de sessão httpOnly"
```

---

### Task 4: `POST /api/logout`

**Files:**
- Create: `src/app/api/logout/route.ts`
- Test: `src/app/api/logout/route.test.ts`

**Interfaces:**
- Consumes: `SESSAO_COOKIE_NOME` de `@/lib/auth/session` (Task 1).

- [ ] **Step 1: Escrever o teste**

```ts
// src/app/api/logout/route.test.ts
import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/logout', () => {
    it('limpa o cookie de sessão', async () => {
        const response = await POST();

        expect(response.status).toBe(200);
        const cookie = response.cookies.get('sessao');
        expect(cookie?.value).toBe('');
        expect(cookie?.maxAge).toBe(0);
    });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- src/app/api/logout/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/logout/route.ts
import { SESSAO_COOKIE_NOME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSAO_COOKIE_NOME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return response;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/app/api/logout/route.test.ts`
Expected: PASS — 1 teste, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/logout/route.ts src/app/api/logout/route.test.ts
git commit -m "feat: adiciona POST /api/logout para limpar o cookie de sessão"
```

---

### Task 5: Checagem ADM inline em `POST /api/chamados`

**Files:**
- Modify: `src/app/api/chamados/route.ts:1-20` (imports), `:1497-1514` (validação de
  departamento/área/classificação, ponto de inserção)
- Modify: `src/app/api/chamados/route.test.ts`

**Interfaces:**
- Consumes: `verificarSessao`, `SESSAO_COOKIE_NOME` de `@/lib/auth/session` (Task 1).

- [ ] **Step 1: Adicionar o import no topo de `chamados/route.ts`**

Junto aos imports já existentes:

```ts
import { SESSAO_COOKIE_NOME, verificarSessao } from '@/lib/auth/session';
```

- [ ] **Step 2: Inserir a checagem logo depois da validação de departamento/área/classificação**

Depois do bloco que termina em (linha ~1512):

```ts
        if (
            codDepartamento == null ||
            Number.isNaN(codDepartamentoNum) ||
            codArea == null ||
            Number.isNaN(codAreaNum) ||
            codClassificacao == null ||
            Number.isNaN(codClassificacaoNum)
        ) {
            return NextResponse.json(
                { error: 'Departamento, módulo e tipo de solicitação são obrigatórios.' },
                { status: 400 }
            );
        }
```

adicionar:

```ts

        // Só ADM pode definir cliente/recurso/prioridade na abertura — cliente
        // comum continua abrindo chamado normalmente sem esses campos.
        if (codClienteSelecionado || codRecursoSelecionado || prioridadeSelecionada) {
            const sessaoToken = request.cookies.get(SESSAO_COOKIE_NOME)?.value;
            const sessao = await verificarSessao(sessaoToken);
            if (!sessao || sessao.loginType !== 'consultor' || sessao.tipoUsuario !== 'ADM') {
                return NextResponse.json(
                    {
                        error:
                            'Apenas administradores podem definir cliente, recurso ou prioridade na abertura do chamado.',
                    },
                    { status: 403 }
                );
            }
        }
```

- [ ] **Step 3: Atualizar o helper `criarRequest` em `chamados/route.test.ts` para aceitar cookie**

Trocar:

```ts
function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
```

por:

```ts
function criarRequest(body: unknown, cookie?: string) {
    return new NextRequest('http://localhost/api/chamados', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: cookie ? { cookie } : undefined,
    });
}
```

- [ ] **Step 4: Adicionar o import de `assinarSessao` e o helper de cookie ADM no topo do describe de POST**

No topo do arquivo, junto aos demais imports:

```ts
import { assinarSessao } from '@/lib/auth/session';
```

Logo antes de `describe('POST /api/chamados (criar chamado)', ...)`:

```ts
async function cookieSessaoAdm(): Promise<string> {
    const token = await assinarSessao({
        loginType: 'consultor',
        codUsuario: 1,
        idUsuario: 'admteste',
        nomeUsuario: 'Admin Teste',
        tipoUsuario: 'ADM',
        permissoes: { permtar: true, perproj1: true, perproj2: true },
        userEmail: 'admin@solutii.com.br',
        exp: Date.now() + 60_000,
    });
    return `sessao=${token}`;
}
```

- [ ] **Step 5: Passar o cookie ADM nos 3 testes existentes que usam campos de ADM**

Nos testes `'retorna 400 quando o cliente selecionado pelo ADM é inválido ou inativo'`,
`'retorna 400 quando o ADM abre o chamado sem informar prioridade válida'` e
`'retorna 400 quando o recurso selecionado é inválido ou inativo'`, trocar a chamada:

```ts
        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }))
        );
```

(e as duas variações equivalentes dos outros dois testes) por, respectivamente:

```ts
        const response = await POST(
            criarRequest(
                corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }),
                await cookieSessaoAdm()
            )
        );
```

```ts
        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99' }), await cookieSessaoAdm())
        );
```

```ts
        const response = await POST(
            criarRequest(corpoValido({ codRecursoSelecionado: '50' }), await cookieSessaoAdm())
        );
```

- [ ] **Step 6: Adicionar o teste do 403 para quem não é ADM**

Logo após o teste `'retorna 400 quando o recurso selecionado é inválido ou inativo'`:

```ts
    it('retorna 403 quando quem não é ADM tenta definir cliente/recurso/prioridade', async () => {
        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }))
        );

        expect(response.status).toBe(403);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/api/chamados/route.test.ts`
Expected: PASS — 24 testes, 0 falhas (23 já existentes + 1 novo).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/chamados/route.ts src/app/api/chamados/route.test.ts
git commit -m "feat: exige sessão ADM para definir cliente/recurso/prioridade em POST /api/chamados"
```

---

### Task 6: Frontend — logout limpa o cookie + redirect em 401

**Files:**
- Modify: `src/store/useAuthStore.ts` (função `logout`)
- Modify: `src/components/providers/AuthProvider.tsx`

**Interfaces:**
- Nenhuma — mudanças de UI, sem testes automatizados (o projeto não tem infraestrutura de teste de
  componente React ainda; verificação é manual, descrita no Step 3).

- [ ] **Step 1: `useAuthStore.ts` — `logout()` chama `POST /api/logout`**

Trocar:

```ts
    // ── Logout ──
    logout: () => {
        safeRemoveItem('isLoggedIn');
```

por:

```ts
    // ── Logout ──
    logout: () => {
        // Fire-and-forget: o cookie httpOnly só o servidor consegue limpar.
        // Se a chamada falhar (rede), o localStorage abaixo já foi limpo e o
        // cookie expira sozinho em até 8h.
        fetch('/api/logout', { method: 'POST' }).catch(() => {});

        safeRemoveItem('isLoggedIn');
```

(o restante da função continua idêntico).

- [ ] **Step 2: `AuthProvider.tsx` — redireciona pro login em qualquer 401 de `/api/*`**

Arquivo completo:

```tsx
// src/components/providers/AuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const hydrate = useAuthStore((state) => state.hydrate);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    // Sem cookie de sessão válido, toda rota de API (exceto as públicas)
    // responde 401 agora (ver middleware.ts). Sem esse handler, uma sessão
    // expirada vira erros soltos na tela em vez de cair no login. Não existe
    // um wrapper de fetch compartilhado no projeto — o app inteiro usa
    // fetch() direto — então o jeito de cobrir todo chamado existente sem
    // editar dezenas de arquivos é interceptar window.fetch uma vez aqui.
    useEffect(() => {
        const fetchOriginal = window.fetch;

        window.fetch = async (...args) => {
            const response = await fetchOriginal(...args);

            const input = args[0];
            const url = typeof input === 'string' ? input : (input as Request).url;

            if (response.status === 401 && url.includes('/api/') && !url.includes('/api/login')) {
                window.location.href = '/paginas/login';
            }

            return response;
        };

        return () => {
            window.fetch = fetchOriginal;
        };
    }, []);

    return <>{children}</>;
}
```

- [ ] **Step 3: Verificação manual**

Run: `npm run dev`

1. Fazer login normalmente (cliente ou consultor) — confirmar no DevTools → Application → Cookies
   que existe um cookie `sessao` (`HttpOnly` marcado, sem `Secure` em `localhost`).
2. Navegar pelo app normalmente — nada deve quebrar (as chamadas `fetch` continuam funcionando, só
   que agora o cookie vai junto automaticamente).
3. Clicar em "Sair" — confirmar que o cookie `sessao` some do DevTools e que a tela volta pro login.
4. Apagar manualmente o cookie `sessao` pelo DevTools sem fazer logout, depois clicar em qualquer
   ação que chame a API (ex: atualizar a lista de chamados) — confirmar que a página redireciona
   pro login em vez de mostrar erro solto.

- [ ] **Step 4: Commit**

```bash
git add src/store/useAuthStore.ts src/components/providers/AuthProvider.tsx
git commit -m "feat: logout limpa o cookie de sessão; redireciona pro login em 401"
```

---

### Task 7: Suíte completa, lint, push e verificação de CI

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os arquivos de teste (os já existentes da Fase 1/2 + os 4 novos desta rodada:
`session.test.ts`, `middleware.test.ts`, `logout/route.test.ts`, mais os 2 arquivos atualizados)
passam juntos.

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: exit code 0 (só os warnings pré-existentes documentados nas rodadas anteriores).

- [ ] **Step 3: Rodar os testes e2e do Playwright (Fase 3) para confirmar que o fluxo público não quebrou**

Run: `npm run test:e2e`
Expected: PASS — os 3 cenários de `/validar/[token]` continuam passando (a leitura de OS e a
validação continuam públicas, ver Task 2).

- [ ] **Step 4: Push**

```bash
git push
```

- [ ] **Step 5: Confirmar CI verde**

Run: `gh run list --workflow=test.yml --limit 1`
Expected: `completed success` para o commit mais recente.

- [ ] **Step 6: Lembrete de produção**

Antes do próximo deploy, configurar `SESSAO_SECRET` (valor diferente do usado em dev/teste) nas
variáveis de ambiente do ambiente de produção/hospedagem — sem isso, o login para de emitir sessão
válida e ninguém consegue usar o app depois do deploy.
