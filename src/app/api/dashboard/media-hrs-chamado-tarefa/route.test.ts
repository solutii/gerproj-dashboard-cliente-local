import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new Request(`http://localhost/api/dashboard/media-hrs-chamado-tarefa${query}`);
}

describe('GET /api/dashboard/media-hrs-chamado-tarefa', () => {
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

    it('calcula a média de horas por chamado e por tarefa', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            // Chamado 100 / Tarefa 1: 0800-1000 = 2h
            { CHAMADO_OS: '100', CODTRF_OS: 1, HRINI_OS: '0800', HRFIM_OS: '1000' },
            // Chamado 100 / Tarefa 1: mais 1h no mesmo chamado/tarefa
            { CHAMADO_OS: '100', CODTRF_OS: 1, HRINI_OS: '1000', HRFIM_OS: '1100' },
            // Chamado 200 / Tarefa 2: 4h
            { CHAMADO_OS: '200', CODTRF_OS: 2, HRINI_OS: '0800', HRFIM_OS: '1200' },
        ]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.TOTAL_CHAMADOS_COM_HORAS).toBe(2);
        expect(body.TOTAL_TAREFAS_COM_HORAS).toBe(2);
        // Chamado 100 = 3h, Chamado 200 = 4h -> média (3+4)/2 = 3.5
        expect(body.MEDIA_HRS_POR_CHAMADO).toBe(3.5);
        // Tarefa 1 = 3h, Tarefa 2 = 4h -> média (3+4)/2 = 3.5
        expect(body.MEDIA_HRS_POR_TAREFA).toBe(3.5);
    });

    it('retorna médias zeradas quando não há OS no período', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
            MEDIA_HRS_POR_CHAMADO: 0,
            MEDIA_HRS_POR_TAREFA: 0,
            TOTAL_CHAMADOS_COM_HORAS: 0,
            TOTAL_TAREFAS_COM_HORAS: 0,
        });
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
