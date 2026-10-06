// app/api/dashboard/graficos/route.ts
import { safeErrorMessage } from '@/lib/api-error';
import { resolveCodClienteSeguro } from '@/lib/auth/cliente-token';
import { NextResponse } from 'next/server';
import { firebirdQuery } from '../../../../lib/firebird/firebird-client';

// ==================== TIPOS ====================
interface QueryParams {
    codCliente?: string;
    mes: number;
    ano: number;
    codClienteFilter?: string;
    codRecursoFilter?: string;
    status?: string;
}

interface OSData {
    DTINI_OS: string | Date;
    HRINI_OS: string;
    HRFIM_OS: string;
    CHAMADO_OS: string;
    CODTRF_OS: number;
    COD_RECURSO: number;
    NOME_RECURSO: string;
    COD_CLIENTE: number;
    NOME_CLIENTE: string;
    STATUS_CHAMADO: string;
}

// ==================== VALIDAÇÕES ====================
async function validarParametros(
    request: Request,
    searchParams: URLSearchParams
): Promise<QueryParams | NextResponse> {
    const codCliente =
        (await resolveCodClienteSeguro(request, searchParams.get('codCliente')))?.trim() ||
        undefined;
    const mes = Number(searchParams.get('mes'));
    const ano = Number(searchParams.get('ano'));

    if (!mes || mes < 1 || mes > 12) {
        return NextResponse.json(
            { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
            { status: 400 }
        );
    }

    if (!ano || ano < 2000 || ano > 3000) {
        return NextResponse.json(
            { error: "Parâmetro 'ano' deve ser um número válido" },
            { status: 400 }
        );
    }

    if (!codCliente) {
        return NextResponse.json(
            { error: "Parâmetro 'codCliente' é obrigatório" },
            { status: 400 }
        );
    }

    return {
        codCliente,
        mes,
        ano,
        codClienteFilter: searchParams.get('codClienteFilter')?.trim() || undefined,
        codRecursoFilter: searchParams.get('codRecursoFilter')?.trim() || undefined,
        status: searchParams.get('status')?.trim() || undefined,
    };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(mes: number, ano: number): { dataInicio: string; dataFim: string } {
    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `01.${mesFormatado}.${ano}`;

    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

    return { dataInicio, dataFim };
}

// ==================== CONSTRUÇÃO DE SQL OTIMIZADO ====================
function construirSQLBase(): string {
    return `
    SELECT
      OS.DTINI_OS,
      OS.HRINI_OS,
      OS.HRFIM_OS,
      OS.CHAMADO_OS,
      OS.CODTRF_OS,
      RECURSO.COD_RECURSO,
      RECURSO.NOME_RECURSO,
      CLIENTE.COD_CLIENTE,
      CLIENTE.NOME_CLIENTE,
      CHAMADO.STATUS_CHAMADO
    FROM OS
    INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
    INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
    INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
    INNER JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
    LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
    WHERE OS.DTINI_OS >= ?
      AND OS.DTINI_OS < ?
      AND OS.CHAMADO_OS IS NOT NULL
      AND TRIM(OS.CHAMADO_OS) <> ''
      AND UPPER(OS.FATURADO_OS) <> 'NAO'
  `;
}

function aplicarFiltros(
    sqlBase: string,
    params: QueryParams,
    paramsArray: any[]
): { sql: string; params: any[] } {
    let sql = sqlBase;

    if (params.codCliente) {
        sql += ` AND CLIENTE.COD_CLIENTE = ?`;
        paramsArray.push(parseInt(params.codCliente));
    }

    if (params.codClienteFilter) {
        sql += ` AND CLIENTE.COD_CLIENTE = ?`;
        paramsArray.push(parseInt(params.codClienteFilter));
    }

    if (params.codRecursoFilter) {
        sql += ` AND RECURSO.COD_RECURSO = ?`;
        paramsArray.push(parseInt(params.codRecursoFilter));
    }

    if (params.status) {
        sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
        paramsArray.push(`%${params.status}%`);
    }

    return { sql, params: paramsArray };
}

// ==================== CAMINHO RÁPIDO (sem filtro de status) ====================
//
// A consulta antiga juntava OS com CHAMADO comparando texto com número (OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO ...)),
// o que impede o uso de índice, e o gráfico anual disparava 12 dessas consultas ao mesmo tempo (mais a do mês), ocupando
// as 5 conexões do pool e atrasando as outras telas. Agora: uma consulta de OS por período, sem o CHAMADO, e uma busca
// simples dos chamados pelos códigos (a OS só entra se o chamado existir, como no antigo INNER JOIN). O resultado é o mesmo.
// Com filtro de status continua valendo o caminho antigo (o LIKE do banco), que é raro.

const CONSULTA_OS_DO_PERIODO = `
    SELECT
      OS.DTINI_OS,
      OS.HRINI_OS,
      OS.HRFIM_OS,
      OS.CHAMADO_OS,
      OS.CODTRF_OS,
      RECURSO.COD_RECURSO,
      RECURSO.NOME_RECURSO,
      CLIENTE.COD_CLIENTE,
      CLIENTE.NOME_CLIENTE
    FROM OS
    INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
    INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
    INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
    LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
    WHERE OS.DTINI_OS >= ?
      AND OS.DTINI_OS < ?
      AND OS.CHAMADO_OS IS NOT NULL
      AND TRIM(OS.CHAMADO_OS) <> ''
      AND UPPER(OS.FATURADO_OS) <> 'NAO'
  `;

const LOTE_DE_CODIGOS = 400;

// status de cada chamado (chave = código como texto, igual ao OS.CHAMADO_OS); só códigos numéricos sem zeros à esquerda
// casam com a antiga comparação de texto
async function statusDosChamados(codigos: string[]): Promise<Map<string, string | null>> {
    const validos = Array.from(new Set(codigos.filter((c) => /^(0|[1-9]\d{0,8})$/.test(c))));
    const mapa = new Map<string, string | null>();

    for (let i = 0; i < validos.length; i += LOTE_DE_CODIGOS) {
        const lote = validos.slice(i, i + LOTE_DE_CODIGOS);
        const linhas = await firebirdQuery<{ COD_CHAMADO: number; STATUS_CHAMADO: string | null }>(
            `SELECT COD_CHAMADO, STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO IN (${lote.map(() => '?').join(', ')})`,
            lote.map(Number)
        );
        for (const l of linhas) mapa.set(String(l.COD_CHAMADO), l.STATUS_CHAMADO);
    }

    return mapa;
}

// OS do período já com o status do chamado; descarta as OS cujo chamado não existe (o antigo INNER JOIN)
async function buscarOsComStatus(
    dataInicio: string,
    dataFim: string,
    params: QueryParams
): Promise<OSData[]> {
    const { sql, params: sqlParams } = aplicarFiltros(CONSULTA_OS_DO_PERIODO, params, [
        dataInicio,
        dataFim,
    ]);
    const linhas = await firebirdQuery<Omit<OSData, 'STATUS_CHAMADO'>>(sql, sqlParams);
    const status = await statusDosChamados(linhas.map((l) => l.CHAMADO_OS));

    return linhas
        .filter((l) => status.has(l.CHAMADO_OS))
        .map((l) => ({ ...l, STATUS_CHAMADO: status.get(l.CHAMADO_OS) as string }));
}

// ==================== CÁLCULOS ====================
function calcularHorasTrabalhadas(
    hrIni: string | null = '0000',
    hrFim: string | null = '0000'
): number {
    const hrIniNorm = hrIni || '0000';
    const hrFimNorm = hrFim || '0000';

    const horaIni = parseInt(hrIniNorm.substring(0, 2));
    const minIni = parseInt(hrIniNorm.substring(2, 4));
    const horaFim = parseInt(hrFimNorm.substring(0, 2));
    const minFim = parseInt(hrFimNorm.substring(2, 4));

    const totalMinutos = horaFim * 60 + minFim - (horaIni * 60 + minIni);
    return parseFloat((totalMinutos / 60).toFixed(2));
}

function extrairDia(dtini: string | Date): number {
    if (typeof dtini === 'string') {
        const [dia] = dtini.split('.');
        return parseInt(dia);
    } else if (dtini instanceof Date) {
        return dtini.getDate();
    } else if (dtini === null || dtini === undefined) {
        return 0;
    } else {
        const dataStr = String(dtini);
        const [dia] = dataStr.split('.');
        return parseInt(dia);
    }
}

// ==================== PROCESSAMENTO UNIFICADO ====================
function processarDadosUnificados(dados: OSData[], mes: number, ano: number) {
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const horasPorDia = new Map<number, number>();
    for (let dia = 1; dia <= diasNoMes; dia++) {
        horasPorDia.set(dia, 0);
    }

    const horasPorChamado = new Map<string, { horas: number; cliente: string; status: string }>();
    const horasPorStatus = new Map<string, number>();
    const horasPorRecurso = new Map<
        string,
        { codRecurso: number; horas: number; quantidadeOS: number }
    >();

    let totalOS = 0;
    let totalHoras = 0;
    const chamadosUnicos = new Set<string>();
    const recursosUnicos = new Set<number>();

    dados.forEach((os) => {
        const horas = calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
        totalOS++;
        totalHoras += horas;

        const diaNum = extrairDia(os.DTINI_OS);
        if (diaNum > 0 && diaNum <= diasNoMes) {
            const horasAtuais = horasPorDia.get(diaNum) || 0;
            horasPorDia.set(diaNum, horasAtuais + horas);
        }

        if (os.CHAMADO_OS) {
            chamadosUnicos.add(os.CHAMADO_OS);
            const atual = horasPorChamado.get(os.CHAMADO_OS) || {
                horas: 0,
                cliente: os.NOME_CLIENTE || 'Sem cliente',
                status: os.STATUS_CHAMADO || 'Tarefa',
            };
            horasPorChamado.set(os.CHAMADO_OS, {
                ...atual,
                horas: atual.horas + horas,
            });
        }

        const status = os.STATUS_CHAMADO || 'Tarefa';
        const horasStatus = horasPorStatus.get(status) || 0;
        horasPorStatus.set(status, horasStatus + horas);

        if (os.COD_RECURSO !== null && os.COD_RECURSO !== undefined) {
            const recurso = os.NOME_RECURSO || 'Sem Recurso';

            if (os.COD_RECURSO !== 0) recursosUnicos.add(os.COD_RECURSO);

            const atualRecurso = horasPorRecurso.get(recurso) || {
                codRecurso: os.COD_RECURSO,
                horas: 0,
                quantidadeOS: 0,
            };
            horasPorRecurso.set(recurso, {
                codRecurso: atualRecurso.codRecurso,
                horas: atualRecurso.horas + horas,
                quantidadeOS: atualRecurso.quantidadeOS + 1,
            });
        }
    });

    // Formatar resultados
    return {
        totalizadores: {
            TOTAL_OS: totalOS,
            TOTAL_CHAMADOS: chamadosUnicos.size,
            TOTAL_RECURSOS: recursosUnicos.size,
            TOTAL_HRS: parseFloat(totalHoras.toFixed(2)),
        },
        horasPorDia: Array.from(horasPorDia.entries())
            .map(([dia, horas]) => ({
                dia,
                horas: parseFloat(horas.toFixed(2)),
                data: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`,
            }))
            .sort((a, b) => a.dia - b.dia),
        topChamados: Array.from(horasPorChamado.entries())
            .map(([chamado, dados]) => ({
                chamado,
                horas: parseFloat(dados.horas.toFixed(2)),
                cliente: dados.cliente,
                status: dados.status,
            }))
            .sort((a, b) => b.horas - a.horas)
            .slice(0, 10),
        horasPorStatus: (() => {
            const dados = Array.from(horasPorStatus.entries())
                .map(([status, horas]) => ({
                    status,
                    horas: parseFloat(horas.toFixed(2)),
                }))
                .sort((a, b) => b.horas - a.horas);

            const total = dados.reduce((acc, item) => acc + item.horas, 0);

            return dados.map((item) => ({
                ...item,
                percentual: total > 0 ? parseFloat(((item.horas / total) * 100).toFixed(2)) : 0,
            }));
        })(),
        horasPorRecurso: Array.from(horasPorRecurso.entries())
            .map(([recurso, dados]) => ({
                recurso,
                codRecurso: dados.codRecurso,
                horas: parseFloat(dados.horas.toFixed(2)),
                quantidadeOS: dados.quantidadeOS,
                mediaHorasPorOS: parseFloat((dados.horas / dados.quantidadeOS).toFixed(2)),
            }))
            .sort((a, b) => b.horas - a.horas),
    };
}

// ==================== GRÁFICO ANUAL (Paralelo) ====================
async function gerarHorasPorMesRapido(ano: number, params: QueryParams) {
    const nomes = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
    ];
    const somas = new Array<number>(12).fill(0);

    try {
        const { dataInicio } = construirDatas(1, ano);
        const { dataFim } = construirDatas(12, ano);
        const oss = await buscarOsComStatus(dataInicio, dataFim, params);

        for (const os of oss) {
            // DTINI_OS vem como Date; texto "DD.MM.AAAA" também é aceito
            const indice =
                os.DTINI_OS instanceof Date
                    ? os.DTINI_OS.getMonth()
                    : parseInt(String(os.DTINI_OS).split('.')[1], 10) - 1;
            if (!(indice >= 0 && indice < 12)) continue;
            somas[indice] += calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
        }
    } catch (error) {
        // como antes: um erro no gráfico anual não derruba a resposta; os meses ficam com 0 hora
        console.error('[API GRAFICOS] Erro ao buscar o ano:', error);
    }

    return nomes.map((mes, i) => ({ mes, mesNum: i + 1, horas: parseFloat(somas[i].toFixed(2)) }));
}

async function gerarHorasPorMes(ano: number, params: QueryParams) {
    if (!params.status) return gerarHorasPorMesRapido(ano, params);

    const mesesNomes = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
    ];

    // Buscar todos os meses em paralelo
    const promessasMeses = Array.from({ length: 12 }, (_, i) => i + 1).map(async (mes) => {
        const { dataInicio, dataFim } = construirDatas(mes, ano);

        const sql = `
  SELECT OS.HRINI_OS, OS.HRFIM_OS
  FROM OS
  INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
  INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  INNER JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  WHERE OS.DTINI_OS >= ?
    AND OS.DTINI_OS < ?
    AND OS.CHAMADO_OS IS NOT NULL
    AND TRIM(OS.CHAMADO_OS) <> ''
    AND UPPER(OS.FATURADO_OS) <> 'NAO'
`;

        const { sql: sqlFiltrado, params: sqlParams } = aplicarFiltros(sql, params, [
            dataInicio,
            dataFim,
        ]);

        try {
            const resultados = await firebirdQuery(sqlFiltrado, sqlParams);

            const totalHoras = resultados.reduce((acc: number, os: any) => {
                return acc + calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
            }, 0);

            return {
                mes: mesesNomes[mes - 1],
                mesNum: mes,
                horas: parseFloat(totalHoras.toFixed(2)),
            };
        } catch (error) {
            console.error(`[API GRAFICOS] Erro ao buscar mês ${mes}:`, error);
            return {
                mes: mesesNomes[mes - 1],
                mesNum: mes,
                horas: 0,
            };
        }
    });

    return Promise.all(promessasMeses);
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const params = await validarParametros(request, searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        // Buscar dados do mês atual e horas por mês em paralelo
        const sqlBase = construirSQLBase();
        const { sql: sqlFinal, params: paramsFinal } = aplicarFiltros(sqlBase, params, [
            dataInicio,
            dataFim,
        ]);

        const [dadosMes, horasPorMes] = await Promise.all([
            params.status
                ? firebirdQuery<OSData>(sqlFinal, paramsFinal)
                : buscarOsComStatus(dataInicio, dataFim, params),
            gerarHorasPorMes(params.ano, params),
        ]);

        // Processar todos os gráficos de uma vez
        const resultados = processarDadosUnificados(dadosMes, params.mes, params.ano);

        return NextResponse.json({
            totalizadores: resultados.totalizadores,
            graficos: {
                horasPorDia: resultados.horasPorDia,
                topChamados: resultados.topChamados,
                horasPorStatus: resultados.horasPorStatus,
                horasPorRecurso: resultados.horasPorRecurso,
                horasPorMes,
            },
        });
    } catch (error) {
        console.error('[API GRAFICOS] Erro ao buscar dados:', error);
        console.error('[API GRAFICOS] Stack:', error instanceof Error ? error.stack : 'N/A');

        return NextResponse.json(
            {
                error: 'Erro interno do servidor',
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
