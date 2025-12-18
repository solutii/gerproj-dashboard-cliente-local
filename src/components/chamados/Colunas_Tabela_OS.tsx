import { formatarDataParaBR } from '@/formatters/formatar-data';
import {
  formatarHora,
  formatarHorasTotaisSufixo,
} from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { ColumnDef } from '@tanstack/react-table';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { TooltipTabela } from '../utils/Tooltip';

// ==================== INTERFACES ====================
export interface OSRowProps {
  COD_OS: number;
  NUM_OS: number;
  DTINI_OS: string;
  HRINI_OS: string;
  HRFIM_OS: string;
  TOTAL_HORAS_OS: number;
  OBS: string | null;
  NOME_RECURSO: string | null;
  NOME_TAREFA: string | null;
  VALCLI_OS: string | null;
  OBSCLI_OS?: string | null;
  // ==================
  NOME_CLIENTE?: string | null;
}
// ===============

// ==================== LARGURAS DAS COLUNAS ====================

const COLUMN_WIDTH_ADMIN: Record<string, string> = {
  // COD_OS: '8%',
  NUM_OS: '8%',
  DTINI_OS: '8%',
  HRINI_OS: '8%',
  HRFIM_OS: '8%',
  TOTAL_HORAS_OS: '10%',
  OBS: '18%',
  NOME_RECURSO: '14%',
  NOME_TAREFA: '16%',
  VALCLI_OS: '10%',
};

const COLUMN_WIDTH_CLIENT: Record<string, string> = {
  // COD_OS: '8%',
  NUM_OS: '8%',
  DTINI_OS: '8%',
  HRINI_OS: '8%',
  HRFIM_OS: '8%',
  TOTAL_HORAS_OS: '10%',
  OBS: '18%',
  NOME_RECURSO: '14%',
  NOME_TAREFA: '16%',
  VALCLI_OS: '10%',
};
// ===============

// Função atualizada que considera o contexto admin/cliente
export function getColumnWidthOS(
  columnId: string,
  isAdmin: boolean = true,
): string {
  const widthMap = isAdmin ? COLUMN_WIDTH_ADMIN : COLUMN_WIDTH_CLIENT;
  return widthMap[columnId] || 'auto';
}
// ===============

// ==================== COMPONENTE DE VALIDAÇÃO ====================
const ValidacaoBadge = ({ status }: { status?: string | null }) => {
  const statusNormalized = (status ?? 'SIM').toString().toUpperCase().trim();

  if (statusNormalized === 'SIM') {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-emerald-300 px-3 py-1.5 text-sm font-extrabold text-emerald-700 tracking-widest select-none italic border border-emerald-400">
        <FaCheckCircle className="text-emerald-700" size={16} />
        Aprovado
      </div>
    );
  }

  if (statusNormalized === 'NAO') {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-red-300 px-3 py-1.5 text-sm font-extrabold text-red-700 tracking-widest select-none italic border border-red-400">
        <FaTimesCircle className="text-red-700" size={16} />
        Recusado
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded bg-gray-300 px-3 py-1.5 text-sm font-extrabold text-gray-800 tracking-widest select-none italic border border-gray-400">
      {status ?? '---------------'}
    </div>
  );
};
// ===============

// ==================== COLUNAS ====================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
  return [
    //  Número da OS
    {
      accessorKey: 'NUM_OS',
      id: 'NUM_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          NÚM. OS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = (getValue() as number) ?? '---------------';
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {formatarNumeros(value)}
          </div>
        );
      },
    },
    // ===============

    // Data de Início da OS
    {
      accessorKey: 'DTINI_OS',
      id: 'DTINI_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          DATA
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {formatarDataParaBR(value)}
          </div>
        );
      },
    },
    // ===============

    // Hora de Início da OS
    {
      accessorKey: 'HRINI_OS',
      id: 'HRINI_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          HR. INÍCIO
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {formatarHora(value)}
          </div>
        );
      },
    },
    // ===============

    // Hora Fim da OS
    {
      accessorKey: 'HRFIM_OS',
      id: 'HRFIM_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          HR. FIM
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {formatarHora(value)}
          </div>
        );
      },
    },
    // ===============

    // Total de Horas da OS
    {
      accessorKey: 'TOTAL_HORAS_OS',
      id: 'TOTAL_HORAS_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          TOTAL HORAS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {formatarHorasTotaisSufixo(value)}
          </div>
        );
      },
    },
    // ===============

    // Observação da OS
    {
      accessorKey: 'OBS',
      id: 'OBS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          OBSERVAÇÃO
        </div>
      ),
      cell: ({ getValue }) => {
        const value = (getValue() as string) ?? '---------------';
        const isSemObs = value === '---------------';
        return (
          <TooltipTabela content={value} maxWidth="400px">
            <div
              className={`font-semibold tracking-widest text-sm text-gray-800 select-none truncate overflow-hidden whitespace-nowrap ${isSemObs ? 'text-center' : 'text-left'}`}
            >
              {corrigirTextoCorrompido(value)}
            </div>
          </TooltipTabela>
        );
      },
    },
    // ===============

    // Consultor da OS
    {
      accessorKey: 'NOME_RECURSO',
      id: 'NOME_RECURSO',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          CONSULTOR
        </div>
      ),
      cell: ({ getValue }) => {
        const value = (getValue() as string) ?? '---------------';
        const corrected = corrigirTextoCorrompido(value);
        const parts = corrected.trim().split(/\s+/).filter(Boolean);
        const display =
          parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
        return (
          <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
            {display}
          </div>
        );
      },
    },
    // ===============

    // Nome da Tarefa
    {
      accessorKey: 'NOME_TAREFA',
      id: 'NOME_TAREFA',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          ENTREGÁVEL
        </div>
      ),
      cell: ({ getValue }) => {
        const value = (getValue() as string) ?? '---------------';
        const isSemNomeTarefa = value === '---------------';
        return (
          <TooltipTabela content={value} maxWidth="400px">
            <div
              className={`font-semibold tracking-widest text-sm text-gray-800 select-none truncate overflow-hidden whitespace-nowrap ${isSemNomeTarefa ? 'text-center' : 'text-left'}`}
            >
              {corrigirTextoCorrompido(value)}
            </div>
          </TooltipTabela>
        );
      },
    },
    // ===============

    // Validação da OS
    {
      accessorKey: 'VALCLI_OS',
      id: 'VALCLI_OS',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-sm">
          VALIDAÇÃO
        </div>
      ),
      cell: ({ getValue }) => {
        const value = (getValue() as string) ?? '---------------';
        return (
          <div className="flex justify-center w-full">
            <ValidacaoBadge status={value} />
          </div>
        );
      },
    },
    // ===============
  ];
};

// export const colunasOS = getColunasOS();
