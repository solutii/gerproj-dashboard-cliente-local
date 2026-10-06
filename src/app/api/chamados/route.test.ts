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

// A listagem (modo normal) faz: 1) IDs da página e contagem; 2) detalhes só desses IDs (chamado, histórico e OS);
// mais os totais e os nomes. Cada consulta é reconhecida pelo texto do SQL.
function mockarBanco(
    opcoes: {
        ids?: number[];
        total?: number;
        detalhes?: unknown[];
        totais?: unknown[];
        historico?: unknown[];
        os?: unknown[];
    } = {}
) {
    const ids = opcoes.ids ?? [501];
    const detalhes = opcoes.detalhes ?? [chamadoRawFixture()];

    firebirdQueryMock.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT CHAMADO.COD_CHAMADO)')) {
            return Promise.resolve([{ TOTAL: opcoes.total ?? ids.length }]);
        }
        if (sql.includes('SELECT DISTINCT CHAMADO.COD_CHAMADO')) {
            return Promise.resolve(ids.map((COD_CHAMADO) => ({ COD_CHAMADO })));
        }
        // modo TODOS: as consultas leves de IDs trazem também os campos de ordenação
        if (sql.includes('CHAMADO.DTINI_CHAMADO, CHAMADO.ASSUNTO_CHAMADO')) {
            return Promise.resolve(
                ids.map((COD_CHAMADO) => ({
                    COD_CHAMADO,
                    DATA_CHAMADO: new Date(2026, 8, 6),
                    HORA_CHAMADO: '0900',
                }))
            );
        }
        if (sql.includes('TOTAL_OS')) return Promise.resolve(opcoes.totais ?? totaisFixture);
        if (sql.includes('NOME_CLIENTE FROM CLIENTE')) return Promise.resolve(nomeClienteFixture);
        if (sql.includes('WHERE CHAMADO.COD_CHAMADO IN')) return Promise.resolve(detalhes);
        if (sql.includes('FROM HISTCHAMADO')) return Promise.resolve(opcoes.historico ?? []);
        if (sql.includes('FROM OS')) return Promise.resolve(opcoes.os ?? []);

        return Promise.resolve([]);
    });
}

const chamadasComSql = (trecho: string) =>
    firebirdQueryMock.mock.calls.filter(([sql]) => String(sql).includes(trecho)).length;

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
        mockarBanco();

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
        mockarBanco();

        const response = await GET(criarGetRequest('?codCliente=9&incluirSLA=false'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data[0].SLA_STATUS).toBeUndefined();
    });

    it('retorna a forma vazia quando não há chamados', async () => {
        mockarBanco({
            ids: [],
            total: 0,
            totais: [
                {
                    TOTAL_OS: 0,
                    TOTAL_HORAS: 0,
                    TOTAL_HORAS_OS_NAO_FATURADAS: 0,
                    TOTAL_HORAS_OS_FATURADAS: 0,
                },
            ],
        });

        const response = await GET(criarGetRequest('?codCliente=9'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalChamados).toBe(0);
        expect(body.data).toEqual([]);
        expect(body.pagination.totalPages).toBe(0);
    });

    it('reaproveita o cache de nomes e totais em requisições subsequentes com os mesmos parâmetros', async () => {
        mockarBanco();

        const primeira = await GET(criarGetRequest('?codCliente=9'));
        expect(primeira.status).toBe(200);

        const segunda = await GET(criarGetRequest('?codCliente=9'));
        expect(segunda.status).toBe(200);

        // a lista e a contagem são refeitas a cada requisição; totais e nome do cliente reaproveitam o cache
        expect(chamadasComSql('SELECT DISTINCT CHAMADO.COD_CHAMADO')).toBe(2);
        expect(chamadasComSql('COUNT(DISTINCT CHAMADO.COD_CHAMADO)')).toBe(2);
        expect(chamadasComSql('TOTAL_OS')).toBe(1);
        expect(chamadasComSql('NOME_CLIENTE FROM CLIENTE')).toBe(1);
    });

    it('sem mês filtrado, a lista e a contagem NÃO juntam OS nem histórico (era o que travava por mais de 20 s)', async () => {
        mockarBanco();

        await GET(criarGetRequest('?codCliente=9'));

        const sqls = firebirdQueryMock.mock.calls.map(([sql]) => String(sql));
        const ids = sqls.find((s) => s.includes('SELECT DISTINCT CHAMADO.COD_CHAMADO'))!;
        const contagem = sqls.find((s) => s.includes('COUNT(DISTINCT CHAMADO.COD_CHAMADO)'))!;
        for (const sql of [ids, contagem]) {
            expect(sql).not.toContain('JOIN OS');
            expect(sql).not.toContain('HISTCHAMADO');
        }
        // os detalhes só são pedidos para os IDs da página, em consultas simples (sem GROUP BY nem junção OS x histórico)
        const detalhe = sqls.find((s) => s.includes('WHERE CHAMADO.COD_CHAMADO IN'))!;
        expect(detalhe).not.toContain('GROUP BY');
        expect(detalhe).not.toContain('JOIN OS');
    });

    it('com mês filtrado, a lista exige OS do mês (com tarefa visível) e as horas somam só as OS do mês', async () => {
        mockarBanco({
            os: [
                // dentro de setembro/2026: 08:00-10:00 (2 h, faturada) e 10:00-10:30 (0,5 h, não faturada)
                {
                    CHAMADO_OS: '501',
                    FATURADO_OS: 'SIM',
                    HRINI_OS: '0800',
                    HRFIM_OS: '1000',
                    DTINI_OS: new Date(2026, 8, 10),
                },
                {
                    CHAMADO_OS: '501',
                    FATURADO_OS: 'NAO',
                    HRINI_OS: '1000',
                    HRFIM_OS: '1030',
                    DTINI_OS: new Date(2026, 8, 11),
                },
            ],
        });

        const response = await GET(criarGetRequest('?codCliente=9&mes=9&ano=2026'));
        const body = await response.json();

        const ids = firebirdQueryMock.mock.calls
            .map(([sql]) => String(sql))
            .find((s) => s.includes('SELECT DISTINCT CHAMADO.COD_CHAMADO'))!;
        expect(ids).toContain('INNER JOIN OS');
        expect(ids).toContain('INNER JOIN TAREFA');
        expect(ids).toContain('OS.DTINI_OS >= ?');
        expect(body.data[0].TOTAL_HORAS_OS).toBe(2);
        expect(body.data[0].TOTAL_HORAS_OS_FATURADAS).toBe(2);
        expect(body.data[0].TOTAL_HORAS_OS_NAO_FATURADAS).toBe(0.5);
        // a consulta de OS dos detalhes usa o código como TEXTO (OS.CHAMADO_OS) e a regra da tarefa visível
        const consultaOs = firebirdQueryMock.mock.calls.find(([sql]) =>
            String(sql).includes('OS.CHAMADO_OS IN')
        )!;
        expect(String(consultaOs[0])).toContain('EXIBECHAM_TAREFA = 1');
        expect(consultaOs[1]).toEqual(['501']);
    });

    it('as horas das OS fora do mês filtrado não entram na soma', async () => {
        mockarBanco({
            os: [
                {
                    CHAMADO_OS: '501',
                    FATURADO_OS: 'SIM',
                    HRINI_OS: '0800',
                    HRFIM_OS: '1000',
                    DTINI_OS: new Date(2026, 8, 10),
                },
                {
                    CHAMADO_OS: '501',
                    FATURADO_OS: 'SIM',
                    HRINI_OS: '0800',
                    HRFIM_OS: '1000',
                    DTINI_OS: new Date(2026, 9, 2),
                }, // outubro
            ],
        });

        const response = await GET(
            criarGetRequest('?codCliente=9&statusFilter=TODOS&mes=9&ano=2026')
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data[0].TOTAL_HORAS_OS).toBe(2); // só a de setembro
        expect(body.data[0].TEM_OS).toBe(true); // mas o chamado possui OS (qualquer mês)
    });

    it('modo TODOS retorna a listagem combinando chamados finalizados e não finalizados', async () => {
        firebirdQueryMock.mockImplementation((sql: string) => {
            if (sql.includes('WHERE CHAMADO.COD_CHAMADO IN')) {
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

    describe('filtros de coluna (texto do usuário nunca pode derrubar a consulta)', () => {
        const sqlDaLista = () =>
            firebirdQueryMock.mock.calls
                .map(([sql]) => String(sql))
                .find((s) => s.includes('SELECT DISTINCT CHAMADO.COD_CHAMADO'))!;
        const paramsDaLista = () =>
            firebirdQueryMock.mock.calls.find(([sql]) =>
                String(sql).includes('SELECT DISTINCT CHAMADO.COD_CHAMADO')
            )![1] as unknown[];
        const consultar = (query: string) => GET(criarGetRequest(`?codCliente=9&${query}`));
        const recomecar = () => {
            firebirdQueryMock.mockClear();
            limparCacheChamados();
        };
        const barra = String.fromCharCode(92);

        it('assunto em texto: só compara com o assunto (sem o CAST de 20 caracteres, que estourava com texto longo)', async () => {
            mockarBanco();
            const longo = 'ajuste no calculo de faltas e dsr folha de pagamento';

            const response = await consultar(`filter_ASSUNTO_CHAMADO=${encodeURIComponent(longo)}`);

            expect(response.status).toBe(200);
            expect(sqlDaLista()).toContain(
                `UPPER(CHAMADO.ASSUNTO_CHAMADO) LIKE UPPER(?) ESCAPE '${barra}'`
            );
            expect(sqlDaLista()).not.toContain('CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE');
            expect(paramsDaLista()).toContain(`%${longo}%`);
        });

        it('assunto que é um número curto: também acha pelo número do chamado', async () => {
            mockarBanco();

            await consultar('filter_ASSUNTO_CHAMADO=15191');

            expect(sqlDaLista()).toContain('CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE ?');
            expect(paramsDaLista()).toEqual(expect.arrayContaining(['%15191%']));
        });

        it('número com mais de 18 dígitos não é comparado com o CAST de 20 caracteres', async () => {
            mockarBanco();

            await consultar(`filter_ASSUNTO_CHAMADO=${'1'.repeat(25)}`);

            expect(sqlDaLista()).not.toContain('CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE');
        });

        it('o texto da busca é cortado em 100 caracteres', async () => {
            mockarBanco();

            await consultar(`filter_ASSUNTO_CHAMADO=${'a'.repeat(300)}`);

            const parametro = paramsDaLista().find(
                (p) => typeof p === 'string' && p.includes('aaa')
            );
            expect(parametro).toBe(`%${'a'.repeat(100)}%`);
        });

        it('porcentagem, sublinhado e barra invertida digitados valem como texto comum (são escapados)', async () => {
            mockarBanco();

            await consultar(`filter_ASSUNTO_CHAMADO=${encodeURIComponent(`50%_a${barra}b`)}`);

            expect(paramsDaLista()).toContain(`%50${barra}%${barra}_a${barra}${barra}b%`);
        });

        it('filtro de e-mail: limitado e escapado', async () => {
            mockarBanco();

            await consultar(`filter_EMAIL_CHAMADO=${encodeURIComponent('a_b')}`);

            expect(sqlDaLista()).toContain(
                `UPPER(CHAMADO.EMAIL_CHAMADO) LIKE UPPER(?) ESCAPE '${barra}'`
            );
            expect(paramsDaLista()).toContain(`%a${barra}_b%`);
        });

        it('parte do número do chamado: com dígitos demais nada casa (em vez de estourar o campo)', async () => {
            mockarBanco();

            const ok = await consultar('filter_COD_CHAMADO=151');
            expect(ok.status).toBe(200);
            expect(sqlDaLista()).toContain('CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE ?');

            recomecar();
            const demais = await consultar(`filter_COD_CHAMADO=${'1'.repeat(30)}`);
            expect(demais.status).toBe(200);
            expect(sqlDaLista()).toContain('1=0');
        });

        it('código exato com mais de 9 dígitos não vira um número gigante para o banco (nada casa)', async () => {
            mockarBanco();

            const response = await consultar(`codChamado=${'9'.repeat(15)}`);

            expect(response.status).toBe(200);
            expect(sqlDaLista()).toContain('1=0');
            expect(paramsDaLista()).not.toContain(999999999999999);
        });

        it('conclusão: dia, mês ou ano viram um intervalo de datas; outro formato não filtra', async () => {
            mockarBanco();

            await consultar(`filter_CONCLUSAO_CHAMADO=${encodeURIComponent('10/01/2026')}`);
            expect(sqlDaLista()).toContain(
                'CHAMADO.CONCLUSAO_CHAMADO >= ? AND CHAMADO.CONCLUSAO_CHAMADO < ?'
            );
            expect(paramsDaLista()).toEqual(expect.arrayContaining(['10.01.2026', '11.01.2026']));

            recomecar();
            await consultar(`filter_CONCLUSAO_CHAMADO=${encodeURIComponent('12/2026')}`);
            expect(paramsDaLista()).toEqual(expect.arrayContaining(['01.12.2026', '01.01.2027']));

            recomecar();
            await consultar('filter_CONCLUSAO_CHAMADO=2026');
            expect(paramsDaLista()).toEqual(expect.arrayContaining(['01.01.2026', '01.01.2027']));

            recomecar();
            await consultar('filter_CONCLUSAO_CHAMADO=abc');
            expect(sqlDaLista()).not.toContain('CONCLUSAO_CHAMADO >=');
            expect(sqlDaLista()).not.toContain('EXTRACT');
        });

        it('modo TODOS: mesmo cuidado com o texto da busca de assunto', async () => {
            mockarBanco({ ids: [501] });

            const response = await consultar(
                `statusFilter=TODOS&mes=1&ano=2026&filter_ASSUNTO_CHAMADO=${'b'.repeat(40)}`
            );

            expect(response.status).toBe(200);
            const sqls = firebirdQueryMock.mock.calls.map(([sql]) => String(sql));
            const idsTodos = sqls.filter((s) =>
                s.includes('CHAMADO.DTINI_CHAMADO, CHAMADO.ASSUNTO_CHAMADO')
            );
            expect(idsTodos.length).toBeGreaterThan(0);
            for (const sql of idsTodos)
                expect(sql).not.toContain('CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE');
        });

        it('modo TODOS: chamados com a mesma data e hora ficam em ordem estável (o de maior código primeiro)', async () => {
            firebirdQueryMock.mockImplementation((sql: string) => {
                if (sql.includes('CHAMADO.DTINI_CHAMADO, CHAMADO.ASSUNTO_CHAMADO')) {
                    return Promise.resolve(
                        [101, 103, 102].map((COD_CHAMADO) => ({
                            COD_CHAMADO,
                            DATA_CHAMADO: new Date(2026, 0, 6),
                            HORA_CHAMADO: '0900',
                        }))
                    );
                }
                if (sql.includes('WHERE CHAMADO.COD_CHAMADO IN')) {
                    return Promise.resolve(
                        [101, 102, 103].map((COD_CHAMADO) => chamadoRawFixture({ COD_CHAMADO }))
                    );
                }
                if (sql.includes('TOTAL_OS')) return Promise.resolve(totaisFixture);
                if (sql.includes('NOME_CLIENTE FROM CLIENTE'))
                    return Promise.resolve(nomeClienteFixture);

                return Promise.resolve([]);
            });

            const response = await consultar('statusFilter=TODOS&mes=1&ano=2026');
            const body = await response.json();

            expect(body.data.map((c: { COD_CHAMADO: number }) => c.COD_CHAMADO)).toEqual([
                103, 102, 101,
            ]);
        });
    });

    it('retorna 500 quando a consulta principal falha', async () => {
        firebirdQueryMock.mockRejectedValue(new Error('timeout'));

        const response = await GET(criarGetRequest('?codCliente=9'));

        expect(response.status).toBe(500);
    });
});
