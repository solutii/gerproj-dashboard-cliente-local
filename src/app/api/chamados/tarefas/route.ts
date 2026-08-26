// src/app/api/chamados/tarefas/route.ts
// Tarefas disponíveis para um cliente, usado pelo ADM na abertura de chamado.
// COD_CLIENTE -> PROJETO (CODCLI_PROJETO, STATUS_PROJETO = 'ATI') -> COD_PROJETO
// COD_PROJETO -> TAREFA (CODPRO_TAREFA) -> COD_TAREFA + NOME_TAREFA
import { resolveCodClienteSeguro } from '@/lib/auth/cliente-token';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const codCliente = resolveCodClienteSeguro(request, searchParams.get('codCliente'))?.trim();

        if (!codCliente) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' é obrigatório" },
                { status: 400 }
            );
        }

        const codClienteNum = Number(codCliente);
        if (!codClienteNum || isNaN(codClienteNum)) {
            return NextResponse.json({ error: "Parâmetro 'codCliente' inválido" }, { status: 400 });
        }

        const sql = `
            SELECT TAREFA.COD_TAREFA, TAREFA.NOME_TAREFA
            FROM TAREFA
            INNER JOIN PROJETO ON PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA
            WHERE PROJETO.CODCLI_PROJETO = ?
              AND PROJETO.STATUS_PROJETO = 'ATI'
              AND TAREFA.NOME_TAREFA IS NOT NULL
              AND TRIM(TAREFA.NOME_TAREFA) <> ''
            ORDER BY TAREFA.NOME_TAREFA ASC
        `;

        const rows = await firebirdQuery(sql, [codClienteNum]);

        const tarefas = (rows as Record<string, unknown>[])
            .map((row) => {
                const cod = Number(row.COD_TAREFA);
                const nomeTarefa = String(row.NOME_TAREFA ?? '').trim();
                return { cod, nome: `${cod} - ${nomeTarefa}` };
            })
            .filter((t) => t.nome !== '');

        return NextResponse.json(tarefas);
    } catch (error) {
        console.error('[chamados/tarefas] Erro ao buscar tarefas do cliente:', error);
        return NextResponse.json({ error: 'Erro ao buscar tarefas do cliente.' }, { status: 500 });
    }
}
