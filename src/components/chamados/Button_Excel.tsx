'use client';

import { formatarDataParaBR } from '@/formatters/formatar-data';
import {
  formatarHora,
  formatarHorasTotaisSufixo,
} from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { renderizarDoisPrimeirosNomes } from '@/formatters/remover-acentuacao';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import { RiFileExcel2Fill } from 'react-icons/ri';
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

interface ExportaExcelChamadosButtonProps {
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

    // CORREÇÃO: Adicionar mes e ano aos parâmetros
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

// Função para obter nome do mês
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

// Função para aplicar bordas em uma célula
function aplicarBordas(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };
}

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ExportaExcelChamadosButton({
  data,
  filtros,
  isAdmin,
  codCliente,
  className = '',
  disabled = false,
}: ExportaExcelChamadosButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!data || data.length === 0) disabled = true;

  const exportToExcel = async () => {
    setIsExporting(true);
    setProgress({ current: 0, total: 0 });

    try {
      // CORREÇÃO: Passar mes e ano para fetchAllOS
      const osData = await fetchAllOS(
        data,
        isAdmin,
        codCliente,
        filtros?.mes,
        filtros?.ano,
        (current, total) => setProgress({ current, total }),
      );

      const workbook = new ExcelJS.Workbook();

      // ====== ABA 1: CHAMADOS ======
      const wsChamados = workbook.addWorksheet('Chamados');
      wsChamados.views = [{ showGridLines: false }];
      let row = 1;

      // Título
      wsChamados.mergeCells('A1:K1');
      const title = wsChamados.getCell('A1');
      title.value = 'RELATÓRIO DE CHAMADOS';
      title.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
      title.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
      };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(title);
      wsChamados.getRow(1).height = 35;
      row = 2;

      // Data
      wsChamados.mergeCells('A2:K2');
      const date = wsChamados.getCell('A2');
      date.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      date.font = { italic: true, size: 14, color: { argb: 'FFFFFFFF' } };
      date.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
      };
      date.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(date);
      wsChamados.getRow(2).height = 25;
      row = 4;

      // PERÍODO
      wsChamados.mergeCells(`A${row}:K${row}`);
      const periodo = wsChamados.getCell(`A${row}`);
      const nomeMes = filtros?.mes ? obterNomeMes(filtros.mes) : 'TODOS';
      const ano = filtros?.ano || new Date().getFullYear();
      periodo.value = `PERÍODO: ${nomeMes}/${ano}`;
      periodo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      periodo.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B21A8' },
      };
      periodo.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(periodo);
      wsChamados.getRow(row).height = 28;
      row += 2;

      // Totalizadores
      const totais = [
        ['TOTAL CHAMADOS', filtros?.totalChamados ?? data.length, '6B21A8'],
        ["TOTAL OS's", filtros?.totalOS ?? 0, '0891B2'],
        [
          'TOTAL HORAS',
          formatarHorasTotaisSufixo(filtros?.totalHorasOS ?? 0),
          '059669',
        ],
      ];

      totais.forEach(([label, value, color]) => {
        wsChamados.mergeCells(`A${row}:B${row}`);
        wsChamados.mergeCells(`C${row}:D${row}`);

        const lblCell = wsChamados.getCell(`A${row}`);
        lblCell.value = label;
        lblCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        lblCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color as string },
        };
        lblCell.alignment = { horizontal: 'center', vertical: 'middle' };
        aplicarBordas(lblCell);

        const valCell = wsChamados.getCell(`C${row}`);
        valCell.value = value;
        valCell.font = { size: 11, bold: true };
        valCell.alignment = { horizontal: 'center', vertical: 'middle' };
        aplicarBordas(valCell);

        wsChamados.getRow(row).height = 22;
        row++;
      });

      row += 2;

      const chamadosSemOS = data.filter((c) => !c.TEM_OS);
      const chamadosComOS = data.filter((c) => c.TEM_OS);

      // Função para renderizar seção de chamados
      const renderSecao = (titulo: string, chamados: ChamadoRowProps[]) => {
        wsChamados.mergeCells(`A${row}:K${row}`);
        const secTitle = wsChamados.getCell(`A${row}`);
        secTitle.value = titulo;
        secTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        secTitle.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6B21A8' },
        };
        secTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        aplicarBordas(secTitle);
        wsChamados.getRow(row).height = 28;
        row++;

        const headers = [
          'CHAMADO',
          'DATA',
          'PRIORIDADE',
          'ASSUNTO',
          'EMAIL SOLICITANTE',
          'CLASSIFICAÇÃO',
          'DATA/HORA ATRIBUIÇÃO',
          'CONSULTOR(A)',
          'STATUS',
          'DATA CONCLUSÃO',
          'TOTAL HORAS',
        ];
        headers.forEach((h, i) => {
          const cell = wsChamados.getCell(row, i + 1);
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
        wsChamados.getRow(row).height = 22;
        row++;

        chamados.forEach((coluna) => {
          const dados = [
            formatarNumeros(coluna.COD_CHAMADO),
            formatarDataParaBR(coluna.DATA_CHAMADO),
            `P-${coluna.PRIOR_CHAMADO}`,
            corrigirTextoCorrompido(coluna.ASSUNTO_CHAMADO),
            coluna.EMAIL_CHAMADO || '---------------',
            corrigirTextoCorrompido(coluna.NOME_CLASSIFICACAO),
            formatarDataParaBR(coluna.DTENVIO_CHAMADO) || '---------------',
            renderizarDoisPrimeirosNomes(
              corrigirTextoCorrompido(coluna.NOME_RECURSO) || '---------------',
            ),
            coluna.STATUS_CHAMADO,
            formatarDataParaBR(coluna.CONCLUSAO_CHAMADO) || '---------------',
            formatarHorasTotaisSufixo(coluna.TOTAL_HORAS_OS),
          ];

          dados.forEach((val, i) => {
            const cell = wsChamados.getCell(row, i + 1);
            cell.value = val;
            cell.alignment = {
              horizontal: [0, 1, 2, 6, 9, 10].includes(i) ? 'center' : 'left',
              vertical: 'middle',
              indent: [3, 4, 5, 7, 8].includes(i) ? 2 : 0,
            };
            if (i === 0)
              cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
            aplicarBordas(cell);
          });
          wsChamados.getRow(row).height = 22;
          row++;
        });

        row += 2;
      };

      if (isAdmin && chamadosSemOS.length > 0) {
        renderSecao("CHAMADOS SEM OS's", chamadosSemOS);
      }

      if (chamadosComOS.length > 0)
        renderSecao("CHAMADOS COM OS's", chamadosComOS);

      wsChamados.columns = [
        { width: 15 }, // CODIGO CHAMADO
        { width: 15 }, // DATA CHAMADO
        { width: 15 }, // PRIORIDADE
        { width: 35 }, // ASSUNTO
        { width: 35 }, // EMAIL
        { width: 25 }, // CLASSIFICAÇÃO
        { width: 25 }, // DATA ATRIBUIÇÃO
        { width: 25 }, // CONSULTOR
        { width: 25 }, // STATUS
        { width: 20 }, // CONCLUSÃO
        { width: 15 }, // HORAS
      ];

      // ====== ABA 2: ORDENS DE SERVIÇO ======
      const wsOS = workbook.addWorksheet('Ordens de Serviço');
      wsOS.views = [{ showGridLines: false }];
      let osRow = 1;

      // Título
      wsOS.mergeCells('A1:J1');
      const osTitle = wsOS.getCell('A1');
      osTitle.value = 'RELATÓRIO DE ORDENS DE SERVIÇO';
      osTitle.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
      osTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0891B2' },
      };
      osTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(osTitle);
      wsOS.getRow(1).height = 35;

      wsOS.mergeCells('A2:J2');
      const osDate = wsOS.getCell('A2');
      osDate.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      osDate.font = { italic: true, size: 14, color: { argb: 'FFFFFFFF' } };
      osDate.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0891B2' },
      };
      osDate.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(osDate);
      wsOS.getRow(2).height = 25;
      osRow = 4;

      // PERÍODO (na aba de OS)
      wsOS.mergeCells(`A${osRow}:J${osRow}`);
      const osPeriodo = wsOS.getCell(`A${osRow}`);
      const osNomeMes = filtros?.mes ? obterNomeMes(filtros.mes) : 'TODOS';
      const osAno = filtros?.ano || new Date().getFullYear();
      osPeriodo.value = `PERÍODO: ${osNomeMes}/${osAno}`;
      osPeriodo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      osPeriodo.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0891B2' },
      };
      osPeriodo.alignment = { horizontal: 'center', vertical: 'middle' };
      aplicarBordas(osPeriodo);
      wsOS.getRow(osRow).height = 28;
      osRow += 2;

      // Cabeçalhos
      const osHeaders = [
        'CHAMADO',
        'NÚMERO',
        'DATA INÍCIO',
        'HORA INÍCIO',
        'HORA FIM',
        'TOTAL HORAS',
        'DESCRIÇÃO',
        'CONSULTOR',
        'ENTREGÁVEL',
        'VALIDAÇÃO',
      ];
      osHeaders.forEach((h, i) => {
        const cell = wsOS.getCell(osRow, i + 1);
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
      wsOS.getRow(osRow).height = 22;
      osRow++;

      // Dados das OS's
      chamadosComOS.forEach((chamado) => {
        const osList = osData.get(chamado.COD_CHAMADO);
        if (!osList || osList.length === 0) return;

        osList.forEach((os) => {
          const osRowData = [
            formatarNumeros(chamado.COD_CHAMADO),
            formatarNumeros(os.NUM_OS) || '---------------',
            formatarDataParaBR(os.DTINI_OS),
            formatarHora(os.HRINI_OS),
            formatarHora(os.HRFIM_OS),
            formatarHorasTotaisSufixo(os.TOTAL_HORAS_OS),
            corrigirTextoCorrompido(os.OBS) || '---------------',
            renderizarDoisPrimeirosNomes(
              corrigirTextoCorrompido(os.NOME_RECURSO) || '---------------',
            ),
            corrigirTextoCorrompido(os.NOME_TAREFA) || '---------------',
            os.VALCLI_OS || '---------------',
          ];

          osRowData.forEach((val, i) => {
            const cell = wsOS.getCell(osRow, i + 1);
            cell.value = val;
            cell.alignment = {
              horizontal: [0, 1, 2, 3, 4, 5, 9].includes(i) ? 'center' : 'left',
              vertical: 'middle',
              indent: [6, 7, 8].includes(i) ? 2 : 0,
            };

            if (i === 9) {
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                  argb:
                    val === 'SIM' || val === 'Sim' ? 'FF3B82F6' : 'FFEF4444',
                },
              };
            }
            aplicarBordas(cell);
          });
          wsOS.getRow(osRow).height = 20;
          osRow++;
        });
      });

      wsOS.columns = [
        { width: 15 }, // CHAMADO
        { width: 15 }, // NÚMERO
        { width: 15 }, // DATA INÍCIO
        { width: 15 }, // HORA INÍCIO
        { width: 15 }, // HORA FIM
        { width: 15 }, // TOTAL HORAS
        { width: 45 }, // DESCRIÇÃO
        { width: 25 }, // CONSULTOR
        { width: 45 }, // ENTREGÁVEL
        { width: 15 }, // VALIDAÇÃO
      ];

      // Salvar arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const timestamp = new Date().getTime();
      const nomeArquivo = `Relatorio_Chamados_${filtros?.mes || 'todos'}_${filtros?.ano || new Date().getFullYear()}_${timestamp}.xlsx`;
      saveAs(blob, nomeArquivo);
    } catch (error) {
      console.error('[EXCEL] ❌ Erro ao exportar Excel:', error);
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
      className={`group cursor-pointer rounded-md bg-gradient-to-br from-green-600 to-green-700 p-3 shadow-md shadow-black transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${className}`}
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
        <RiFileExcel2Fill
          className="text-white group-hover:scale-110 group-active:scale-95"
          size={24}
        />
      )}
    </button>
  );
}
