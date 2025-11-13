'use client';

// IMPORTS
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState } from 'react';

// ICONS
import { RiFileExcel2Fill } from 'react-icons/ri';

// ================================================================================
// INTERFACES
// ================================================================================
interface TableRowProps {
  chamado_os: string;
  cod_os: number;
  nome_cliente: string;
  nome_recurso?: string;
  dtini_os: string;
  status_chamado: string;
  hrini_os: string;
  hrfim_os: string;
  total_horas: string;
  valcli_os: string;
  obs: string;
}

interface FiltrosRelatorio {
  ano: string;
  mes: string;
  cliente?: string;
  recurso?: string;
  status?: string;
}

interface ExportaExcelButtonProps {
  data: TableRowProps[];
  filtros?: FiltrosRelatorio;
  filename?: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean; // ← ADICIONAR
}

// ================================================================================
// FUNÇÕES AUXILIARES
// ================================================================================
function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

function formatarDataParaBR(data: string): string {
  if (!data) return 'n/a';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ================================================================================
// COMPONENTE
// ================================================================================
export function ExportaExcelButton({
  data,
  filtros,
  buttonText = '',
  className = '',
  disabled = false, // ← ADICIONAR
}: ExportaExcelButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async () => {
    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Chamados');
      worksheet.views = [{ showGridLines: false }];

      let currentRow = 1;

      // ================================================================================
      // CABEÇALHO DO RELATÓRIO
      // ================================================================================
      const numColunas = 11; // Todas as colunas incluídas
      const ultimaColuna = getColumnLetter(numColunas - 1);

      worksheet.mergeCells(`A${currentRow}:${ultimaColuna}${currentRow}`);
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = 'RELATÓRIO DE CHAMADOS E ORDENS DE SERVIÇO';
      titleCell.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' },
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 30;
      currentRow++;

      // Data de geração
      worksheet.mergeCells(`A${currentRow}:${ultimaColuna}${currentRow}`);
      const dateCell = worksheet.getCell(`A${currentRow}`);
      dateCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      dateCell.font = {
        italic: true,
        size: 16,
        color: { argb: 'FFFFFFFF' },
      };
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' },
      };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 30;
      currentRow++;

      currentRow += 1;

      // ================================================================================
      // FILTROS APLICADOS
      // ================================================================================
      if (filtros && Object.keys(filtros).length > 0) {
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const filtrosTitleCell = worksheet.getCell(`A${currentRow}`);
        filtrosTitleCell.value = 'FILTROS APLICADOS';
        filtrosTitleCell.font = {
          bold: true,
          size: 12,
          color: { argb: 'FFFFFFFF' },
        };
        filtrosTitleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '000000' },
        };
        filtrosTitleCell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        worksheet.getRow(currentRow).height = 24;
        filtrosTitleCell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        currentRow++;

        const setBorder = (cell: any) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        };

        // Período Mês/Ano
        if (filtros.mes && filtros.ano) {
          worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
          worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
          const labelCell = worksheet.getCell(`A${currentRow}`);
          labelCell.value = 'Período:';
          labelCell.font = { bold: true };
          labelCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(labelCell);

          const mesNome = [
            '',
            'Janeiro',
            'Fevereiro',
            'Março',
            'Abril',
            'Maio',
            'Junho',
            'Julho',
            'Agosto',
            'Setembro',
            'Outubro',
            'Novembro',
            'Dezembro',
          ][parseInt(filtros.mes)];

          const valueCell = worksheet.getCell(`C${currentRow}`);
          valueCell.value = `${mesNome}/${filtros.ano}`;
          valueCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(valueCell);
          worksheet.getRow(currentRow).height = 24;
          currentRow++;
        }

        // Filtro Cliente
        if (filtros.cliente) {
          worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
          worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
          const labelCell = worksheet.getCell(`A${currentRow}`);
          labelCell.value = 'Cliente:';
          labelCell.font = { bold: true };
          labelCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(labelCell);

          const valueCell = worksheet.getCell(`C${currentRow}`);
          valueCell.value = filtros.cliente;
          valueCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(valueCell);
          worksheet.getRow(currentRow).height = 24;
          currentRow++;
        }

        // Filtro Recurso
        if (filtros.recurso) {
          worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
          worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
          const labelCell = worksheet.getCell(`A${currentRow}`);
          labelCell.value = 'Recurso:';
          labelCell.font = { bold: true };
          labelCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(labelCell);

          const valueCell = worksheet.getCell(`C${currentRow}`);
          valueCell.value = filtros.recurso;
          valueCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(valueCell);
          worksheet.getRow(currentRow).height = 24;
          currentRow++;
        }

        // Filtro Status
        if (filtros.status) {
          worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
          worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
          const labelCell = worksheet.getCell(`A${currentRow}`);
          labelCell.value = 'Status:';
          labelCell.font = { bold: true };
          labelCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(labelCell);

          const valueCell = worksheet.getCell(`C${currentRow}`);
          valueCell.value = filtros.status;
          valueCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          setBorder(valueCell);
          worksheet.getRow(currentRow).height = 24;
          currentRow++;
        }

        currentRow += 1;
      }

      // ================================================================================
      // TOTALIZADORES
      // ================================================================================
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      const totTitleCell = worksheet.getCell(`A${currentRow}`);
      totTitleCell.value = 'TOTALIZADORES';
      totTitleCell.font = {
        bold: true,
        size: 12,
        color: { argb: 'FFFFFFFF' },
      };
      totTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '000000' },
      };
      totTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 24;
      currentRow++;

      // Calcular totais
      const totalChamados = data.length;
      const totalRecursos = Array.from(
        new Set(data.map((item) => item.nome_recurso || '')),
      ).filter(Boolean).length;

      // Calcular total de horas
      let totalMs = 0;
      data.forEach((item) => {
        if (item.total_horas && item.total_horas !== '-') {
          const match = item.total_horas.match(/(\d+)h:?(\d+)/);
          if (match) {
            const horas = parseInt(match[1]);
            const minutos = parseInt(match[2]);
            totalMs += (horas * 60 + minutos) * 60 * 1000;
          }
        }
      });
      const totalMinutes = Math.floor(totalMs / (1000 * 60));
      const horas = Math.floor(totalMinutes / 60);
      const minutos = totalMinutes % 60;
      const totalHoras = `${String(horas).padStart(2, '0')}h:${String(minutos).padStart(2, '0')}min`;

      const totHeaders = [
        'Total de Chamados',
        'Total de Recursos',
        'Total de Horas',
      ];
      const totValues = [totalChamados, totalRecursos, totalHoras];
      const totColors = ['A020F0', '0000FF', '008080'];

      for (let i = 0; i < totHeaders.length; i++) {
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        const headerCell = worksheet.getCell(`A${currentRow}`);
        headerCell.value = totHeaders[i];
        headerCell.font = {
          bold: true,
          size: 12,
          color: { argb: 'FFFFFFFF' },
        };
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: totColors[i] },
        };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        headerCell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
        const valueCell = worksheet.getCell(`C${currentRow}`);
        valueCell.value = totValues[i];
        valueCell.font = { size: 12 };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
        valueCell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        if (i < 2) {
          valueCell.numFmt = '#,##0';
        }
        worksheet.getRow(currentRow).height = 24;
        currentRow++;
      }

      currentRow++;

      // ================================================================================
      // CABEÇALHOS DAS COLUNAS
      // ================================================================================
      const headers = [
        'N° OS',
        'CÓD. OS',
        'CLIENTE',
        'RECURSO',
        'DATA',
        'STATUS',
        'HORA INÍCIO',
        'HORA FIM',
        'DURAÇÃO',
        'VALIDAÇÃO',
        'OBSERVAÇÃO',
      ];

      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 24;
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
      currentRow++;

      // ================================================================================
      // DETALHES
      // ================================================================================
      data.forEach((detalhe) => {
        const rowData = [
          detalhe.chamado_os || 'n/a',
          detalhe.cod_os || null,
          detalhe.nome_cliente || 'n/a',
          detalhe.nome_recurso || 'n/a',
          formatarDataParaBR(detalhe.dtini_os) || 'n/a',
          detalhe.status_chamado || 'n/a',
          detalhe.hrini_os || 'n/a',
          detalhe.hrfim_os || 'n/a',
          detalhe.total_horas || 'n/a',
          detalhe.valcli_os || 'n/a',
          detalhe.obs || 'n/a',
        ];

        rowData.forEach((value, colIndex) => {
          const cell = worksheet.getCell(currentRow, colIndex + 1);
          cell.value = value;

          const colunasCentralizadas = [0, 1, 4, 5, 6, 7, 8, 9];
          const colunasComIndentacao = [2, 3, 10];

          cell.alignment = {
            horizontal: colunasCentralizadas.includes(colIndex)
              ? 'center'
              : 'left',
            vertical: 'middle',
            indent: colunasComIndentacao.includes(colIndex) ? 2 : 0,
            wrapText: colIndex === 10, // Quebra de linha na observação
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };

          if (colIndex === 1 && typeof value === 'number') {
            cell.numFmt = '#,##0';
          }

          // Colorir coluna de validação (índice 9)
          if (colIndex === 9) {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: {
                argb:
                  value === 'SIM' || value === 'Sim' ? 'FF3B82F6' : 'FFEF4444',
              },
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        worksheet.getRow(currentRow).height = 24;
        currentRow++;
      });

      // ================================================================================
      // CONFIGURAÇÕES FINAIS
      // ================================================================================
      const columnWidths = [
        { width: 15 }, // N° OS
        { width: 12 }, // CÓD. OS
        { width: 40 }, // CLIENTE
        { width: 40 }, // RECURSO
        { width: 15 }, // DATA
        { width: 20 }, // STATUS
        { width: 15 }, // HORA INÍCIO
        { width: 15 }, // HORA FIM
        { width: 15 }, // DURAÇÃO
        { width: 15 }, // VALIDAÇÃO
        { width: 60 }, // OBSERVAÇÃO
      ];

      worksheet.columns = columnWidths;

      // ================================================================================
      // SALVAR ARQUIVO
      // ================================================================================
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const timestamp = new Date().getTime();
      const nomeArquivo = `Relatorio_Chamados_${filtros?.mes || 'todos'}_${filtros?.ano || new Date().getFullYear()}_${timestamp}.xlsx`;
      saveAs(blob, nomeArquivo);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // ================================================================================
  // RENDERIZAÇÃO
  // ================================================================================
  return (
    <button
      onClick={exportToExcel}
      disabled={isExporting || disabled}
      title={disabled ? 'Não há dados para exportar' : 'Exportar para Excel'}
      className={`group cursor-pointer rounded-md bg-gradient-to-br from-green-600 to-green-700 p-3 shadow-md shadow-black hover:shadow-xl hover:shadow-black transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <RiFileExcel2Fill
        className={`text-white ${isExporting ? 'animate-pulse' : 'group-hover:scale-110'}`}
        size={24}
      />
    </button>
  );
}
