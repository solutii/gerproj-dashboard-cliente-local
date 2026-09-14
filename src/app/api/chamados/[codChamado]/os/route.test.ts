import { NextRequest } from 'next/server';
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
    return new NextRequest(`http://localhost/api/chamados/55/os${query}`);
}

describe('GET /api/chamados/[codChamado]/os', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codChamado não é um número válido', async () => {
        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: 'abc' },
        });

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest(''), { params: { codChamado: '55' } });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Parâmetro 'codCliente' é obrigatório");
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando mes está fora do intervalo 1-12', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=13&ano=2026'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Parâmetro 'mes' deve ser um número entre 1 e 12");
    });

    it('retorna 400 quando ano é inválido', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=5&ano=1500'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Parâmetro 'ano' deve ser um número válido");
    });

    it('retorna 403 quando o codCliente não é o dono do chamado', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([{ DATA_CHAMADO: '2026-01-06', COD_CLIENTE: 999 }])
            .mockResolvedValueOnce([]);

        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
    });

    it('retorna 403 quando o chamado não existe (dono não confere com nenhum registro)', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
    });

    it('calcula as horas e os totais das OS do chamado', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        firebirdQueryMock
            .mockResolvedValueOnce([{ DATA_CHAMADO: '2026-01-06', COD_CLIENTE: 9 }])
            .mockResolvedValueOnce([
                {
                    COD_OS: 1,
                    CODTRF_OS: 10,
                    // 2026-01-06 é uma terça-feira, dentro do horário comercial.
                    DTINI_OS: '2026-01-06',
                    HRINI_OS: '0800',
                    HRFIM_OS: '1000',
                    OBS: 'Atendimento',
                    NUM_OS: '000123',
                    VALCLI_OS: 'SIM',
                    OBSCLI_OS: null,
                    NOME_RECURSO: 'Consultor Teste',
                    NOME_TAREFA: 'Suporte',
                    NOME_CLIENTE: 'Cliente Teste',
                },
            ]);

        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.dataChamado).toBe('2026-01-06');
        expect(body.totais.quantidade_OS).toBe(1);
        expect(body.totais.total_horas_chamado).toBe(2);
        expect(body.totais.horas_adicional.horasAdicionalGerado).toBe(0);
        expect(body.data[0].TOTAL_HORAS_OS).toBe(2);
        expect(body.data[0].NOME_RECURSO).toBe('Consultor Teste');
    });

    it('retorna 500 quando a consulta das OS falha', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([{ DATA_CHAMADO: '2026-01-06', COD_CLIENTE: 9 }])
            .mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(500);
    });
});
