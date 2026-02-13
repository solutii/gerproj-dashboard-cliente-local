// src/app/paginas/chamados/componentes/Exporta_Excel_Chamados.tsx

'use client';

import type { ChamadoRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados';
import type { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataHoraChamado, formatarDataParaBR } from '@/formatters/formatar-data';
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
 * Configuração de horário comercial
 */
interface HorarioComercial {
    inicio: number;
    fim: number;
    diasUteis: number[];
}

const HORARIO_COMERCIAL: HorarioComercial = {
    inicio: 8,
    fim: 18,
    diasUteis: [1, 2, 3, 4, 5], // segunda a sexta
};

/**
 * Prazos de SLA por prioridade (em horas úteis)
 */
const PRAZOS_SLA: Record<number, number> = {
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    100: 8, // padrão
};

/**
 * Normaliza dataFim para o último momento útil caso caia fora do horário comercial
 */
function normalizarDataFim(data: Date, config: HorarioComercial): Date {
    const resultado = new Date(data);
    const hora = resultado.getHours();
    const minuto = resultado.getMinutes();
    const segundo = resultado.getSeconds();

    const antesDoExpediente = hora < config.inicio;
    const aposOExpediente =
        hora > config.fim || (hora === config.fim && (minuto > 0 || segundo > 0));
    const exatamenteNoFim = hora === config.fim && minuto === 0 && segundo === 0;

    if (exatamenteNoFim) {
        return resultado;
    }

    if (antesDoExpediente) {
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay())) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    if (aposOExpediente) {
        if (config.diasUteis.includes(resultado.getDay())) {
            resultado.setHours(config.fim, 0, 0, 0);
        } else {
            resultado.setDate(resultado.getDate() - 1);
            while (!config.diasUteis.includes(resultado.getDay())) {
                resultado.setDate(resultado.getDate() - 1);
            }
            resultado.setHours(config.fim, 0, 0, 0);
        }
        return resultado;
    }

    if (!config.diasUteis.includes(resultado.getDay())) {
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay())) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    return resultado;
}

/**
 * Calcula horas úteis entre duas datas considerando horário comercial
 */
function calcularHorasUteis(
    dataInicio: Date,
    dataFim: Date,
    config: HorarioComercial = HORARIO_COMERCIAL
): number {
    if (dataInicio >= dataFim) {
        return 0;
    }

    const dataFimEfetiva = normalizarDataFim(dataFim, config);

    if (dataInicio >= dataFimEfetiva) {
        return 0;
    }

    let horasUteis = 0;
    const atual = new Date(dataInicio);

    if (atual.getHours() < config.inicio) {
        atual.setHours(config.inicio, 0, 0, 0);
    } else if (atual.getHours() >= config.fim) {
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);
    }

    while (atual < dataFimEfetiva) {
        const diaAtual = atual.getDay();

        if (config.diasUteis.includes(diaAtual)) {
            const inicioExpediente = new Date(atual);
            inicioExpediente.setHours(config.inicio, 0, 0, 0);

            const fimExpediente = new Date(atual);
            fimExpediente.setHours(config.fim, 0, 0, 0);

            const inicioReal = atual < inicioExpediente ? inicioExpediente : atual;
            const fimReal = dataFimEfetiva < fimExpediente ? dataFimEfetiva : fimExpediente;

            if (inicioReal < fimReal) {
                const horasNesteDia = (fimReal.getTime() - inicioReal.getTime()) / (1000 * 60 * 60);
                horasUteis += horasNesteDia;
            }
        }

        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);

        if (atual >= dataFimEfetiva) {
            break;
        }
    }

    return Math.round(horasUteis * 10000) / 10000;
}

/**
 * Parse da hora do chamado (formato "1401" ou "HH:MM")
 */
function parseHoraChamado(horaChamado: string): { horas: number; minutos: number } {
    const horaLimpa = (horaChamado || '').trim();

    if (!horaLimpa) {
        return { horas: 0, minutos: 0 };
    }

    if (horaLimpa.includes(':')) {
        const [horas, minutos] = horaLimpa.split(':').map(Number);
        return { horas: horas || 0, minutos: minutos || 0 };
    }

    if (horaLimpa.length === 4) {
        const horas = parseInt(horaLimpa.substring(0, 2), 10);
        const minutos = parseInt(horaLimpa.substring(2, 4), 10);
        return { horas, minutos };
    }

    if (horaLimpa.length === 3) {
        const horas = parseInt(horaLimpa.substring(0, 1), 10);
        const minutos = parseInt(horaLimpa.substring(1, 3), 10);
        return { horas, minutos };
    }

    if (horaLimpa.length === 2) {
        const horas = parseInt(horaLimpa, 10);
        return { horas, minutos: 0 };
    }

    const horaNum = parseInt(horaLimpa, 10);
    if (!isNaN(horaNum)) {
        const horas = Math.floor(horaNum / 100);
        const minutos = horaNum % 100;
        return { horas, minutos };
    }

    return { horas: 0, minutos: 0 };
}

/**
 * Calcula o SLA de um chamado (réplica exata da função do sla-utils.ts)
 */
function calcularSLA(
    dataChamado: Date | string,
    horaChamado: string,
    prioridade: number,
    statusChamado: string,
    dataInicioAtendimento?: Date | string | null
): {
    tempoDecorrido: number;
    percentual: number;
    status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO';
} | null {
    if (!dataInicioAtendimento) {
        return null;
    }

    const prazoTotal = PRAZOS_SLA[prioridade] || PRAZOS_SLA[100];

    // Parse da hora do chamado
    const { horas, minutos } = parseHoraChamado(horaChamado);

    // Cria data/hora de abertura
    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas, minutos, 0, 0);

    // Data de referência (início do atendimento ou agora)
    const dataReferencia = new Date(dataInicioAtendimento);

    // Calcula horas úteis
    const tempoDecorrido = calcularHorasUteis(dataAbertura, dataReferencia);
    const percentualUsado = Math.min(100, (tempoDecorrido / prazoTotal) * 100);

    // Define status
    let status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO';
    if (percentualUsado >= 100) {
        status = 'VENCIDO';
    } else if (percentualUsado >= 90) {
        status = 'CRITICO';
    } else if (percentualUsado >= 75) {
        status = 'ALERTA';
    } else {
        status = 'OK';
    }

    return {
        tempoDecorrido: Math.round(tempoDecorrido * 10000) / 10000,
        percentual: Math.round(percentualUsado * 10) / 10,
        status,
    };
}

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
 * Formata horas decimais para o formato "Xh:Ymin"
 * @param horas - Valor em horas (exemplo: 1.5 = 1h:30min)
 * @returns String formatada (exemplo: "1h:30min")
 */
function formatarTempoHorasMinutos(horas: number): string {
    const horasInteiras = Math.floor(horas);
    const minutos = Math.round((horas - horasInteiras) * 60);

    if (horasInteiras === 0 && minutos === 0) {
        return '0min';
    }

    if (horasInteiras === 0) {
        return `${minutos}min`;
    }

    if (minutos === 0) {
        return `${horasInteiras}h`;
    }

    return `${horasInteiras}h:${minutos}min`;
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
 * Gera a aba de CHAMADOS com as novas colunas
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
    ws.mergeCells('A1:M1');
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
    ws.mergeCells('A2:M2');
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

    // ===== PERÍODO (CONDICIONAL) =====
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
            ws.mergeCells(`A${row}:M${row}`);
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
    ws.mergeCells(`A${row}:M${row}`);
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
        'ENTRADA',
        'ATRIBUIÇÃO',
        'INÍCIO',
        'SLA',
        'FINALIZAÇÃO',
        'STATUS',
        'ASSUNTO',
        'EMAIL',
        'CLASSIFICAÇÃO',
        'CONSULTOR(A)',
        'PRIOR.',
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

    // ===== DADOS DOS CHAMADOS =====
    data.forEach((coluna) => {
        // Formatar DTENVIO_CHAMADO (formato: "dd/mm/yyyy - hh:mm")
        const dtenvio = coluna.DTENVIO_CHAMADO || '---';

        // Formatar DTINI_CHAMADO
        let dtini = '---';
        if (coluna.DTINI_CHAMADO) {
            const value = coluna.DTINI_CHAMADO;
            const separator = value.includes('T') ? 'T' : ' ';
            const [dataStr, horaStr] = value.split(separator);
            if (dataStr && horaStr) {
                dtini = formatarDataHoraChamado(dataStr, horaStr);
            } else {
                dtini = formatarDataParaBR(dataStr || value);
            }
        }

        // Calcular e formatar SLA dinamicamente
        let slaText = '---';
        let slaColor: string | null = null;

        if (coluna.DTINI_CHAMADO) {
            const slaCalculado = calcularSLA(
                coluna.DATA_CHAMADO,
                coluna.HORA_CHAMADO,
                coluna.PRIOR_CHAMADO,
                coluna.STATUS_CHAMADO,
                coluna.DTINI_CHAMADO
            );

            if (slaCalculado) {
                slaText = formatarTempoHorasMinutos(slaCalculado.tempoDecorrido);

                // Determinar cor baseado no status
                const statusColors = {
                    OK: 'FF22C55E', // Verde
                    ALERTA: 'FFEAB308', // Amarelo
                    CRITICO: 'FFF97316', // Laranja
                    VENCIDO: 'FFEF4444', // Vermelho
                };

                slaColor = statusColors[slaCalculado.status];
            }
        }

        // Formatar FINALIZAÇÃO
        let finalizacao = '---';
        if (
            coluna.STATUS_CHAMADO?.toUpperCase() === 'FINALIZADO' &&
            coluna.DATA_HISTCHAMADO &&
            coluna.HORA_HISTCHAMADO
        ) {
            finalizacao = formatarDataHoraChamado(coluna.DATA_HISTCHAMADO, coluna.HORA_HISTCHAMADO);
        }

        const dados = [
            formatarNumeros(coluna.COD_CHAMADO),
            formatarDataHoraChamado(coluna.DATA_CHAMADO, coluna.HORA_CHAMADO),
            dtenvio,
            dtini,
            slaText,
            finalizacao,
            coluna.STATUS_CHAMADO,
            corrigirTextoCorrompido(coluna.ASSUNTO_CHAMADO).substring(0, 50),
            coluna.EMAIL_CHAMADO || '---',
            corrigirTextoCorrompido(coluna.NOME_CLASSIFICACAO).substring(0, 25),
            renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(coluna.NOME_RECURSO) || '---'),
            `P-${coluna.PRIOR_CHAMADO}`,
            formatarHorasTotaisSufixo(coluna.TOTAL_HORAS_OS),
        ];

        dados.forEach((val, i) => {
            const cell = ws.getCell(row, i + 1);
            cell.value = val;
            cell.alignment = {
                horizontal: [0, 1, 2, 3, 4, 5, 11, 12].includes(i) ? 'center' : 'left',
                vertical: 'middle',
                indent: [6, 7, 8, 9, 10].includes(i) ? 1 : 0,
            };

            // Colorir coluna do SLA baseado no status
            if (i === 4 && slaColor && slaText !== '---') {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: slaColor },
                };
            }

            if (i === 0) cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
            aplicarBordas(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    });

    // ===== CONFIGURAR LARGURAS DAS COLUNAS =====
    ws.columns = [
        { width: 15 }, // CHAMADO
        { width: 20 }, // ENTRADA
        { width: 20 }, // ATRIBUIÇÃO
        { width: 20 }, // INÍCIO
        { width: 18 }, // SLA (aumentado para comportar "Xh:Ymin")
        { width: 20 }, // FINALIZAÇÃO
        { width: 30 }, // STATUS
        { width: 50 }, // ASSUNTO
        { width: 30 }, // EMAIL
        { width: 30 }, // CLASSIFICAÇÃO
        { width: 25 }, // CONSULTOR
        { width: 12 }, // PRIORIDADE
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

    // ===== PERÍODO (CONDICIONAL) =====
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
                        indent: [6, 7].includes(i) ? 1 : 0,
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
