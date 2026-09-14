import { assinarSessao } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, limparCacheChamados, POST } from './route';

const {
    firebirdQueryMock,
    firebirdExecuteMock,
    sendMailMock,
    enviarWhatsAppMock,
    excedeuLimiteMock,
} = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
    sendMailMock: vi.fn(),
    enviarWhatsAppMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

vi.mock('@/lib/mail/mailer', () => ({
    sendMail: sendMailMock,
}));

vi.mock('@/lib/whatsapp/zap', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/lib/whatsapp/zap')>();
    return { ...real, enviarWhatsApp: enviarWhatsAppMock };
});

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function corpoValido(extra: Record<string, unknown> = {}) {
    return {
        assunto: 'Erro na agenda',
        solicitacao: 'Não consigo abrir a agenda do módulo financeiro.',
        codCliente: '9',
        solicitante: 'Fulano de Tal',
        email: 'fulano@cliente.com',
        telefone: '31999998888',
        codDepartamento: '1',
        codArea: '2',
        rotina: 'Agenda',
        codClassificacao: '3',
        ...extra,
    };
}

function criarRequest(body: unknown, cookie?: string) {
    return new NextRequest('http://localhost/api/chamados', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: cookie ? { cookie } : undefined,
    });
}

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

describe('POST /api/chamados (criar chamado)', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
        sendMailMock.mockResolvedValue(undefined);
        enviarWhatsAppMock.mockResolvedValue('ok');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(429);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando assunto ou descrição estão vazios', async () => {
        const response = await POST(criarRequest(corpoValido({ assunto: '  ' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Assunto e descrição são obrigatórios.');
    });

    it('retorna 400 quando solicitante, e-mail ou telefone estão vazios', async () => {
        const response = await POST(criarRequest(corpoValido({ telefone: '' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Solicitante, e-mail e telefone são obrigatórios.');
    });

    it('retorna 400 quando departamento, área ou classificação estão ausentes', async () => {
        const response = await POST(criarRequest(corpoValido({ codDepartamento: undefined })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Departamento, módulo e tipo de solicitação são obrigatórios.');
    });

    it('retorna 400 quando o cliente selecionado pelo ADM é inválido ou inativo', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // CLIENTE ativo -> não encontrado

        const response = await POST(
            criarRequest(
                corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }),
                await cookieSessaoAdm()
            )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Cliente selecionado inválido ou inativo.');
    });

    it('retorna 400 quando o ADM abre o chamado sem informar prioridade válida', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 99 }]); // CLIENTE ativo -> ok

        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99' }), await cookieSessaoAdm())
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Prioridade é obrigatória e deve ser 1, 2 ou 3.');
    });

    it('retorna 400 quando o recurso selecionado é inválido ou inativo', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // RECURSO ativo -> não encontrado

        const response = await POST(
            criarRequest(corpoValido({ codRecursoSelecionado: '50' }), await cookieSessaoAdm())
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Recurso selecionado inválido ou inativo.');
    });

    it('retorna 403 quando quem não é ADM tenta definir cliente/recurso/prioridade', async () => {
        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }))
        );

        expect(response.status).toBe(403);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o cliente final não é encontrado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // lookup final de CLIENTE -> não encontrado

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toBe('Cliente não encontrado.');
    });

    it('cria o chamado (fluxo do próprio cliente), grava STATUS NAO INICIADO e dispara notificações', async () => {
        firebirdQueryMock
            // lookup final de CLIENTE (CEL/ZAP/NOME)
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            // inserirChamado: próximo COD_CHAMADO
            .mockResolvedValueOnce([{ PROXIMO: 501 }]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.cod_chamado).toBe(501);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [insertSql, insertParams] = firebirdExecuteMock.mock.calls[0];
        expect(insertSql).toContain('INSERT INTO CHAMADO');
        expect(insertParams[0]).toBe(501); // COD_CHAMADO
        expect(insertParams[3]).toBe('NAO INICIADO'); // STATUS_CHAMADO (sem recurso)
        expect(insertParams[4]).toBe('[Cliente] Erro na agenda'); // ASSUNTO_CHAMADO prefixado

        // E-mail pro suporte + confirmação pro solicitante.
        expect(sendMailMock).toHaveBeenCalledTimes(2);

        // WhatsApp: pelo menos pro telefone digitado no formulário.
        expect(enviarWhatsAppMock).toHaveBeenCalledWith('31999998888', expect.any(String));
    });

    it('tenta novamente ao colidir com a PK (COD_CHAMADO já usado por outro processo)', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            .mockResolvedValueOnce([{ PROXIMO: 501 }])
            .mockResolvedValueOnce([{ PROXIMO: 502 }]);
        firebirdExecuteMock
            .mockRejectedValueOnce(new Error('violation of PRIMARY KEY constraint'))
            .mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.cod_chamado).toBe(502);
        expect(firebirdExecuteMock).toHaveBeenCalledTimes(2);
    });

    it('retorna 500 quando a criação do chamado falha por um erro que não é de colisão de PK', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            .mockResolvedValueOnce([{ PROXIMO: 501 }]);
        firebirdExecuteMock.mockRejectedValueOnce(new Error('conexão perdida'));

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(500);
        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
    });
});

function criarGetRequest(query: string) {
    return new NextRequest(`http://localhost/api/chamados${query}`);
}

function chamadoRawFixture(overrides: Record<string, unknown> = {}) {
    return {
        COD_CHAMADO: 501,
        DATA_CHAMADO: new Date(2026, 0, 6),
        HORA_CHAMADO: '0900',
        SOLICITACAO_CHAMADO: '<p>Erro na agenda</p>',
        CONCLUSAO_CHAMADO: null,
        STATUS_CHAMADO: 'ATRIBUIDO',
        DTENVIO_CHAMADO: '06/01/2026 09:00',
        DTINI_CHAMADO: null,
        ASSUNTO_CHAMADO: '[Cliente] Erro na agenda',
        EMAIL_CHAMADO: 'fulano@cliente.com',
        PRIOR_CHAMADO: 100,
        COD_CLASSIFICACAO: 3,
        COD_RECURSO: null,
        NOME_CLIENTE: 'Cliente Teste',
        NOME_RECURSO: null,
        NOME_CLASSIFICACAO: 'Erro',
        AVALIA_CHAMADO: 1,
        OBSAVAL_CHAMADO: null,
        TOTAL_HORAS_OS: 2,
        TOTAL_HORAS_OS_FATURADAS: 2,
        TOTAL_HORAS_OS_NAO_FATURADAS: 0,
        DATA_HISTCHAMADO: null,
        HORA_HISTCHAMADO: null,
        DATA_INICIO_ATENDIMENTO: null,
        HORA_INICIO_ATENDIMENTO: null,
        POSSUI_OS: 1,
        ...overrides,
    };
}

const totaisFixture = [
    { TOTAL_OS: 1, TOTAL_HORAS: 2, TOTAL_HORAS_OS_NAO_FATURADAS: 0, TOTAL_HORAS_OS_FATURADAS: 2 },
];
const nomeClienteFixture = [{ NOME_CLIENTE: 'Cliente Teste' }];

describe('GET /api/chamados (listagem)', () => {
    beforeEach(() => {
        limparCacheChamados();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando status=FINALIZADO sem mes/ano', async () => {
        const response = await GET(criarGetRequest('?codCliente=9&statusFilter=FINALIZADO'));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando status=TODOS sem mes/ano', async () => {
        const response = await GET(criarGetRequest('?codCliente=9&statusFilter=TODOS'));

        expect(response.status).toBe(400);
    });

    it('retorna 400 quando mes é informado sem ano', async () => {
        const response = await GET(criarGetRequest('?codCliente=9&mes=5'));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Se informar 'mes', deve informar 'ano' também");
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarGetRequest(''));

        expect(response.status).toBe(400);
    });

    it('retorna 400 quando page é menor que 1', async () => {
        // Number('0') || 1 resolve para 1 (0 é falsy em JS) — só valores
        // negativos de fato acionam essa validação.
        const response = await GET(criarGetRequest('?codCliente=9&page=-1'));

        expect(response.status).toBe(400);
    });

    it('retorna 400 quando limit está fora do intervalo 1-500', async () => {
        const response = await GET(criarGetRequest('?codCliente=9&limit=501'));

        expect(response.status).toBe(400);
    });

    it('retorna a listagem paginada com SLA incluído por padrão', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([chamadoRawFixture()]) // sqlChamados
            .mockResolvedValueOnce([{ TOTAL: 1 }]) // sqlCount
            .mockResolvedValueOnce(totaisFixture) // buscarTotais
            .mockResolvedValueOnce(nomeClienteFixture); // buscarNomes (cliente)

        const response = await GET(criarGetRequest('?codCliente=9'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalChamados).toBe(1);
        expect(body.cliente).toBe('Cliente Teste');
        expect(body.totalOS).toBe(1);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].COD_CHAMADO).toBe(501);
        expect(body.data[0].SLA_STATUS).toBeDefined();
        expect(body.pagination).toEqual({
            page: 1,
            limit: 50,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
        });
    });

    it('omite os campos SLA quando incluirSLA=false', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([chamadoRawFixture()])
            .mockResolvedValueOnce([{ TOTAL: 1 }])
            .mockResolvedValueOnce(totaisFixture)
            .mockResolvedValueOnce(nomeClienteFixture);

        const response = await GET(criarGetRequest('?codCliente=9&incluirSLA=false'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data[0].SLA_STATUS).toBeUndefined();
    });

    it('retorna a forma vazia quando não há chamados', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([]) // sqlChamados
            .mockResolvedValueOnce([{ TOTAL: 0 }]) // sqlCount
            .mockResolvedValueOnce([
                {
                    TOTAL_OS: 0,
                    TOTAL_HORAS: 0,
                    TOTAL_HORAS_OS_NAO_FATURADAS: 0,
                    TOTAL_HORAS_OS_FATURADAS: 0,
                },
            ])
            .mockResolvedValueOnce(nomeClienteFixture);

        const response = await GET(criarGetRequest('?codCliente=9'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalChamados).toBe(0);
        expect(body.data).toEqual([]);
        expect(body.pagination.totalPages).toBe(0);
    });

    it('reaproveita o cache de nomes e totais em requisições subsequentes com os mesmos parâmetros', async () => {
        firebirdQueryMock
            // 1ª requisição: sqlChamados, sqlCount, buscarTotais, buscarNomes
            .mockResolvedValueOnce([chamadoRawFixture()])
            .mockResolvedValueOnce([{ TOTAL: 1 }])
            .mockResolvedValueOnce(totaisFixture)
            .mockResolvedValueOnce(nomeClienteFixture)
            // 2ª requisição: só sqlChamados e sqlCount são refeitas — totais e
            // nome do cliente reaproveitam a Promise já cacheada.
            .mockResolvedValueOnce([chamadoRawFixture()])
            .mockResolvedValueOnce([{ TOTAL: 1 }]);

        const primeira = await GET(criarGetRequest('?codCliente=9'));
        expect(primeira.status).toBe(200);

        const segunda = await GET(criarGetRequest('?codCliente=9'));
        expect(segunda.status).toBe(200);

        expect(firebirdQueryMock).toHaveBeenCalledTimes(6);
    });

    it('modo TODOS retorna a listagem combinando chamados finalizados e não finalizados', async () => {
        firebirdQueryMock.mockImplementation((sql: string) => {
            if (sql.includes('POSSUI_OS')) {
                return Promise.resolve([chamadoRawFixture()]);
            }
            if (sql.includes('TOTAL_OS')) {
                return Promise.resolve(totaisFixture);
            }
            if (sql.includes('NOME_CLIENTE FROM CLIENTE')) {
                return Promise.resolve(nomeClienteFixture);
            }
            // Queries leves de IDs (finalizados e não finalizados).
            if (sql.includes('CHAMADO.DTINI_CHAMADO, CHAMADO.ASSUNTO_CHAMADO')) {
                return Promise.resolve([
                    {
                        COD_CHAMADO: 501,
                        DATA_CHAMADO: new Date(2026, 0, 6),
                        HORA_CHAMADO: '0900',
                    },
                ]);
            }
            return Promise.resolve([]);
        });

        const response = await GET(
            criarGetRequest('?codCliente=9&statusFilter=TODOS&mes=1&ano=2026')
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toHaveLength(1);
        expect(body.data[0].COD_CHAMADO).toBe(501);
        expect(body.totalChamados).toBe(1);
    });

    it('retorna 500 quando a consulta principal falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));
        firebirdQueryMock.mockResolvedValue([]);

        const response = await GET(criarGetRequest('?codCliente=9'));

        expect(response.status).toBe(500);
    });
});
