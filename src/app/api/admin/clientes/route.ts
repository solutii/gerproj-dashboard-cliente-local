import { safeErrorMessage } from '@/lib/api-error';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface Cliente {
    cod: string;
    nome: string;
}

interface ClienteRaw {
    COD_CLIENTE: number;
    NOME_CLIENTE: string | null;
}

export async function GET() {
    try {
        // Sem JOIN com CHAMADO — um cliente novo (ainda sem nenhum chamado
        // aberto) também precisa aparecer aqui, já que essa lista alimenta o
        // fluxo de ADM abrindo o primeiro chamado em nome do cliente.
        const sql = `
            SELECT
                CLIENTE.COD_CLIENTE,
                CLIENTE.NOME_CLIENTE
            FROM CLIENTE
            WHERE CLIENTE.NOME_CLIENTE IS NOT NULL
                AND TRIM(CLIENTE.NOME_CLIENTE) <> ''
                AND CLIENTE.ATIVO_CLIENTE = 1
            ORDER BY CLIENTE.NOME_CLIENTE
        `;

        const resultados = await firebirdQuery<ClienteRaw>(sql, []);

        const clientes: Cliente[] = resultados
            .map((item) => ({
                cod: String(item.COD_CLIENTE),
                nome: (item.NOME_CLIENTE ?? '').trim(),
            }))
            .filter((c: Cliente) => c.nome !== '')
            .sort((a: Cliente, b: Cliente) =>
                a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
            );

        return NextResponse.json(clientes);
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Erro ao buscar clientes',
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
