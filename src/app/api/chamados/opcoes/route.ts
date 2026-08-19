// src/app/api/chamados/opcoes/route.ts
// Opções dos dropdowns do formulário de abertura de chamado (Departamento, Módulo, Tipo de solicitação).
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface Opcao {
    cod: number;
    nome: string;
}

function processar(rows: Record<string, unknown>[], codField: string, nomeField: string): Opcao[] {
    return rows
        .map((row) => ({
            cod: Number(row[codField]),
            nome: String(row[nomeField] ?? '').trim(),
        }))
        .filter((o) => o.nome !== '')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

export async function GET() {
    try {
        const [departamentosRows, areasRows, classificacoesRows] = await Promise.all([
            firebirdQuery(
                `SELECT COD_DEPARTAMENTO, NOME_DEPARTAMENTO FROM DEPARTAMENTO WHERE ATIVO_DEPARTAMENTO = 'SIM'`,
                []
            ),
            firebirdQuery(
                `SELECT COD_AREA, NOME_AREA FROM AREA WHERE ATIVO_AREA = 'SIM' AND CHAMADO_AREA = 'SIM'`,
                []
            ),
            firebirdQuery(
                `SELECT COD_CLASSIFICACAO, NOME_CLASSIFICACAO FROM CLASSIFICACAO WHERE ATIVO_CLASSIFICACAO = 'SIM'`,
                []
            ),
        ]);

        return NextResponse.json({
            departamentos: processar(
                departamentosRows as Record<string, unknown>[],
                'COD_DEPARTAMENTO',
                'NOME_DEPARTAMENTO'
            ),
            areas: processar(areasRows as Record<string, unknown>[], 'COD_AREA', 'NOME_AREA'),
            classificacoes: processar(
                classificacoesRows as Record<string, unknown>[],
                'COD_CLASSIFICACAO',
                'NOME_CLASSIFICACAO'
            ),
        });
    } catch (error) {
        console.error('[chamados/opcoes] Erro ao buscar opções do formulário:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar opções do formulário.' },
            { status: 500 }
        );
    }
}
