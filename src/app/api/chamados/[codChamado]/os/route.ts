// app/api/chamados/[codChamado]/os/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import {
    agregarHorasAdicionais,
    calcularHorasComAdicionalAsync,
    HorasAdicionaisResult,
} from '@/lib/os/calcular-horas-adicionais';
import { NextRequest, NextResponse } from 'next/server';

// ==================== TIPOS ====================
export interface OrdemServico {
    COD_OS: number;
    CODTRF_OS: number;
    DTINI_OS: Date;
    HRINI_OS: string;
    HRFIM_OS: string;
    OBS: string | null;
    NUM_OS: string | null;
    VALCLI_OS: string | null;
    OBSCLI_OS?: string | null;
    NOME_RECURSO?: string | null;
    NOME_TAREFA?: string | null;
    NOME_CLIENTE?: string | null;
    TOTAL_HORAS_OS: number;
    // ✅ NOVO: breakdown de horas com adicional
    HORAS_ADICIONAL: HorasAdicionaisResult;
}

interface RouteParams {
    params: {
        codChamado: string;
    };
}

interface QueryParams {
    isAdmin: boolean;
    codCliente?: number;
    mes?: number;
    ano?: number;
}

// ==================== CONFIGURAÇÃO DE CAMPOS ====================
const CAMPOS_OS = {
    COD_OS: 'OS.COD_OS',
    CODTRF_OS: 'OS.CODTRF_OS',
    DTINI_OS: 'OS.DTINI_OS',
    HRINI_OS: 'OS.HRINI_OS',
    HRFIM_OS: 'OS.HRFIM_OS',
    OBS: 'OS.OBS',
    NUM_OS: 'OS.NUM_OS',
    VALCLI_OS: 'OS.VALCLI_OS',
    OBSCLI_OS: 'OS.OBSCLI_OS',
    NOME_RECURSO: 'RECURSO.NOME_RECURSO',
    NOME_TAREFA: 'TAREFA.NOME_TAREFA',
    NOME_CLIENTE: 'CLIENTE.NOME_CLIENTE',
};

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

function validarAutorizacao(
    searchParams: URLSearchParams,
    codChamado: number
): QueryParams | NextResponse {
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');

    if (!isAdmin && !codCliente) {
        return NextResponse.json(
            { error: "Parâmetro 'codCliente' é obrigatório para usuários não admin" },
            { status: 400 }
        );
    }

    let mesNum: number | undefined = undefined;
    let anoNum: number | undefined = undefined;

    if (mes && ano) {
        mesNum = Number(mes);
        anoNum = Number(ano);

        if (mesNum < 1 || mesNum > 12) {
            return NextResponse.json(
                { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
                { status: 400 }
            );
        }

        if (anoNum < 2000 || anoNum > 3000) {
            return NextResponse.json(
                { error: "Parâmetro 'ano' deve ser um número válido" },
                { status: 400 }
            );
        }
    }

    return {
        isAdmin,
        codCliente: codCliente ? parseInt(codCliente) : undefined,
        mes: mesNum,
        ano: anoNum,
    };
}

// ==================== BUSCAR DATA DO CHAMADO ====================
async function buscarDataChamado(codChamado: number): Promise<Date | null> {
    try {
        const resultado = await firebirdQuery<{ DATA_CHAMADO: Date }>(
            `SELECT DATA_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`,
            [codChamado]
        );
        return resultado.length > 0 ? resultado[0].DATA_CHAMADO : null;
    } catch (error) {
        console.error('[API OS] Erro ao buscar data do chamado:', error);
        return null;
    }
}

// ==================== VERIFICAR PERMISSÃO ====================
async function verificarPermissaoChamado(codChamado: number, codCliente: number): Promise<boolean> {
    try {
        const resultado = await firebirdQuery<{ COD_CHAMADO: number }>(
            `SELECT COD_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ? AND COD_CLIENTE = ?`,
            [codChamado, codCliente]
        );
        return resultado.length > 0;
    } catch (error) {
        console.error('[API OS] Erro ao verificar permissão do chamado:', error);
        return false;
    }
}

// ==================== CÁLCULO DE HORAS TRABALHADAS ====================
function calcularHorasTrabalhadas(hrIni: string, hrFim: string): number {
    const horaIni = parseInt(hrIni.substring(0, 2)) + parseInt(hrIni.substring(2, 4)) / 60;
    const horaFim = parseInt(hrFim.substring(0, 2)) + parseInt(hrFim.substring(2, 4)) / 60;
    return horaFim - horaIni;
}

// ==================== CONSTRUÇÃO DE SQL ====================
function construirSQLBase(): string {
    const campos = Object.values(CAMPOS_OS).join(',\n    ');

    return `
SELECT
    ${campos}
FROM OS
LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
WHERE OS.CHAMADO_OS = ?
AND TAREFA.EXIBECHAM_TAREFA = 1
ORDER BY OS.DTINI_OS DESC, OS.NUM_OS DESC`;
}

// ==================== PROCESSAMENTO DE DADOS ====================
async function processarOrdemServico(
    os: any[],
    state?: string,
    city?: string
): Promise<OrdemServico[]> {
    const results: OrdemServico[] = [];
    for (const item of os) {
        const horasAdicional = await calcularHorasComAdicionalAsync(
            item.DTINI_OS,
            item.HRINI_OS,
            item.HRFIM_OS,
            { state, city }
        );

        results.push({
            COD_OS: item.COD_OS,
            CODTRF_OS: item.CODTRF_OS,
            DTINI_OS: item.DTINI_OS,
            HRINI_OS: item.HRINI_OS,
            HRFIM_OS: item.HRFIM_OS,
            OBS: item.OBS || null,
            NUM_OS: item.NUM_OS || null,
            VALCLI_OS: item.VALCLI_OS || null,
            OBSCLI_OS: item.OBSCLI_OS || null,
            NOME_RECURSO: item.NOME_RECURSO || null,
            NOME_TAREFA: item.NOME_TAREFA || null,
            NOME_CLIENTE: item.NOME_CLIENTE || null,
            TOTAL_HORAS_OS: calcularHorasTrabalhadas(item.HRINI_OS, item.HRFIM_OS),
            HORAS_ADICIONAL: horasAdicional,
        });
    }
    return results;
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { searchParams } = new URL(request.url);
        const { codChamado } = await params;

        const codChamadoValidado = validarCodChamado(codChamado);
        if (codChamadoValidado instanceof NextResponse) return codChamadoValidado;

        const auth = validarAutorizacao(searchParams, codChamadoValidado);
        if (auth instanceof NextResponse) return auth;

        if (!auth.isAdmin && auth.codCliente) {
            const temPermissao = await verificarPermissaoChamado(
                codChamadoValidado,
                auth.codCliente
            );
            if (!temPermissao) {
                return NextResponse.json(
                    { error: 'Você não tem permissão para acessar este chamado' },
                    { status: 403 }
                );
            }
        }

        const [dataChamado, os] = await Promise.all([
            buscarDataChamado(codChamadoValidado),
            firebirdQuery<any>(construirSQLBase(), [codChamado]),
        ]);

        const osProcessadas = await processarOrdemServico(os, 'MG', 'Belo Horizonte');

        // ✅ NOVO: agrega o breakdown de todas as OS do chamado
        const horasAdicionaisAgregadas = agregarHorasAdicionais(
            osProcessadas.map((o) => o.HORAS_ADICIONAL)
        );

        const totais = {
            quantidade_OS: osProcessadas.length,
            total_horas_chamado: osProcessadas.reduce((acc, item) => acc + item.TOTAL_HORAS_OS, 0),
            // ✅ NOVO: totais de horas com adicional agregados
            horas_adicional: horasAdicionaisAgregadas,
        };

        return NextResponse.json(
            {
                success: true,
                codChamado: codChamadoValidado,
                dataChamado,
                totais,
                data: osProcessadas,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API OS] ❌ Erro geral:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
