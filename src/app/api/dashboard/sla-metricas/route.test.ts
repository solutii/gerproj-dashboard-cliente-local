import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock, buscarFeriadosMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    buscarFeriadosMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('@/lib/os/feriados-service', () => ({
    buscarFeriados: buscarFeriadosMock,
}));

function criarRequest(query: string) {
    return new Request(`http://localhost/api/dashboard/sla-metricas${query}`);
}

describe('GET /api/dashboard/sla-metricas', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest('?mes=1&ano=2026'));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando mes é inválido', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=0&ano=2026'));

        expect(response.status).toBe(400);
    });

    it('calcula dentroSLA/foraSLA usando chamados já concluídos (datas fixas, sem depender do relógio)', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_CHAMADO: 1,
                // Terça-feira, dia útil.
                DATA_CHAMADO: new Date(2026, 0, 6),
                HORA_CHAMADO: '0900',
                PRIOR_CHAMADO: 100,
                STATUS_CHAMADO: 'FINALIZADO',
                // Resolvido 2h depois, no mesmo dia — bem dentro do SLA de 8h.
                CONCLUSAO_CHAMADO: new Date(2026, 0, 6, 11, 0, 0),
            },
            {
                COD_CHAMADO: 2,
                DATA_CHAMADO: new Date(2026, 0, 6),
                HORA_CHAMADO: '0900',
                PRIOR_CHAMADO: 100,
                STATUS_CHAMADO: 'FINALIZADO',
                // Resolvido uma semana depois — muito além do SLA de 8h úteis.
                CONCLUSAO_CHAMADO: new Date(2026, 0, 13, 9, 0, 0),
            },
        ]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalChamados).toBe(2);
        expect(body.dentroSLA).toBe(1);
        expect(body.foraSLA).toBe(1);
        expect(body.percentualCumprimento).toBe(50);

        expect(buscarFeriadosMock).toHaveBeenCalledWith({ year: 2026 });
    });

    it('aplica os filtros opcionais de recurso e cliente na consulta', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        firebirdQueryMock.mockResolvedValueOnce([]);

        await GET(
            criarRequest('?codCliente=9&mes=1&ano=2026&codClienteFilter=12&codRecursoFilter=5')
        );

        const [sql, params] = firebirdQueryMock.mock.calls[0];
        expect(sql).toContain('CHAMADO.COD_RECURSO = ?');
        expect(params).toEqual(['01.01.2026', '01.02.2026', 9, 12, 5]);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
