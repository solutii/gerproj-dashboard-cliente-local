'use client';

import { formatarDataParaBR } from '@/formatters/formatar-data';
import {
  formatarHora,
  formatarHorasTotaisSufixo,
} from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { renderizarDoisPrimeirosNomes } from '@/formatters/remover-acentuacao';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState } from 'react';
import { FaFilePdf } from 'react-icons/fa';
import type { ChamadoRowProps } from './Colunas_Tabela_Chamados';
import type { OSRowProps } from './Colunas_Tabela_OS';

// ================================================================================
// INTERFACES E TIPOS
// ================================================================================
interface FiltrosRelatorio {
  ano: string;
  mes: string;
  cliente?: string;
  recurso?: string;
  status?: string;
  totalChamados?: number;
  totalOS?: number;
  totalHorasOS?: number;
}

interface ExportaPDFChamadosButtonProps {
  data: ChamadoRowProps[];
  filtros?: FiltrosRelatorio;
  isAdmin: boolean;
  codCliente?: string | null;
  className?: string;
  disabled?: boolean;
}

// ================================================================================
// FUNÇÕES AUXILIARES
// ================================================================================
async function fetchOSByChamado(
  codChamado: number,
  isAdmin: boolean,
  codCliente?: string | null,
  mes?: string,
  ano?: string,
): Promise<OSRowProps[]> {
  try {
    const params = new URLSearchParams({ isAdmin: String(isAdmin) });

    if (!isAdmin && codCliente) {
      params.append('codCliente', codCliente);
    }

    if (mes) params.append('mes', mes);
    if (ano) params.append('ano', ano);

    const response = await fetch(
      `/api/chamados/${codChamado}/os?${params.toString()}`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.success && data.data ? data.data : [];
  } catch (error) {
    console.error(`Erro ao buscar OS's do chamado ${codChamado}:`, error);
    return [];
  }
}

async function fetchAllOS(
  chamados: ChamadoRowProps[],
  isAdmin: boolean,
  codCliente?: string | null,
  mes?: string,
  ano?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<number, OSRowProps[]>> {
  const osMap = new Map<number, OSRowProps[]>();
  const chamadosComOS = chamados.filter((c) => c.TEM_OS);

  if (chamadosComOS.length === 0) return osMap;

  const BATCH_SIZE = 5;
  for (let i = 0; i < chamadosComOS.length; i += BATCH_SIZE) {
    const batch = chamadosComOS.slice(i, i + BATCH_SIZE);
    if (onProgress) onProgress(i, chamadosComOS.length);

    const promises = batch.map((chamado) =>
      fetchOSByChamado(chamado.COD_CHAMADO, isAdmin, codCliente, mes, ano).then(
        (osList) => ({ codChamado: chamado.COD_CHAMADO, osList }),
      ),
    );

    const results = await Promise.all(promises);
    results.forEach(({ codChamado, osList }) => {
      if (osList.length > 0) osMap.set(codChamado, osList);
    });
  }

  if (onProgress) onProgress(chamadosComOS.length, chamadosComOS.length);
  return osMap;
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-6 w-6 text-white"
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
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

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

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ExportaPDFChamadosButton({
  data,
  filtros,
  isAdmin,
  codCliente,
  className = '',
  disabled = false,
}: ExportaPDFChamadosButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!data || data.length === 0) disabled = true;

  const exportToPDF = async () => {
    setIsExporting(true);
    setProgress({ current: 0, total: 0 });

    try {
      const osData = await fetchAllOS(
        data,
        isAdmin,
        codCliente,
        filtros?.mes,
        filtros?.ano,
        (current, total) => setProgress({ current, total }),
      );

      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 15;

      const nomeMes = filtros?.mes ? obterNomeMes(filtros.mes) : 'TODOS';
      const ano = filtros?.ano || new Date().getFullYear();

      // ====== PÁGINA 1: CHAMADOS ======

      // Título
      doc.setFillColor(107, 33, 168); // #6B21A8
      doc.rect(10, yPos, pageWidth - 20, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE CHAMADOS', pageWidth / 2, yPos + 8, {
        align: 'center',
      });
      yPos += 15;

      // Data de geração
      doc.setFillColor(107, 33, 168);
      doc.rect(10, yPos, pageWidth - 20, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        pageWidth / 2,
        yPos + 5.5,
        { align: 'center' },
      );
      yPos += 12;

      // Período
      doc.setFillColor(107, 33, 168);
      doc.rect(10, yPos, pageWidth - 20, 10, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`PERÍODO: ${nomeMes}/${ano}`, pageWidth / 2, yPos + 7, {
        align: 'center',
      });
      yPos += 14;

      // Totalizadores
      const boxWidth = (pageWidth - 40) / 3;
      const totais = [
        {
          label: 'TOTAL CHAMADOS',
          value: String(filtros?.totalChamados ?? data.length),
          color: [107, 33, 168],
        },
        {
          label: "TOTAL OS's",
          value: String(filtros?.totalOS ?? 0),
          color: [8, 145, 178],
        },
        {
          label: 'TOTAL HORAS',
          value: formatarHorasTotaisSufixo(filtros?.totalHorasOS ?? 0),
          color: [5, 150, 105],
        },
      ];

      totais.forEach((total, idx) => {
        const xPos = 10 + idx * boxWidth + idx * 5;

        // Label
        doc.setFillColor(total.color[0], total.color[1], total.color[2]);
        doc.rect(xPos, yPos, boxWidth, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(total.label, xPos + boxWidth / 2, yPos + 4.5, {
          align: 'center',
        });

        // Valor
        doc.setFillColor(240, 240, 240);
        doc.rect(xPos, yPos + 6, boxWidth, 6, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(total.value, xPos + boxWidth / 2, yPos + 10.5, {
          align: 'center',
        });
      });
      yPos += 16;

      const chamadosSemOS = data.filter((c) => !c.TEM_OS);
      const chamadosComOS = data.filter((c) => c.TEM_OS);

      // Função para adicionar seção de chamados
      const addChamadosSection = (
        titulo: string,
        chamados: ChamadoRowProps[],
      ) => {
        if (chamados.length === 0) return;

        // Verificar se precisa de nova página
        if (yPos > 160) {
          doc.addPage();
          yPos = 15;
        }

        // Título da seção
        doc.setFillColor(107, 33, 168);
        doc.rect(10, yPos, pageWidth - 20, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(titulo, pageWidth / 2, yPos + 5.5, { align: 'center' });
        yPos += 10;

        // Tabela de chamados
        const tableData = chamados.map((c) => [
          formatarNumeros(c.COD_CHAMADO),
          formatarDataParaBR(c.DATA_CHAMADO),
          `P-${c.PRIOR_CHAMADO}`,
          corrigirTextoCorrompido(c.ASSUNTO_CHAMADO).substring(0, 40),
          corrigirTextoCorrompido(c.NOME_CLASSIFICACAO).substring(0, 25),
          renderizarDoisPrimeirosNomes(
            corrigirTextoCorrompido(c.NOME_RECURSO) || '---',
          ),
          c.STATUS_CHAMADO,
          formatarHorasTotaisSufixo(c.TOTAL_HORAS_OS),
        ]);

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
            fillColor: [15, 118, 110], // #0F766E
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
            0: {
              halign: 'center',
              fontStyle: 'bold',
              textColor: [107, 33, 168],
            },
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

        yPos = (doc as any).lastAutoTable.finalY + 10;
      };

      addChamadosSection("CHAMADOS SEM OS's", chamadosSemOS);
      addChamadosSection("CHAMADOS COM OS's", chamadosComOS);

      // ====== PÁGINA 2: ORDENS DE SERVIÇO ======
      if (chamadosComOS.length > 0 && osData.size > 0) {
        doc.addPage();
        yPos = 15;

        // Título
        doc.setFillColor(8, 145, 178); // #0891B2
        doc.rect(10, yPos, pageWidth - 20, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO DE ORDENS DE SERVIÇO', pageWidth / 2, yPos + 8, {
          align: 'center',
        });
        yPos += 15;

        // Data de geração
        doc.setFillColor(8, 145, 178);
        doc.rect(10, yPos, pageWidth - 20, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
          pageWidth / 2,
          yPos + 5.5,
          { align: 'center' },
        );
        yPos += 12;

        // Período
        doc.setFillColor(8, 145, 178);
        doc.rect(10, yPos, pageWidth - 20, 10, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`PERÍODO: ${nomeMes}/${ano}`, pageWidth / 2, yPos + 7, {
          align: 'center',
        });
        yPos += 14;

        // Tabela de OS's
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
              corrigirTextoCorrompido(os.OBS || '---'), // Removido o .substring(0, 35)
              renderizarDoisPrimeirosNomes(
                corrigirTextoCorrompido(os.NOME_RECURSO) || '---',
              ),
              os.VALCLI_OS || '---',
            ]);
          });
        });

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
            fillColor: [20, 184, 166], // #14B8A6
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
            0: {
              halign: 'center',
              fontStyle: 'bold',
              textColor: [107, 33, 168],
            },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'left', cellWidth: 35 }, // Largura fixa de 35mm, igual ao original
            7: { halign: 'left' },
            8: { halign: 'center', fontStyle: 'bold' },
          },
          didParseCell: (data: any) => {
            if (data.column.index === 8 && data.section === 'body') {
              const val = data.cell.text[0];
              if (val === 'SIM' || val === 'Sim') {
                data.cell.styles.fillColor = [59, 130, 246]; // Azul
                data.cell.styles.textColor = [255, 255, 255];
              } else if (
                val === 'NÃO' ||
                val === 'Não' ||
                val === 'NAO' ||
                val === 'Nao'
              ) {
                data.cell.styles.fillColor = [239, 68, 68]; // Vermelho
                data.cell.styles.textColor = [255, 255, 255];
              }
            }
          },
          margin: { left: 10, right: 10 },
        });
      }

      // Salvar PDF
      const timestamp = new Date().getTime();
      const nomeArquivo = `Relatorio_Chamados_${filtros?.mes || 'todos'}_${filtros?.ano || new Date().getFullYear()}_${timestamp}.pdf`;
      doc.save(nomeArquivo);
    } catch (error) {
      console.error('[PDF] ❌ Erro ao exportar PDF:', error);
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
      className={`group cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 p-3 shadow-md shadow-black transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${className}`}
    >
      {isExporting ? (
        <div className="flex flex-col items-center gap-1">
          <LoadingSpinner />
          {progress.total > 0 && (
            <span className="text-xs text-white font-bold">
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
