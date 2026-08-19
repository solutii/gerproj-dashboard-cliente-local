// src/app/api/clientes-ativos/route.ts
// Lista de clientes ativos — usado pelo ADM para abrir chamado em nome de outro cliente.
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const rows = await firebirdQuery(
            `SELECT COD_CLIENTE, NOME_CLIENTE
             FROM CLIENTE
             WHERE ATIVO_CLIENTE = 1
             ORDER BY NOME_CLIENTE ASC`,
            []
        );

        const clientes = (rows as Record<string, unknown>[])
            .map((row) => ({
                cod: Number(row.COD_CLIENTE),
                nome: String(row.NOME_CLIENTE ?? '').trim(),
            }))
            .filter((c) => c.nome !== '');

        return NextResponse.json(clientes);
    } catch (error) {
        console.error('[clientes-ativos] Erro ao buscar clientes ativos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
