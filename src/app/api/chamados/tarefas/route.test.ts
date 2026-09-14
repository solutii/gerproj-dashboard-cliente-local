import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new NextRequest(`http://localhost/api/chamados/tarefas${query}`);
}

describe('GET /api/chamados/tarefas', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest(''));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando codCliente não é um número válido', async () => {
        const response = await GET(criarRequest('?codCliente=abc'));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Parâmetro 'codCliente' inválido");
    });

    it('retorna as tarefas do cliente formatadas como "cod - nome"', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { COD_TAREFA: 12, NOME_TAREFA: 'Suporte Protheus' },
            { COD_TAREFA: 7, NOME_TAREFA: 'Customização Fiscal' },
        ]);

        const response = await GET(criarRequest('?codCliente=10'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual([
            { cod: 12, nome: '12 - Suporte Protheus' },
            { cod: 7, nome: '7 - Customização Fiscal' },
        ]);

        const [sql, params] = firebirdQueryMock.mock.calls[0];
        expect(sql).toContain("STATUS_PROJETO = 'ATI'");
        expect(params).toEqual([10]);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=10'));

        expect(response.status).toBe(500);
    });
});
