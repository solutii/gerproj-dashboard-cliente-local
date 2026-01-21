import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

// ==================== TIPOS ====================
interface QueryParams {
    isAdmin: boolean;
    codCliente?: string;
    cliente?: string;
    mes?: number; // ✅ OPCIONAL
    ano?: number; // ✅ OPCIONAL
}

interface Recurso {
    cod: string;
    nome: string;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(searchParams: URLSearchParams): QueryParams | NextResponse {
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
    const cliente = searchParams.get('cliente')?.trim();

    // ✅ Parâmetros opcionais
    const mesParam = searchParams.get('mes');
    const anoParam = searchParams.get('ano');

    let mes: number | undefined;
    let ano: number | undefined;

    // Validar mes se fornecido
    if (mesParam) {
        mes = Number(mesParam);
        if (mes < 1 || mes > 12) {
            return NextResponse.json(
                { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
                { status: 400 }
            );
        }
    }

    // Validar ano se fornecido
    if (anoParam) {
        ano = Number(anoParam);
        if (ano < 2000 || ano > 3000) {
            return NextResponse.json(
                { error: "Parâmetro 'ano' deve ser um número válido" },
                { status: 400 }
            );
        }
    }

    if (!isAdmin && !codCliente) {
        return NextResponse.json(
            { error: "Parâmetro 'codCliente' é obrigatório para usuários não admin" },
            { status: 400 }
        );
    }

    return { isAdmin, codCliente, cliente, mes, ano };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(
    mes?: number,
    ano?: number
): { dataInicio: string | null; dataFim: string | null } {
    // ✅ Se não tiver mes ou ano, retorna null
    if (!mes || !ano) {
        return { dataInicio: null, dataFim: null };
    }

    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `01.${mesFormatado}.${ano}`;

    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

    return { dataInicio, dataFim };
}

// ==================== CONSTRUÇÃO DE SQL ====================
function construirSQL(
    params: QueryParams,
    dataInicio: string | null,
    dataFim: string | null
): { sql: string; params: any[] } {
    // ✅ SQL BASE sem filtro de data
    let sql = `
    SELECT DISTINCT
      RECURSO.COD_RECURSO,
      RECURSO.NOME_RECURSO
    FROM CHAMADO
    INNER JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
    INNER JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
    WHERE RECURSO.NOME_RECURSO IS NOT NULL
      AND TRIM(RECURSO.NOME_RECURSO) <> ''
  `;

    const sqlParams: any[] = [];

    // ✅ ADICIONAR filtro de data SOMENTE se fornecido
    if (dataInicio && dataFim) {
        sql += ` AND CHAMADO.DATA_CHAMADO >= ?
             AND CHAMADO.DATA_CHAMADO < ?`;
        sqlParams.push(dataInicio, dataFim);
    }

    // Filtro obrigatório para não-admin
    if (!params.isAdmin && params.codCliente) {
        sql += ` AND CLIENTE.COD_CLIENTE = ?`;
        sqlParams.push(parseInt(params.codCliente));
    }

    // Filtro opcional por código de cliente (para admin)
    if (params.isAdmin && params.cliente) {
        sql += ` AND CLIENTE.COD_CLIENTE = ?`;
        sqlParams.push(parseInt(params.cliente));
    }

    // Ordenação alfabética
    sql += ` ORDER BY RECURSO.NOME_RECURSO`;

    return { sql, params: sqlParams };
}

// ==================== PROCESSAMENTO ====================
function processarRecursos(resultados: any[]): Recurso[] {
    return resultados
        .map((item) => ({
            cod: String(item.COD_RECURSO),
            nome: item.NOME_RECURSO.trim(),
        }))
        .filter((recurso) => recurso.nome && recurso.nome !== '')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Validar parâmetros
        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        // Construir datas no formato Firebird DATE (DD.MM.YYYY)
        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        // Construir query com filtros
        const { sql: sqlFinal, params: sqlParams } = construirSQL(params, dataInicio, dataFim);

        console.log('🔍 SQL Final:', sqlFinal);
        console.log('📝 Params:', sqlParams);

        // Executar query
        const recursos = await firebirdQuery(sqlFinal, sqlParams);

        console.log('✅ Total de recursos encontrados:', recursos.length);

        // Processar e ordenar recursos
        const recursosProcessados = processarRecursos(recursos);

        return NextResponse.json(recursosProcessados);
    } catch (error) {
        console.error('Erro detalhado ao buscar recursos:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
        console.error('Message:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                error: 'Erro ao buscar recursos',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                timestamp: new Date().toISOString(),
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
