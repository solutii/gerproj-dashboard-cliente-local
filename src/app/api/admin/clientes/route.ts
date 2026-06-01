import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface Cliente {
    cod: string;
    nome: string;
}

export async function GET() {
    try {
        const sql = `
            SELECT DISTINCT
                CLIENTE.COD_CLIENTE,
                CLIENTE.NOME_CLIENTE
            FROM CHAMADO
            INNER JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
            WHERE CLIENTE.NOME_CLIENTE IS NOT NULL
                AND TRIM(CLIENTE.NOME_CLIENTE) <> ''
            ORDER BY CLIENTE.NOME_CLIENTE
        `;

        const resultados = await firebirdQuery(sql, []);

        const clientes: Cliente[] = resultados
            .map((item: any) => ({
                cod: String(item.COD_CLIENTE),
                nome: item.NOME_CLIENTE.trim(),
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
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}
