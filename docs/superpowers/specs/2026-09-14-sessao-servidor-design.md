# Sessão real no servidor — gerproj-dashboard-cliente-local

## Contexto

O levantamento de segurança publicado em 2026-09-14 (artifact "Segurança do Portal Cliente")
identificou três achados críticos:

1. **Nenhuma rota de API verifica sessão no servidor.** A "autenticação" vive inteiramente no
   `localStorage` do navegador (`src/store/useAuthStore.ts`) — puro estado de UI. Qualquer rota de
   API pode ser chamada diretamente (curl, Postman, DevTools) sem nunca ter passado pela tela de
   login.
2. **`/api/usuarios` e `/api/admin/clientes` sem nenhuma autorização** — vazam e-mail/nome de todos
   os usuários e a lista completa de clientes ativos pra qualquer requisição anônima.
3. **Duas dependências com CVE crítico conhecido** (`next`, `jspdf`) — tratado separadamente, fora
   deste spec (bump de versão + testes, sem mudança de arquitetura).

Este spec cobre os achados 1 e 2, que compartilham a mesma raiz: introduzir sessão real no servidor
resolve o achado 1 diretamente e, ao gatear as rotas administrativas com ela, fecha o achado 2 (e as
3 rotas do achado grave correlato: `clientes-ativos`, `recursos-ativos`, os campos de ADM em
`POST /api/chamados`).

**Fora de escopo desta rodada:** o achado grave de IDOR (quando o header `x-cliente-token` está
ausente, `resolveCodClienteSeguro()` ainda cai no parâmetro `codCliente` solto da URL/body, em ~17
rotas) continua de pé. A sessão nova bloqueia acesso *anônimo*, mas não impede um cliente autenticado
de tentar ler dados de outro `codCliente` nessas rotas — isso fica catalogado para uma rodada futura.

## Arquitetura

Um novo módulo, `src/lib/auth/session.ts`, segue o mesmo padrão dos dois tokens HMAC já existentes no
projeto (`cliente-token.ts`, `link-validacao.ts`): payload JSON codificado em base64url, assinado com
HMAC-SHA256, comparação de assinatura em tempo constante, expiração embutida no payload.

**Divergência técnica deliberada:** os dois tokens existentes usam `node:crypto`
(`crypto.createHmac`), que só funciona em runtime Node.js. Como `middleware.ts` roda em runtime Edge
por padrão no Next.js, `session.ts` usa **Web Crypto** (`crypto.subtle`) em vez de `node:crypto` — a
mesma API funciona em Edge e em Node, então o módulo não precisa se preocupar com runtime. Isso torna
`assinarSessao`/`verificarSessao` funções assíncronas (Web Crypto é Promise-based), diferente das
duas funções síncronas existentes.

```ts
// src/lib/auth/session.ts (assinatura das funções)
export async function assinarSessao(payload: SessaoPayload): Promise<string>;
export async function verificarSessao(token: string | undefined | null): Promise<SessaoPayload | null>;
```

`POST /api/login` passa a, além do JSON de resposta que já retorna hoje (mantém compatibilidade
total com o front atual, que continua populando o `localStorage` para exibição de UI), setar um
cookie de sessão via `Set-Cookie`:

```
sessao=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800
```

Um `middleware.ts` na raiz do projeto intercepta toda requisição a `/api/*`, exceto as 5 rotas
públicas listadas abaixo. Para cada requisição interceptada:

- sem cookie `sessao`, ou cookie inválido/expirado → `401 { error: 'Não autenticado' }`, a
  requisição nunca chega na rota
- sessão válida → o middleware **renova o cookie** (sliding window — reemite com nova expiração de
  8h) e deixa a requisição passar

### Rotas públicas (sem sessão)

Protegidas por mecanismo próprio, ou são o próprio ponto de entrada:

| Rota | Por quê |
|---|---|
| `POST /api/login` | é o próprio login |
| `POST /api/esqueci-senha` | fluxo de recuperação, anterior ao login |
| `POST /api/gerar-link-validacao` | protegido por `X-Internal-Key` (chamado só pelo sistema Delphi) |
| `POST /api/salvar-validacao` | fluxo público do link de e-mail, protegido pelo token HMAC próprio |
| `POST /api/chamados/[codChamado]/validar-tudo` | idem — mesmo fluxo de `/validar/[token]` |

### Rotas ADM-only

Além de sessão válida, o middleware exige `loginType === 'consultor' && tipoUsuario === 'ADM'` —
`403` se autenticado mas não-ADM:

- `GET /api/usuarios`
- `GET /api/admin/clientes`
- `GET /api/clientes-ativos`
- `GET /api/recursos-ativos`

`POST /api/chamados` **não** entra nessa lista (clientes comuns também abrem chamado por ali) — a
checagem de ADM roda **dentro da rota**, condicional aos campos: se o body trouxer
`codClienteSelecionado`, `codRecursoSelecionado` ou `prioridadeSelecionada`, exige sessão ADM antes
de aceitá-los; sem esses campos, qualquer sessão válida (cliente ou consultor) basta.

### Demais rotas (~24)

Exigem apenas sessão válida (qualquer `loginType`), sem checagem de papel adicional — mesmo
comportamento de hoje, só que agora com um usuário autenticado de verdade por trás.

## Payload da sessão

Replica o que já vive no `localStorage`/`useAuthStore` hoje, para que nenhuma rota perca informação
que já consumia:

```ts
interface SessaoPayloadCliente {
    loginType: 'cliente';
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;
    userEmail: string;
    exp: number;
}

interface SessaoPayloadConsultor {
    loginType: 'consultor';
    codUsuario: number;
    idUsuario: string;
    nomeUsuario: string;
    tipoUsuario: 'USU' | 'ADM';
    permissoes: { permtar: boolean; perproj1: boolean; perproj2: boolean };
    userEmail: string;
    exp: number;
}
```

## Logout

`localStorage` não guarda mais o segredo da sessão (o cookie é `HttpOnly` — o JavaScript do
navegador não consegue lê-lo nem apagá-lo). `logout()` em `useAuthStore.ts` passa a chamar
`POST /api/logout` (rota nova, sem corpo) antes de limpar o `localStorage` como já faz — o servidor
responde com `Set-Cookie: sessao=; Max-Age=0`, apagando o cookie do navegador.

## Frontend

O cookie é `HttpOnly` e mesma origem — o navegador o envia automaticamente em todo
`fetch('/api/...')` já existente no app. **Nenhuma das dezenas de chamadas fetch espalhadas pelo
front precisa mudar.** As únicas mudanças no frontend:

1. `useAuthStore.ts`: `logout()` chama `POST /api/logout`.
2. Um handler global de resposta `401`: qualquer chamada a `/api/*` que volte `401` redireciona para
   `/paginas/login` (ou a rota de login atual) — sem isso, uma sessão expirada vira erros soltos na
   tela em vez de cair no login. Ponto de integração natural: `ClientProvider.tsx`, que já envolve
   toda a árvore de páginas.

## Rollout

No deploy, qualquer usuário que já estivesse "logado" só via `localStorage` (sem o cookie novo) leva
`401` na primeira chamada de API e cai no login — precisa autenticar de novo uma vez. Esperado e
aceitável para uma correção de segurança; documentado aqui para não pegar o time de surpresa.

## Testes

- Unit: `session.test.ts` cobrindo `assinarSessao`/`verificarSessao` (payload válido, assinatura
  adulterada, expirado, malformado) — mesmo padrão dos testes de `firebird.ts`/rotas já existentes
  no projeto (Vitest, sem dependência externa).
- Integração: `middleware.test.ts` (ou testes das próprias rotas, mockando `verificarSessao`)
  cobrindo: sem cookie → 401; cookie inválido → 401; sessão de cliente comum tentando `/api/usuarios`
  → 403; sessão ADM em `/api/usuarios` → passa; as 5 rotas públicas seguem acessíveis sem cookie.
- Manual/e2e: fluxo de login real seta o cookie (`Set-Cookie` na resposta); logout limpa o cookie.

## Fora de escopo desta rodada

- IDOR de `codCliente` sem token (achado grave, catalogado, não neste spec).
- Bump de `next`/`jspdf` (achado crítico #3 — trilha separada, sem mudança de arquitetura).
- Proteção de páginas (client components) no nível de rota — a UX de redirecionar quando
  deslogado já existe hoje via `useAuthStore`; este spec cobre a camada de API, que é onde os dados
  vazam.
