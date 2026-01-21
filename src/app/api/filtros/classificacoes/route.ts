// app/api/filtros/classificacoes/route.ts - ATUALIZADO PARA SUPORTAR NOVOS FILTROS
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

// ==================== TIPOS ====================
interface QueryParams {
    isAdmin: boolean;
    codCliente?: string;
    mes?: number; // ✅ Agora opcional
    ano?: number; // ✅ Agora opcional
    cliente?: string;
}

interface Classificacao {
    cod: string;
    nome: string;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(searchParams: URLSearchParams): QueryParams | NextResponse {
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
    const cliente = searchParams.get('cliente')?.trim();

    // ✅ NOVA LÓGICA: mes e ano são opcionais
    const mesParam = searchParams.get('mes');
    const anoParam = searchParams.get('ano');

    let mes: number | undefined;
    let ano: number | undefined;

    // Se mes foi fornecido, validar
    if (mesParam) {
        mes = Number(mesParam);
        if (mes < 1 || mes > 12) {
            return NextResponse.json(
                { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
                { status: 400 }
            );
        }
    }

    // Se ano foi fornecido, validar
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

    return { isAdmin, codCliente, mes, ano, cliente };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(
    mes?: number,
    ano?: number
): { dataInicio: string | null; dataFim: string | null } {
    // ✅ Se não houver mes ou ano, retorna null
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
    let sql = `
    SELECT DISTINCT
      CLASSIFICACAO.COD_CLASSIFICACAO,
      CLASSIFICACAO.NOME_CLASSIFICACAO
    FROM CHAMADO
    INNER JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
    INNER JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
    WHERE CLASSIFICACAO.NOME_CLASSIFICACAO IS NOT NULL
      AND TRIM(CLASSIFICACAO.NOME_CLASSIFICACAO) <> ''
      AND CLASSIFICACAO.ATIVO_CLASSIFICACAO = 'SIM'
  `;

    const sqlParams: any[] = [];

    // ✅ NOVA LÓGICA: Só filtrar por data se dataInicio e dataFim existirem
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

    // Filtro opcional por cliente (para admin)
    if (params.cliente) {
        sql += ` AND CLIENTE.NOME_CLIENTE = ?`;
        sqlParams.push(params.cliente);
    }

    // Ordenação alfabética diretamente no banco
    sql += ` ORDER BY CLASSIFICACAO.NOME_CLASSIFICACAO`;

    return { sql, params: sqlParams };
}

// ==================== PROCESSAMENTO ====================
function processarClassificacoes(resultados: any[]): Classificacao[] {
    return resultados
        .map((item) => ({
            cod: String(item.COD_CLASSIFICACAO),
            nome: item.NOME_CLASSIFICACAO.trim(),
        }))
        .filter((classificacao) => classificacao.nome && classificacao.nome !== '')
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

        // Executar query
        const classificacoes = await firebirdQuery(sqlFinal, sqlParams);

        // Processar e ordenar classificacoes
        const classificacoesProcessadas = processarClassificacoes(classificacoes);

        return NextResponse.json(classificacoesProcessadas);
    } catch (error) {
        console.error('Erro detalhado ao buscar classificações:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
        console.error('Message:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                error: 'Erro ao buscar classificações',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                timestamp: new Date().toISOString(),
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
