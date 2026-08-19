// src/app/api/recursos-ativos/route.ts
// Lista de recursos ativos — usado pelo ADM para atribuir o chamado na abertura.
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const rows = await firebirdQuery(
            `SELECT COD_RECURSO, NOME_RECURSO
             FROM RECURSO
             WHERE ATIVO_RECURSO = 1
             ORDER BY NOME_RECURSO ASC`,
            []
        );

        const recursos = (rows as Record<string, unknown>[])
            .map((row) => ({
                cod: Number(row.COD_RECURSO),
                nome: String(row.NOME_RECURSO ?? '').trim(),
            }))
            .filter((r) => r.nome !== '');

        return NextResponse.json(recursos);
    } catch (error) {
        console.error('[recursos-ativos] Erro ao buscar recursos ativos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
