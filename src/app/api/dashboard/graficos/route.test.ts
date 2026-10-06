import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new Request(`http://localhost/api/dashboard/graficos${query}`);
}

describe('GET /api/dashboard/graficos', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando mes é inválido', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=0&ano=2026'));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest('?mes=1&ano=2026'));

        expect(response.status).toBe(400);
    });

    // As OS vêm numa consulta (sem juntar CHAMADO) e o status dos chamados em outra, pelos códigos.
    const osDe = (hrIni: string, hrFim: string, dia: number, chamado = '501', mes = 0) => ({
        DTINI_OS: new Date(2026, mes, dia),
        HRINI_OS: hrIni,
        HRFIM_OS: hrFim,
        CHAMADO_OS: chamado,
        CODTRF_OS: 10,
        COD_RECURSO: 1,
        NOME_RECURSO: 'Consultor X',
        COD_CLIENTE: 9,
        NOME_CLIENTE: 'Cliente Teste',
    });

    function mockarBanco(
        oss: unknown[],
        statusDosChamados: { COD_CHAMADO: number; STATUS_CHAMADO: string | null }[]
    ) {
        firebirdQueryMock.mockImplementation((sql: string, params: unknown[]) => {
            if (sql.includes('FROM OS')) {
                // consulta do mês (até o dia 1 do mês seguinte) ou do ano todo (até 01.01 do ano seguinte)
                const doMes = params[1] === '01.02.2026';
                return Promise.resolve(
                    doMes ? (oss as any[]).filter((o) => o.DTINI_OS.getMonth() === 0) : oss
                );
            }
            if (sql.includes('FROM CHAMADO')) return Promise.resolve(statusDosChamados);

            return Promise.resolve([]);
        });
    }

    it('monta totalizadores e gráficos a partir das OS do mês', async () => {
        mockarBanco(
            [osDe('0800', '1000', 5), osDe('1300', '1500', 5)],
            [{ COD_CHAMADO: 501, STATUS_CHAMADO: 'FINALIZADO' }]
        );

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.totalizadores).toEqual({
            TOTAL_OS: 2,
            TOTAL_CHAMADOS: 1,
            TOTAL_RECURSOS: 1,
            TOTAL_HRS: 4,
        });

        // Janeiro tem 31 dias; só o dia 5 deve ter horas lançadas.
        expect(body.graficos.horasPorDia).toHaveLength(31);
        expect(body.graficos.horasPorDia.find((d: any) => d.dia === 5)?.horas).toBe(4);
        expect(body.graficos.horasPorDia.find((d: any) => d.dia === 1)?.horas).toBe(0);

        expect(body.graficos.topChamados).toEqual([
            { chamado: '501', horas: 4, cliente: 'Cliente Teste', status: 'FINALIZADO' },
        ]);

        expect(body.graficos.horasPorStatus).toEqual([
            { status: 'FINALIZADO', horas: 4, percentual: 100 },
        ]);

        expect(body.graficos.horasPorRecurso).toEqual([
            {
                recurso: 'Consultor X',
                codRecurso: 1,
                horas: 4,
                quantidadeOS: 2,
                mediaHorasPorOS: 2,
            },
        ]);

        // Gráfico anual: 12 meses; só janeiro tem horas (as mesmas 4 h)
        expect(body.graficos.horasPorMes).toHaveLength(12);
        expect(body.graficos.horasPorMes[0]).toEqual({ mes: 'Jan', mesNum: 1, horas: 4 });
        expect(body.graficos.horasPorMes.slice(1).every((m: any) => m.horas === 0)).toBe(true);
    });

    it('o gráfico anual usa UMA consulta de OS para o ano todo (e não uma por mês), sem juntar CHAMADO por CAST', async () => {
        mockarBanco(
            [
                osDe('0800', '1000', 5, '501', 0),
                osDe('0800', '0900', 3, '501', 2),
                osDe('0900', '1100', 7, '501', 11),
            ],
            [{ COD_CHAMADO: 501, STATUS_CHAMADO: 'FINALIZADO' }]
        );

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));
        const body = await response.json();

        expect(body.graficos.horasPorMes.map((m: any) => m.horas)).toEqual([
            2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2,
        ]);
        const consultasDeOs = firebirdQueryMock.mock.calls.filter(([sql]) =>
            String(sql).includes('FROM OS')
        );
        expect(consultasDeOs).toHaveLength(2); // o mês e o ano
        for (const [sql] of consultasDeOs) expect(String(sql)).not.toContain('CAST');
        // o status vem pelos códigos (números), em consulta simples
        const consultaChamados = firebirdQueryMock.mock.calls.find(([sql]) =>
            String(sql).includes('FROM CHAMADO')
        )!;
        expect(consultaChamados[1]).toEqual([501]);
    });

    it('OS cujo chamado não existe (ou cujo código não é um número) fica de fora, como no antigo INNER JOIN', async () => {
        mockarBanco(
            [
                osDe('0800', '1000', 5, '501'),
                osDe('0800', '1000', 6, '999'),
                osDe('0800', '1000', 7, 'A1'),
                osDe('0800', '1000', 8, '0501'),
            ],
            [{ COD_CHAMADO: 501, STATUS_CHAMADO: 'ATRIBUIDO' }]
        );

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));
        const body = await response.json();

        expect(body.totalizadores.TOTAL_OS).toBe(1); // só a do chamado 501 (999 não existe; "A1" e "0501" não casam)
        expect(body.graficos.horasPorStatus).toEqual([
            { status: 'ATRIBUIDO', horas: 2, percentual: 100 },
        ]);
    });

    it('com filtro de status continua usando a consulta antiga (LIKE do banco, com o CHAMADO juntado)', async () => {
        firebirdQueryMock.mockResolvedValue([]);

        await GET(criarRequest('?codCliente=9&mes=1&ano=2026&status=FINALIZADO'));

        const sqls = firebirdQueryMock.mock.calls.map(([sql]) => String(sql));
        expect(
            sqls.some((s) => s.includes('INNER JOIN CHAMADO') && s.includes('LIKE UPPER(?)'))
        ).toBe(true);
        expect(sqls.length).toBe(13); // o mês e os 12 meses, como antes
    });

    it('um erro no gráfico anual não derruba a resposta: os meses ficam com 0 hora', async () => {
        firebirdQueryMock.mockImplementation((sql: string, params: unknown[]) => {
            if (sql.includes('FROM OS') && params[1] !== '01.02.2026')
                return Promise.reject(new Error('timeout'));
            if (sql.includes('FROM OS')) return Promise.resolve([osDe('0800', '1000', 5)]);

            return Promise.resolve([{ COD_CHAMADO: 501, STATUS_CHAMADO: 'FINALIZADO' }]);
        });

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.totalizadores.TOTAL_OS).toBe(1);
        expect(body.graficos.horasPorMes.every((m: any) => m.horas === 0)).toBe(true);
    });

    it('retorna 500 quando a consulta principal falha', async () => {
        firebirdQueryMock.mockRejectedValue(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
