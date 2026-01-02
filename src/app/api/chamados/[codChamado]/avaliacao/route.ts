// app/api/chamados/[codChamado]/avaliacao/route.ts
import { firebirdExecute, firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
    params: {
        codChamado: string;
    };
}

// ==================== VALIDAÇÕES ====================
function validarCodChamado(codChamado: string): number | NextResponse {
    const cod = parseInt(codChamado);

    if (isNaN(cod) || cod <= 0) {
        return NextResponse.json(
            { error: "Parâmetro 'codChamado' deve ser um número válido" },
            { status: 400 }
        );
    }

    return cod;
}

function validarAvaliacao(
    body: any
): { avaliacao: number; observacao: string | null } | NextResponse {
    const { avaliacao, observacao } = body;

    if (!avaliacao || typeof avaliacao !== 'number') {
        return NextResponse.json(
            { error: 'Avaliação é obrigatória e deve ser um número' },
            { status: 400 }
        );
    }

    if (avaliacao < 1 || avaliacao > 5) {
        return NextResponse.json(
            { error: 'Avaliação deve ser entre 1 e 5 estrelas' },
            { status: 400 }
        );
    }

    if (observacao && typeof observacao !== 'string') {
        return NextResponse.json({ error: 'Observação deve ser uma string' }, { status: 400 });
    }

    const obs = observacao ? observacao.trim().substring(0, 200) : null;

    return { avaliacao, observacao: obs };
}

// ==================== VERIFICAÇÕES ====================
async function verificarChamado(codChamado: number): Promise<{
    exists: boolean;
    status?: string;
    avaliacaoAtual?: number;
    error?: NextResponse;
}> {
    try {
        const sql = `
            SELECT
                STATUS_CHAMADO,
                AVALIA_CHAMADO
            FROM CHAMADO
            WHERE COD_CHAMADO = ?
        `;

        const resultado = await firebirdQuery<{
            STATUS_CHAMADO: string;
            AVALIA_CHAMADO: number;
        }>(sql, [codChamado]);

        if (resultado.length === 0) {
            return {
                exists: false,
                error: NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 }),
            };
        }

        const chamado = resultado[0];

        // Verificar se está finalizado
        if (chamado.STATUS_CHAMADO.toUpperCase().trim() !== 'FINALIZADO') {
            return {
                exists: true,
                status: chamado.STATUS_CHAMADO,
                error: NextResponse.json(
                    { error: 'Apenas chamados finalizados podem ser avaliados' },
                    { status: 400 }
                ),
            };
        }

        // Verificar se já foi avaliado
        // AVALIA_CHAMADO = 1 significa "não avaliado"
        // AVALIA_CHAMADO >= 2 significa "já avaliado com nota"
        const jaFoiAvaliado = chamado.AVALIA_CHAMADO !== null && chamado.AVALIA_CHAMADO > 1;

        if (jaFoiAvaliado) {
            return {
                exists: true,
                status: chamado.STATUS_CHAMADO,
                avaliacaoAtual: chamado.AVALIA_CHAMADO,
                error: NextResponse.json(
                    {
                        error: 'Este chamado já foi avaliado anteriormente',
                        avaliacaoAtual: chamado.AVALIA_CHAMADO,
                    },
                    { status: 400 }
                ),
            };
        }

        return {
            exists: true,
            status: chamado.STATUS_CHAMADO,
            avaliacaoAtual: chamado.AVALIA_CHAMADO,
        };
    } catch (error) {
        console.error('[API AVALIACAO] Erro ao verificar chamado:', error);
        return {
            exists: false,
            error: NextResponse.json({ error: 'Erro ao verificar chamado' }, { status: 500 }),
        };
    }
}

// ==================== SALVAR AVALIAÇÃO ====================
async function salvarAvaliacao(
    codChamado: number,
    avaliacao: number,
    observacao: string | null
): Promise<NextResponse> {
    try {
        const sql = `
            UPDATE CHAMADO
            SET AVALIA_CHAMADO = ?,
                OBSAVAL_CHAMADO = ?
            WHERE COD_CHAMADO = ?
        `;

        const params = [avaliacao, observacao || null, codChamado];

        // ✅ MUDANÇA CRÍTICA: usar firebirdExecute ao invés de firebirdQuery
        await firebirdExecute(sql, params);

        return NextResponse.json(
            {
                success: true,
                message: 'Avaliação salva com sucesso',
                codChamado,
                avaliacao,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API AVALIACAO] ❌ Erro ao salvar avaliação:', error);
        console.error('[API AVALIACAO] Stack trace:', error instanceof Error ? error.stack : 'N/A');

        return NextResponse.json(
            {
                error: 'Erro ao salvar avaliação no banco de dados',
                details: error instanceof Error ? error.message : 'Erro desconhecido',
                stack:
                    process.env.NODE_ENV === 'development' && error instanceof Error
                        ? error.stack
                        : undefined,
            },
            { status: 500 }
        );
    }
}

// ==================== HANDLER POST ====================
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { codChamado } = await params;

        // Validar código do chamado
        const codChamadoValidado = validarCodChamado(codChamado);
        if (codChamadoValidado instanceof NextResponse) {
            return codChamadoValidado;
        }

        // Validar corpo da requisição
        const body = await request.json();

        const validacao = validarAvaliacao(body);
        if (validacao instanceof NextResponse) {
            return validacao;
        }

        const { avaliacao, observacao } = validacao;

        // Verificar se o chamado pode ser avaliado
        const verificacao = await verificarChamado(codChamadoValidado);
        if (verificacao.error) {
            return verificacao.error;
        }

        // Salvar avaliação
        return await salvarAvaliacao(codChamadoValidado, avaliacao, observacao);
    } catch (error) {
        console.error('[API AVALIACAO] ❌ Erro geral:', error);
        return NextResponse.json(
            {
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}

// ==================== HANDLER GET (Opcional - para buscar avaliação) ====================
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { codChamado } = await params;

        const codChamadoValidado = validarCodChamado(codChamado);
        if (codChamadoValidado instanceof NextResponse) {
            return codChamadoValidado;
        }

        const sql = `
            SELECT
                COD_CHAMADO,
                AVALIA_CHAMADO,
                OBSAVAL_CHAMADO,
                STATUS_CHAMADO
            FROM CHAMADO
            WHERE COD_CHAMADO = ?
        `;

        const resultado = await firebirdQuery<{
            COD_CHAMADO: number;
            AVALIA_CHAMADO: number;
            OBSAVAL_CHAMADO: string | null;
            STATUS_CHAMADO: string;
        }>(sql, [codChamadoValidado]);

        if (resultado.length === 0) {
            return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
        }

        const chamado = resultado[0];

        return NextResponse.json(
            {
                success: true,
                codChamado: chamado.COD_CHAMADO,
                avaliacao: chamado.AVALIA_CHAMADO,
                observacao: chamado.OBSAVAL_CHAMADO,
                status: chamado.STATUS_CHAMADO,
                foiAvaliado: chamado.AVALIA_CHAMADO > 1,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API AVALIACAO] ❌ Erro ao buscar avaliação:', error);
        return NextResponse.json(
            {
                error: 'Erro ao buscar avaliação',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}
