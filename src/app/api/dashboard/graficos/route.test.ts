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

    it('monta totalizadores e gráficos a partir das OS do mês', async () => {
        // Primeira chamada = dados do mês selecionado; as 12 chamadas seguintes
        // (uma por mês, para o gráfico anual) caem no default [] abaixo.
        firebirdQueryMock.mockResolvedValueOnce([
            {
                DTINI_OS: new Date(2026, 0, 5),
                HRINI_OS: '0800',
                HRFIM_OS: '1000',
                CHAMADO_OS: 'A1',
                CODTRF_OS: 10,
                COD_RECURSO: 1,
                NOME_RECURSO: 'Consultor X',
                COD_CLIENTE: 9,
                NOME_CLIENTE: 'Cliente Teste',
                STATUS_CHAMADO: 'FINALIZADO',
            },
            {
                DTINI_OS: new Date(2026, 0, 5),
                HRINI_OS: '1300',
                HRFIM_OS: '1500',
                CHAMADO_OS: 'A1',
                CODTRF_OS: 10,
                COD_RECURSO: 1,
                NOME_RECURSO: 'Consultor X',
                COD_CLIENTE: 9,
                NOME_CLIENTE: 'Cliente Teste',
                STATUS_CHAMADO: 'FINALIZADO',
            },
        ]);
        firebirdQueryMock.mockResolvedValue([]);

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
            { chamado: 'A1', horas: 4, cliente: 'Cliente Teste', status: 'FINALIZADO' },
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

        // Gráfico anual: 12 meses, todos zerados (cada mês é uma query separada
        // do dadosMes principal, e caem no default mockResolvedValue([])).
        expect(body.graficos.horasPorMes).toHaveLength(12);
        expect(body.graficos.horasPorMes.every((m: any) => m.horas === 0)).toBe(true);
        expect(body.graficos.horasPorMes[0]).toEqual({ mes: 'Jan', mesNum: 1, horas: 0 });
    });

    it('retorna 500 quando a consulta principal falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));
        firebirdQueryMock.mockResolvedValue([]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
