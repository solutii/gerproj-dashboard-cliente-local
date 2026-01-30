// src/app/paginas/chamados/componentes/Exporta_Excel_Chamados.tsx

'use client';

import type { ChamadoRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados';
import type { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { renderizarDoisPrimeirosNomes } from '@/formatters/remover-acentuacao';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import { RiFileExcel2Fill } from 'react-icons/ri';

// ================================================================================
// INTERFACES E TIPOS
// ================================================================================
interface FiltrosRelatorio {
    ano?: string;
    mes?: string;
    cliente?: string;
    recurso?: string;
    status?: string;
    totalChamados?: number;
    totalOS?: number;
    totalHorasOS?: number;
}

interface ExportarExcelTabelaChamadosButtonProps {
    data: ChamadoRowProps[];
    filtros?: FiltrosRelatorio;
    isAdmin: boolean;
    codCliente?: string | null;
    className?: string;
    disabled?: boolean;
}

interface OSFetchResult {
    codChamado: number;
    osList: OSRowProps[];
    dataChamado?: string;
}

// ================================================================================
// FUNÇÕES AUXILIARES - OTIMIZADAS
// ================================================================================

/**
 * Busca OS de um chamado específico
 */
async function fetchOSByChamado(
    codChamado: number,
    isAdmin: boolean,
    codCliente?: string | null,
    dataChamado?: string
): Promise<OSRowProps[]> {
    try {
        const params = new URLSearchParams({ isAdmin: String(isAdmin) });

        if (!isAdmin && codCliente) {
            params.append('codCliente', codCliente);
        }

        const response = await fetch(`/api/chamados/${codChamado}/os?${params.toString()}`, {
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return [];

        const data = await response.json();
        return data.success && data.data ? data.data : [];
    } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            console.warn(`⏱️ Timeout ao buscar OS do chamado ${codChamado}`);
        } else {
            console.error(`❌ Erro ao buscar OS do chamado ${codChamado}:`, error);
        }
        return [];
    }
}

/**
 * Busca todas as OS em lotes paralelos otimizados
 */
async function fetchAllOS(
    chamados: ChamadoRowProps[],
    isAdmin: boolean,
    codCliente?: string | null,
    onProgress?: (current: number, total: number) => void
): Promise<Map<number, OSRowProps[]>> {
    const osMap = new Map<number, OSRowProps[]>();
    const chamadosComOS = chamados.filter((c) => c.TEM_OS);

    if (chamadosComOS.length === 0) return osMap;

    const BATCH_SIZE = 10;
    const batches: ChamadoRowProps[][] = [];

    for (let i = 0; i < chamadosComOS.length; i += BATCH_SIZE) {
        batches.push(chamadosComOS.slice(i, i + BATCH_SIZE));
    }

    let processed = 0;

    for (const batch of batches) {
        const promises = batch.map((chamado) =>
            fetchOSByChamado(
                chamado.COD_CHAMADO,
                isAdmin,
                codCliente,
                chamado.DATA_CHAMADO?.toString()
            ).then((osList) => ({
                codChamado: chamado.COD_CHAMADO,
                osList,
            }))
        );

        const results = await Promise.allSettled(promises);

        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.osList.length > 0) {
                osMap.set(result.value.codChamado, result.value.osList);
            }
        });

        processed += batch.length;
        if (onProgress) onProgress(processed, chamadosComOS.length);
    }

    return osMap;
}

/**
 * Spinner de loading otimizado
 */
function LoadingSpinner() {
    return (
        <svg
            className="h-6 w-6 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

/**
 * Retorna nome do mês
 */
function obterNomeMes(mes: string): string {
    const meses: { [key: string]: string } = {
        '01': 'JANEIRO',
        '02': 'FEVEREIRO',
        '03': 'MARÇO',
        '04': 'ABRIL',
        '05': 'MAIO',
        '06': 'JUNHO',
        '07': 'JULHO',
        '08': 'AGOSTO',
        '09': 'SETEMBRO',
        '10': 'OUTUBRO',
        '11': 'NOVEMBRO',
        '12': 'DEZEMBRO',
    };
    return meses[mes] || mes;
}

/**
 * Aplica bordas em uma célula do Excel
 */
function aplicarBordas(cell: ExcelJS.Cell) {
    cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
    };
}

/**
 * Gera a aba de CHAMADOS (versão simplificada - sem separação de chamados com/sem OS)
 */
function gerarAbaChamados(
    workbook: ExcelJS.Workbook,
    data: ChamadoRowProps[],
    filtros: FiltrosRelatorio | undefined
): void {
    const ws = workbook.addWorksheet('Chamados');
    ws.views = [{ showGridLines: false }];
    let row = 1;

    // ===== TÍTULO =====
    ws.mergeCells('A1:H1');
    const title = ws.getCell('A1');
    title.value = 'RELATÓRIO DE CHAMADOS';
    title.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
    title.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
    };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    aplicarBordas(title);
    ws.getRow(1).height = 35;
    row = 2;

    // ===== DATA DE GERAÇÃO =====
    ws.mergeCells('A2:H2');
    const date = ws.getCell('A2');
    date.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    date.font = { italic: true, size: 14, color: { argb: 'FFFFFFFF' } };
    date.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
    };
    date.alignment = { horizontal: 'center', vertical: 'middle' };
    aplicarBordas(date);
    ws.getRow(2).height = 25;
    row = 4;

    // ===== PERÍODO (CONDICIONAL) - MESMA LÓGICA DO PDF =====
    // Validação rigorosa: verifica undefined, null, string vazia e string literal "undefined"
    const mesValido =
        filtros?.mes &&
        String(filtros.mes).trim() !== '' &&
        filtros.mes !== 'undefined' &&
        filtros.mes !== undefined;

    const anoValido =
        filtros?.ano &&
        String(filtros.ano).trim() !== '' &&
        filtros.ano !== 'undefined' &&
        filtros.ano !== undefined;

    const mes = mesValido ? String(filtros.mes).trim() : null;
    const ano = anoValido ? String(filtros.ano).trim() : null;

    if (mes || ano) {
        const nomeMes = mes ? obterNomeMes(mes) : null;

        // Determinar texto do período
        let textoPeriodo = '';
        if (nomeMes && ano) {
            textoPeriodo = `PERÍODO: ${nomeMes}/${ano}`;
        } else if (ano && !nomeMes) {
            textoPeriodo = `PERÍODO: ${ano}`;
        }

        // Só renderiza se houver texto válido
        if (textoPeriodo) {
            ws.mergeCells(`A${row}:H${row}`);
            const periodo = ws.getCell(`A${row}`);
            periodo.value = textoPeriodo;
            periodo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
            periodo.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6B21A8' },
            };
            periodo.alignment = { horizontal: 'center', vertical: 'middle' };
            aplicarBordas(periodo);
            ws.getRow(row).height = 28;
            row += 2;
        }
    }

    // ===== TOTAL DE CHAMADOS =====
    ws.mergeCells(`A${row}:H${row}`);
    const totalChamados = ws.getCell(`A${row}`);
    totalChamados.value = `CHAMADOS — TOTAL: ${data.length}`;
    totalChamados.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    totalChamados.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
    };
    totalChamados.alignment = { horizontal: 'center', vertical: 'middle' };
    aplicarBordas(totalChamados);
    ws.getRow(row).height = 28;
    row += 2;

    // ===== CABEÇALHOS =====
    const headers = [
        'CHAMADO',
        'DATA',
        'PRIOR.',
        'ASSUNTO',
        'CLASSIFICAÇÃO',
        'CONSULTOR(A)',
        'STATUS',
        'HORAS',
    ];

    headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F766E' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        aplicarBordas(cell);
    });
    ws.getRow(row).height = 22;
    row++;

    // ===== DADOS DOS CHAMADOS (TODOS JUNTOS) =====
    data.forEach((coluna) => {
        const dados = [
            formatarNumeros(coluna.COD_CHAMADO),
            formatarDataParaBR(coluna.DATA_CHAMADO),
            `P-${coluna.PRIOR_CHAMADO}`,
            corrigirTextoCorrompido(coluna.ASSUNTO_CHAMADO).substring(0, 40),
            corrigirTextoCorrompido(coluna.NOME_CLASSIFICACAO).substring(0, 25),
            renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(coluna.NOME_RECURSO) || '---'),
            coluna.STATUS_CHAMADO,
            formatarHorasTotaisSufixo(coluna.TOTAL_HORAS_OS),
        ];

        dados.forEach((val, i) => {
            const cell = ws.getCell(row, i + 1);
            cell.value = val;
            cell.alignment = {
                horizontal: [0, 1, 2, 6, 7].includes(i) ? 'center' : 'left',
                vertical: 'middle',
                indent: [3, 4, 5].includes(i) ? 2 : 0,
            };
            if (i === 0) cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
            aplicarBordas(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    });

    // ===== CONFIGURAR LARGURAS DAS COLUNAS =====
    ws.columns = [
        { width: 15 }, // CHAMADO
        { width: 15 }, // DATA
        { width: 15 }, // PRIORIDADE
        { width: 40 }, // ASSUNTO
        { width: 30 }, // CLASSIFICAÇÃO
        { width: 25 }, // CONSULTOR
        { width: 25 }, // STATUS
        { width: 15 }, // HORAS
    ];
}

/**
 * Gera a aba de ORDENS DE SERVIÇO
 */
function gerarAbaOS(
    workbook: ExcelJS.Workbook,
    data: ChamadoRowProps[],
    osData: Map<number, OSRowProps[]>,
    filtros: FiltrosRelatorio | undefined
): void {
    const ws = workbook.addWorksheet('Ordens de Serviço');
    ws.views = [{ showGridLines: false }];
    let osRow = 1;

    // ===== TÍTULO =====
    ws.mergeCells('A1:I1');
    const osTitle = ws.getCell('A1');
    osTitle.value = 'RELATÓRIO DE ORDENS DE SERVIÇO';
    osTitle.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
    osTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0891B2' },
    };
    osTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    aplicarBordas(osTitle);
    ws.getRow(1).height = 35;

    // ===== DATA DE GERAÇÃO =====
    ws.mergeCells('A2:I2');
    const osDate = ws.getCell('A2');
    osDate.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    osDate.font = { italic: true, size: 14, color: { argb: 'FFFFFFFF' } };
    osDate.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0891B2' },
    };
    osDate.alignment = { horizontal: 'center', vertical: 'middle' };
    aplicarBordas(osDate);
    ws.getRow(2).height = 25;
    osRow = 4;

    // ===== PERÍODO (CONDICIONAL) - MESMA LÓGICA DO PDF =====
    const mesValido =
        filtros?.mes &&
        String(filtros.mes).trim() !== '' &&
        filtros.mes !== 'undefined' &&
        filtros.mes !== undefined;

    const anoValido =
        filtros?.ano &&
        String(filtros.ano).trim() !== '' &&
        filtros.ano !== 'undefined' &&
        filtros.ano !== undefined;

    const mes = mesValido ? String(filtros.mes).trim() : null;
    const ano = anoValido ? String(filtros.ano).trim() : null;

    if (mes || ano) {
        const nomeMes = mes ? obterNomeMes(mes) : null;

        let textoPeriodo = '';
        if (nomeMes && ano) {
            textoPeriodo = `PERÍODO: ${nomeMes}/${ano}`;
        } else if (ano && !nomeMes) {
            textoPeriodo = `PERÍODO: ${ano}`;
        }

        if (textoPeriodo) {
            ws.mergeCells(`A${osRow}:I${osRow}`);
            const osPeriodo = ws.getCell(`A${osRow}`);
            osPeriodo.value = textoPeriodo;
            osPeriodo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
            osPeriodo.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0891B2' },
            };
            osPeriodo.alignment = { horizontal: 'center', vertical: 'middle' };
            aplicarBordas(osPeriodo);
            ws.getRow(osRow).height = 28;
            osRow += 2;
        }
    }

    // ===== CABEÇALHOS =====
    const osHeaders = [
        'CHAMADO',
        'Nº OS',
        'DATA',
        'INÍCIO',
        'FIM',
        'HORAS',
        'DESCRIÇÃO',
        'CONSULTOR',
        'VALID.',
    ];

    osHeaders.forEach((h, i) => {
        const cell = ws.getCell(osRow, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF14B8A6' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        aplicarBordas(cell);
    });
    ws.getRow(osRow).height = 22;
    osRow++;

    // ===== DADOS DAS OS's =====
    const chamadosComOS = data.filter((c) => c.TEM_OS);

    if (chamadosComOS.length === 0 || osData.size === 0) {
        ws.mergeCells(`A${osRow}:I${osRow}`);
        const msgCell = ws.getCell(`A${osRow}`);
        msgCell.value = 'Nenhuma Ordem de Serviço encontrada nos chamados exibidos';
        msgCell.font = { italic: true, size: 14, color: { argb: 'FF666666' } };
        msgCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(osRow).height = 30;
        osRow++;
    } else {
        chamadosComOS.forEach((chamado) => {
            const osList = osData.get(chamado.COD_CHAMADO);
            if (!osList || osList.length === 0) return;

            osList.forEach((os) => {
                const osRowData = [
                    formatarNumeros(chamado.COD_CHAMADO),
                    formatarNumeros(os.NUM_OS) || '---',
                    formatarDataParaBR(os.DTINI_OS),
                    formatarHora(os.HRINI_OS),
                    formatarHora(os.HRFIM_OS),
                    formatarHorasTotaisSufixo(os.TOTAL_HORAS_OS),
                    corrigirTextoCorrompido(os.OBS) || '---',
                    renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(os.NOME_RECURSO) || '---'),
                    os.VALCLI_OS || '---',
                ];

                osRowData.forEach((val, i) => {
                    const cell = ws.getCell(osRow, i + 1);
                    cell.value = val;
                    cell.alignment = {
                        horizontal: [0, 1, 2, 3, 4, 5, 8].includes(i) ? 'center' : 'left',
                        vertical: 'middle',
                        indent: [6, 7].includes(i) ? 2 : 0,
                    };

                    if (i === 8) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb: val === 'SIM' || val === 'Sim' ? 'FF3B82F6' : 'FFEF4444',
                            },
                        };
                    }
                    if (i === 0) cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
                    aplicarBordas(cell);
                });
                ws.getRow(osRow).height = 20;
                osRow++;
            });
        });
    }

    // ===== CONFIGURAR LARGURAS DAS COLUNAS =====
    ws.columns = [
        { width: 15 }, // CHAMADO
        { width: 15 }, // NÚMERO
        { width: 15 }, // DATA
        { width: 15 }, // INÍCIO
        { width: 15 }, // FIM
        { width: 15 }, // HORAS
        { width: 40 }, // DESCRIÇÃO
        { width: 25 }, // CONSULTOR
        { width: 15 }, // VALIDAÇÃO
    ];
}

/**
 * Componente principal de exportação para Excel
 */
export function ExportarExcelTabelaChamados({
    data,
    filtros,
    isAdmin,
    codCliente,
    className = '',
    disabled = false,
}: ExportarExcelTabelaChamadosButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    if (!data || data.length === 0) disabled = true;

    const exportToExcel = async () => {
        setIsExporting(true);
        setProgress({ current: 0, total: 0 });

        try {
            console.log('🔍 Iniciando busca de OS para Excel...');
            const startTime = performance.now();

            const osData = await fetchAllOS(data, isAdmin, codCliente, (current, total) => {
                setProgress({ current, total });
            });

            const fetchTime = performance.now() - startTime;
            console.log(`✅ OS's buscadas em ${(fetchTime / 1000).toFixed(2)}s`);

            console.log('📊 Criando workbook...');
            const workbook = new ExcelJS.Workbook();

            console.log('📄 Gerando aba de chamados...');
            gerarAbaChamados(workbook, data, filtros);

            console.log('📋 Gerando aba de OS...');
            gerarAbaOS(workbook, data, osData, filtros);

            console.log('💾 Salvando arquivo...');
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            const timestamp = new Date().getTime();
            const nomeArquivo = `Relatorio_Chamados_${filtros?.mes || 'todos'}_${filtros?.ano || new Date().getFullYear()}_${timestamp}.xlsx`;

            saveAs(blob, nomeArquivo);

            const totalTime = performance.now() - startTime;
            console.log(`✅ Excel gerado com sucesso em ${(totalTime / 1000).toFixed(2)}s`);
        } catch (error) {
            console.error('❌ Erro ao exportar Excel:', error);
            alert('Erro ao gerar o Excel. Tente novamente.');
        } finally {
            setIsExporting(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <button
            onClick={exportToExcel}
            disabled={isExporting || disabled}
            title={
                disabled
                    ? 'Não há dados para exportar'
                    : isExporting
                      ? progress.total > 0
                          ? `Buscando OS's: ${progress.current}/${progress.total}`
                          : 'Gerando Excel...'
                      : 'Exportar para Excel'
            }
            className={`group cursor-pointer rounded-md bg-gradient-to-br from-green-600 to-green-700 p-3 shadow-md shadow-black transition-all duration-200 hover:scale-115 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {isExporting ? (
                <div className="flex flex-col items-center gap-1">
                    <LoadingSpinner />
                    {progress.total > 0 && (
                        <span className="text-xs font-bold text-white">
                            {progress.current}/{progress.total}
                        </span>
                    )}
                </div>
            ) : (
                <RiFileExcel2Fill
                    className="text-white group-hover:scale-110 group-active:scale-95"
                    size={24}
                />
            )}
        </button>
    );
}
