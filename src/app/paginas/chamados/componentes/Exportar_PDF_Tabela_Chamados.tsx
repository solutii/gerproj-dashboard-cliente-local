// src/app/paginas/chamados/componentes/Exporta_PDF_Chamados.tsx

'use client';

import type { ChamadoRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados';
import type { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataParaBR } from '@/formatters/formatar-data';
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

    // ✅ PERÍODO (CONDICIONAL) - Só mostra se houver mês OU ano válidos
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
 * Adiciona seção de chamados ao PDF (versão simplificada)
 */
function adicionarSecaoChamados(doc: jsPDF, yPos: number, chamados: ChamadoRowProps[]): number {
    if (chamados.length === 0) return yPos;

    const pageWidth = doc.internal.pageSize.getWidth();

    // Verificar se precisa de nova página
    if (yPos > 160) {
        doc.addPage();
        yPos = 15;
    }

    // ✅ LINHA SEPARADORA + TOTAL
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

    // Preparar dados da tabela
    const tableData = chamados.map((c) => [
        formatarNumeros(c.COD_CHAMADO),
        formatarDataParaBR(c.DATA_CHAMADO),
        `P-${c.PRIOR_CHAMADO}`,
        corrigirTextoCorrompido(c.ASSUNTO_CHAMADO).substring(0, 40),
        corrigirTextoCorrompido(c.NOME_CLASSIFICACAO).substring(0, 25),
        renderizarDoisPrimeirosNomes(corrigirTextoCorrompido(c.NOME_RECURSO) || '---'),
        c.STATUS_CHAMADO,
        formatarHorasTotaisSufixo(c.TOTAL_HORAS_OS),
    ]);

    // Criar tabela
    autoTable(doc, {
        startY: yPos,
        head: [
            [
                'Chamado',
                'Data',
                'Prior.',
                'Assunto',
                'Classificação',
                'Consultor(a)',
                'Status',
                'Horas',
            ],
        ],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [15, 118, 110],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: 2,
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', textColor: [107, 33, 168] },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'left' },
            4: { halign: 'left' },
            5: { halign: 'left' },
            6: { halign: 'center' },
            7: { halign: 'center' },
        },
        margin: { left: 10, right: 10 },
    });

    return (doc as any).lastAutoTable.finalY + 10;
}

/**
 * Gera página de chamados no PDF (versão simplificada)
 */
function gerarPaginaChamados(
    doc: jsPDF,
    data: ChamadoRowProps[],
    filtros?: FiltrosRelatorio
): void {
    // Adicionar cabeçalho
    let yPos = adicionarCabecalhoPDF(doc, 'RELATÓRIO DE CHAMADOS', [107, 33, 168], filtros);

    // ✅ Adicionar seção única de chamados
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

    // Adicionar cabeçalho
    let yPos = adicionarCabecalhoPDF(doc, 'RELATÓRIO DE ORDENS DE SERVIÇO', [8, 145, 178], filtros);

    // Preparar dados da tabela de OS
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

    // Criar tabela de OS
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
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', textColor: [107, 33, 168] },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'left', cellWidth: 35 },
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
