import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHoraSufixo } from '@/formatters/formatar-hora';
import {
  formatarCodNumber,
  formatarCodString,
} from '@/formatters/formatar-numeros';
import { ColumnDef } from '@tanstack/react-table';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { TooltipTabela } from '../utils/Tooltip';

// Define o tipo das propriedades de cada linha da tabela
export type TableRowProps = {
  chamado_os: string;
  cod_os: string;
  dtini_os: string;
  nome_cliente: string;
  status_chamado: string;
  nome_recurso: string;
  hrini_os: string;
  hrfim_os: string;
  total_horas: string;
  obs: string;
  valcli_os?: string | null;
};

// Componente para exibir o status de validação
const ValidacaoBadge = ({ status }: { status?: string | null }) => {
  const statusNormalized = (status ?? '').toString().toUpperCase().trim();

  if (statusNormalized === 'SIM') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-200 px-4 py-2 text-xs font-extrabold text-emerald-800 tracking-widest select-none italic">
        <FaCheckCircle className="text-emerald-700" size={20} />
        Aprovado
      </div>
    );
  }

  if (statusNormalized === 'NAO') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-red-200 px-4 py-2 text-xs font-extrabold text-red-800 tracking-widest select-none italic">
        <FaTimesCircle className="text-red-700" size={20} />
        Recusado
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-xs font-extrabold text-slate-800 tracking-widest select-none italic">
      {status ?? 'n/a'}
    </div>
  );
};

// Define as colunas da tabela
export const columns: ColumnDef<TableRowProps>[] = [
  {
    accessorKey: 'chamado_os',
    id: 'chamado_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        CHAMADO
      </div>
    ),
    cell: ({ getValue }) => {
      const value = getValue() as string | null | undefined;
      const displayValue = value ? formatarCodString(value) : 'n/a';

      return (
        <div className="text-center font-medium select-none tracking-widest text-slate-800 text-sm">
          {displayValue}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue.trim() === '') return true;
      const cellValue = row.getValue(columnId);
      if (cellValue == null) return false;
      const cellString = String(cellValue).replace(/\D/g, '');
      const filterString = String(filterValue).replace(/\D/g, '');
      return cellString.includes(filterString);
    },
  },
  // =====

  {
    accessorKey: 'cod_os',
    id: 'cod_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        OS
      </div>
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium select-none tracking-widest text-slate-800 text-sm">
        {formatarCodNumber(getValue() as number)}
      </div>
    ),
    enableColumnFilter: true,
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue.trim() === '') return true;
      const cellValue = row.getValue(columnId);
      if (cellValue == null) return false;
      const cellString = String(cellValue).replace(/\D/g, '');
      const filterString = String(filterValue).replace(/\D/g, '');
      return cellString.includes(filterString);
    },
  },
  // =====

  {
    accessorKey: 'dtini_os',
    id: 'dtini_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        DATA OS
      </div>
    ),
    cell: ({ getValue }) => {
      const dateString = getValue() as string;
      const formattedDate = formatarDataParaBR(dateString);

      return (
        <div className="text-center tracking-widest font-medium select-none text-slate-800 text-sm">
          {formattedDate}
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'nome_cliente',
    id: 'nome_cliente',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        CLIENTE
      </div>
    ),
    cell: ({ getValue }) => {
      const fullName = (getValue() as string) ?? '';
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      const display =
        parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
      return (
        <div className="text-left tracking-widest select-none font-medium text-slate-800  text-sm">
          {display}
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'status_chamado',
    id: 'status_chamado',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        STATUS
      </div>
    ),
    cell: ({ getValue }) => (
      <div className="text-left font-medium tracking-widest select-none text-slate-800 text-sm">
        {getValue() as string}
      </div>
    ),
    enableColumnFilter: true,
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue.trim() === '') return true;
      const cellValue = row.getValue(columnId);
      if (cellValue == null) return false;
      const cellString = String(cellValue).toLowerCase().trim();
      const filterString = String(filterValue).toLowerCase().trim();
      return cellString.includes(filterString);
    },
  },
  // =====

  {
    accessorKey: 'nome_recurso',
    id: 'nome_recurso',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        CONSULTOR
      </div>
    ),
    cell: ({ getValue }) => {
      const raw = (getValue() as string) ?? '';
      const corrected = corrigirTextoCorrompido(raw);
      const parts = corrected.trim().split(/\s+/).filter(Boolean);
      const display =
        parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
      return (
        <div className="w-full">
          <TooltipTabela content={corrected} maxWidth="200px">
            <div className="text-left tracking-widest select-none font-medium text-slate-800 text-sm truncate">
              {display}
            </div>
          </TooltipTabela>
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'hrini_os',
    id: 'hrini_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        HR. INÍCIO
      </div>
    ),
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return (
        <div className="text-center tracking-widest select-none font-medium text-slate-800  text-sm">
          {formatarHoraSufixo(value)}
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'hrfim_os',
    id: 'hrfim_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        HR. FIM
      </div>
    ),
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return (
        <div className="text-center tracking-widest select-none font-medium text-slate-800  text-sm">
          {formatarHoraSufixo(value)}
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'total_horas',
    id: 'total_horas',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        HR's GASTAS
      </div>
    ),
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return (
        <div className="text-center tracking-widest select-none font-extrabold text-base text-green-600 italic">
          {value}
        </div>
      );
    },
    enableColumnFilter: true,
  },
  // =====

  {
    accessorKey: 'valcli_os',
    id: 'valcli_os',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        VALIDAÇÃO
      </div>
    ),
    cell: ({ getValue }) => (
      <div className="flex justify-center tracking-widest font-medium select-none text-slate-800  text-sm">
        <ValidacaoBadge status={getValue() as string | null} />
      </div>
    ),
    enableColumnFilter: true,
    filterFn: (row, _columnId, filterValue) => {
      // Se não há filtro aplicado, mostra todas as linhas
      if (!filterValue) return true;

      const value = row.getValue('valcli_os') as string | null | undefined;
      const cellValueUpper = (value ?? '').toString().toUpperCase().trim();
      const filterValueUpper = filterValue.toString().toUpperCase().trim();

      // Comparação exata para SIM ou NAO
      return cellValueUpper === filterValueUpper;
    },
  },
  // =====

  {
    accessorKey: 'obs',
    id: 'obs',
    header: () => (
      <div className="text-center tracking-widest font-bold select-none text-white">
        OBSERVAÇÃO
      </div>
    ),
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return (
        <div className="w-full">
          <TooltipTabela
            content={corrigirTextoCorrompido(value)}
            maxWidth="200px"
          >
            <div className="truncate tracking-widest select-none font-medium text-slate-800 text-sm">
              {corrigirTextoCorrompido(value)}
            </div>
          </TooltipTabela>
        </div>
      );
    },
    enableColumnFilter: true,
  },
];
