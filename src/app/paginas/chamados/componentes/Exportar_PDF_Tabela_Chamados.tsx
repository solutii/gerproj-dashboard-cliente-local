// src/app/paginas/chamados/componentes/Exporta_PDF_Chamados.tsx

'use client';

import type { ChamadoRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados';
import type { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataHoraChamado, formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { renderizarDoisPrimeirosNomes } from '@/formatters/remover-acentuacao';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState } from 'react';
import { FaFilePdf } from 'react-icons/fa';

// ================================================================================
// INTERFACES E TIPOS
// ================================================================================
interface FiltrosRelatorio {
    ano?: string;
    mes?: string;
    cliente?: string;
    recurso?: string;
    status?: string;
}

interface ExportarPDFTabelaChamadosButtonProps {
    data: ChamadoRowProps[];
    filtros?: FiltrosRelatorio;
    isAdmin: boolean;
    codCliente?: string | null;
    className?: string;
    disabled?: boolean;
}

// ================================================================================
// FUNÇÕES DE CÁLCULO DE SLA (RÉPLICA DO EXCEL)
// ================================================================================

interface HorarioComercial {
    inicio: number;
    fim: number;
    diasUteis: number[];
}

const HORARIO_COMERCIAL: HorarioComercial = {
    inicio: 8,
    fim: 18,
    diasUteis: [1, 2, 3, 4, 5],
};

const PRAZOS_SLA: Record<number, number> = {
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    100: 8,
};

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

    const { horas, minutos } = parseHoraChamado(horaChamado);

    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas, minutos, 0, 0);

    const dataReferencia = new Date(dataInicioAtendimento);

    const tempoDecorrido = calcularHorasUteis(dataAbertura, dataReferencia);
    const percentualUsado = Math.min(100, (tempoDecorrido / prazoTotal) * 100);

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

// ================================================================================
// FUNÇÕES AUXILIARES - OTIMIZADAS
// ================================================================================

/**
 * Busca OS de um chamado específico
 */
async function fetchOSByChamado(
    codChamado: number,
    isAdmin: boolean,
    codCliente?: string | null
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
            fetchOSByChamado(chamado.COD_CHAMADO, isAdmin, codCliente).then((osList) => ({
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
 * Spinner de loading
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
 * Adiciona cabeçalho comum ao PDF
 */
function adicionarCabecalhoPDF(
    doc: jsPDF,
    titulo: string,
    cor: [number, number, number],
    filtros?: FiltrosRelatorio
): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Título
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.rect(10, yPos, pageWidth - 20, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, pageWidth / 2, yPos + 8, { align: 'center' });
    yPos += 15;

    // Data de geração
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.rect(10, yPos, pageWidth - 20, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos + 5.5, {
        align: 'center',
    });
    yPos += 12;

    // PERÍODO (CONDICIONAL)
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
            doc.setFillColor(cor[0], cor[1], cor[2]);
            doc.rect(10, yPos, pageWidth - 20, 10, 'F');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(textoPeriodo, pageWidth / 2, yPos + 7, { align: 'center' });
            yPos += 14;
        }
    }

    return yPos;
}

/**
 * Adiciona seção de chamados ao PDF com TODAS as novas colunas
 */
function adicionarSecaoChamados(doc: jsPDF, yPos: number, chamados: ChamadoRowProps[]): number {
    if (chamados.length === 0) return yPos;

    const pageWidth = doc.internal.pageSize.getWidth();

    // Verificar se precisa de nova página
    if (yPos > 160) {
        doc.addPage();
        yPos = 15;
    }

    // LINHA SEPARADORA + TOTAL
    doc.setDrawColor(107, 33, 168);
    doc.setLineWidth(0.5);
    doc.line(10, yPos, pageWidth - 10, yPos);
    yPos += 2;

    // Total de chamados
    doc.setFillColor(107, 33, 168);
    doc.rect(10, yPos, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`CHAMADOS — TOTAL: ${chamados.length}`, pageWidth / 2, yPos + 5.5, {
        align: 'center',
    });
    yPos += 10;

    // Preparar dados da tabela com TODAS as colunas
    const tableData = chamados.map((c) => {
        // Formatar DTINI_CHAMADO
        let dtini = '---';
        if (c.DTINI_CHAMADO) {
            const value = c.DTINI_CHAMADO;
            const separator = value.includes('T') ? 'T' : ' ';
            const [dataStr, horaStr] = value.split(separator);
            if (dataStr && horaStr) {
                dtini = formatarDataHoraChamado(dataStr, horaStr);
            } else {
                dtini = formatarDataParaBR(dataStr || value);
            }
        }

        // Calcular SLA
        let slaText = '---';
        if (c.DTINI_CHAMADO) {
            const slaCalculado = calcularSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO,
                c.PRIOR_CHAMADO,
                c.STATUS_CHAMADO,
                c.DTINI_CHAMADO
            );

            if (slaCalculado) {
                slaText = formatarTempoHorasMinutos(slaCalculado.tempoDecorrido);
            }
        }

        // Formatar FINALIZAÇÃO
        let finalizacao = '---';
        if (
            c.STATUS_CHAMADO?.toUpperCase() === 'FINALIZADO' &&
            c.DATA_HISTCHAMADO &&
            c.HORA_HISTCHAMADO
        ) {
            finalizacao = formatarDataHoraChamado(c.DATA_HISTCHAMADO, c.HORA_HISTCHAMADO);
        }

        return [
            formatarNumeros(c.COD_CHAMADO),
            formatarDataHoraChamado(c.DATA_CHAMADO, c.HORA_CHAMADO),
            c.DTENVIO_CHAMADO || '---',
            dtini,
            slaText,
            finalizacao,
            c.STATUS_CHAMADO,
            corrigirTextoCorrompido(c.ASSUNTO_CHAMADO),
            c.EMAIL_CHAMADO || '---',
            corrigirTextoCorrompido(c.NOME_CLASSIFICACAO).substring(0, 20),
            renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(c.NOME_RECURSO) || '---'),
            `P-${c.PRIOR_CHAMADO}`,
            formatarHorasTotaisSufixo(c.TOTAL_HORAS_OS),
        ];
    });

    // Criar tabela com TODAS as colunas
    autoTable(doc, {
        startY: yPos,
        head: [
            [
                'Chamado',
                'Entrada',
                'Atribuição',
                'Início',
                'SLA',
                'Finalização',
                'Status',
                'Assunto',
                'Email',
                'Classificação',
                'Consultor',
                'Prior.',
                'Horas',
            ],
        ],
        body: tableData,
        theme: 'grid',
        tableWidth: 'auto',
        headStyles: {
            fillColor: [15, 118, 110],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 6,
            cellPadding: 1.5,
            minCellHeight: 5,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 }, // Chamado
            1: { halign: 'center', cellWidth: 25 }, // Entrada
            2: { halign: 'center', cellWidth: 25 }, // Atribuição
            3: { halign: 'center', cellWidth: 25 }, // Início
            4: { halign: 'center', cellWidth: 15 }, // SLA
            5: { halign: 'center', cellWidth: 25 }, // Finalização
            6: { halign: 'left', cellWidth: 18 }, // Status
            7: { halign: 'left', cellWidth: 'auto' }, // Assunto - expansível
            8: { halign: 'left', cellWidth: 'auto' }, // Email - expansível
            9: { halign: 'left', cellWidth: 25 }, // Classificação
            10: { halign: 'left', cellWidth: 20 }, // Consultor
            11: { halign: 'center', cellWidth: 10 }, // Prior.
            12: { halign: 'center', cellWidth: 12 }, // Horas
        },
        didParseCell: (data: any) => {
            // Colorir coluna SLA (índice 4)
            if (data.column.index === 4 && data.section === 'body') {
                const slaText = data.cell.text[0];
                if (slaText !== '---') {
                    // Pegar o chamado correspondente para calcular cor
                    const chamado = chamados[data.row.index];
                    if (chamado && chamado.DTINI_CHAMADO) {
                        const slaCalculado = calcularSLA(
                            chamado.DATA_CHAMADO,
                            chamado.HORA_CHAMADO,
                            chamado.PRIOR_CHAMADO,
                            chamado.STATUS_CHAMADO,
                            chamado.DTINI_CHAMADO
                        );

                        if (slaCalculado) {
                            const statusColors = {
                                OK: [34, 197, 94], // Verde
                                ALERTA: [234, 179, 8], // Amarelo
                                CRITICO: [249, 115, 22], // Laranja
                                VENCIDO: [239, 68, 68], // Vermelho
                            };

                            data.cell.styles.fillColor = statusColors[slaCalculado.status];
                            data.cell.styles.textColor = [255, 255, 255];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            }
        },
        margin: { left: 10, right: 10 },
    });

    return (doc as any).lastAutoTable.finalY + 10;
}

/**
 * Gera página de chamados no PDF
 */
function gerarPaginaChamados(
    doc: jsPDF,
    data: ChamadoRowProps[],
    filtros?: FiltrosRelatorio
): void {
    let yPos = adicionarCabecalhoPDF(doc, 'RELATÓRIO DE CHAMADOS', [107, 33, 168], filtros);
    yPos = adicionarSecaoChamados(doc, yPos, data);
}

/**
 * Gera página de Ordens de Serviço no PDF
 */
function gerarPaginaOS(
    doc: jsPDF,
    data: ChamadoRowProps[],
    osData: Map<number, OSRowProps[]>,
    filtros?: FiltrosRelatorio
): void {
    const chamadosComOS = data.filter((c) => c.TEM_OS);

    if (chamadosComOS.length === 0 || osData.size === 0) return;

    doc.addPage();

    let yPos = adicionarCabecalhoPDF(doc, 'RELATÓRIO DE ORDENS DE SERVIÇO', [8, 145, 178], filtros);

    const osTableData: any[] = [];
    chamadosComOS.forEach((chamado) => {
        const osList = osData.get(chamado.COD_CHAMADO);
        if (!osList || osList.length === 0) return;

        osList.forEach((os) => {
            osTableData.push([
                formatarNumeros(chamado.COD_CHAMADO),
                formatarNumeros(os.NUM_OS) || '---',
                formatarDataParaBR(os.DTINI_OS),
                formatarHora(os.HRINI_OS),
                formatarHora(os.HRFIM_OS),
                formatarHorasTotaisSufixo(os.TOTAL_HORAS_OS),
                corrigirTextoCorrompido(os.OBS || '---'),
                renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(os.NOME_RECURSO) || '---'),
                os.VALCLI_OS || '---',
            ]);
        });
    });

    if (osTableData.length === 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.text(
            'Nenhuma Ordem de Serviço encontrada nos chamados exibidos',
            doc.internal.pageSize.getWidth() / 2,
            yPos + 20,
            { align: 'center' }
        );
        return;
    }

    autoTable(doc, {
        startY: yPos,
        head: [
            [
                'Chamado',
                'Nº OS',
                'Data',
                'Início',
                'Fim',
                'Horas',
                'Descrição',
                'Consultor',
                'Valid.',
            ],
        ],
        body: osTableData,
        theme: 'grid',
        headStyles: {
            fillColor: [20, 184, 166],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: 2,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'left' },
            7: { halign: 'left' },
            8: { halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
            if (data.column.index === 8 && data.section === 'body') {
                const val = data.cell.text[0];
                if (val === 'SIM' || val === 'Sim') {
                    data.cell.styles.fillColor = [59, 130, 246];
                    data.cell.styles.textColor = [255, 255, 255];
                } else if (val === 'NÃO' || val === 'Não' || val === 'NAO' || val === 'Nao') {
                    data.cell.styles.fillColor = [239, 68, 68];
                    data.cell.styles.textColor = [255, 255, 255];
                }
            }
        },
        margin: { left: 10, right: 10 },
    });
}

/**
 * Componente principal de exportação para PDF
 */
export function ExportarPDFTabelaChamados({
    data,
    filtros,
    isAdmin,
    codCliente,
    className = '',
    disabled = false,
}: ExportarPDFTabelaChamadosButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    if (!data || data.length === 0) disabled = true;

    const exportToPDF = async () => {
        setIsExporting(true);
        setProgress({ current: 0, total: 0 });

        try {
            console.log('🔍 Iniciando busca de OS para PDF...');
            const startTime = performance.now();

            const osData = await fetchAllOS(data, isAdmin, codCliente, (current, total) => {
                setProgress({ current, total });
            });

            const fetchTime = performance.now() - startTime;
            console.log(`✅ OS's buscadas em ${(fetchTime / 1000).toFixed(2)}s`);

            console.log('📄 Criando documento PDF...');
            const doc = new jsPDF('landscape', 'mm', 'a4');

            console.log('📊 Gerando página de chamados...');
            gerarPaginaChamados(doc, data, filtros);

            console.log('📋 Gerando página de OS...');
            gerarPaginaOS(doc, data, osData, filtros);

            console.log('💾 Salvando arquivo PDF...');
            const timestamp = new Date().getTime();
            const nomeArquivo = `Relatorio_Chamados_${filtros?.mes || 'todos'}_${filtros?.ano || new Date().getFullYear()}_${timestamp}.pdf`;

            doc.save(nomeArquivo);

            const totalTime = performance.now() - startTime;
            console.log(`✅ PDF gerado com sucesso em ${(totalTime / 1000).toFixed(2)}s`);
        } catch (error) {
            console.error('❌ Erro ao exportar PDF:', error);
            alert('Erro ao gerar o PDF. Tente novamente.');
        } finally {
            setIsExporting(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <button
            onClick={exportToPDF}
            disabled={isExporting || disabled}
            title={
                disabled
                    ? 'Não há dados para exportar'
                    : isExporting
                      ? progress.total > 0
                          ? `Buscando OS's: ${progress.current}/${progress.total}`
                          : 'Gerando PDF...'
                      : 'Exportar para PDF'
            }
            className={`group cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 p-3 shadow-md shadow-black transition-all duration-200 hover:scale-115 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
                <FaFilePdf
                    className="text-white group-hover:scale-110 group-active:scale-95"
                    size={24}
                />
            )}
        </button>
    );
}
