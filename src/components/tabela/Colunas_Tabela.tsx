import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { ColumnDef } from '@tanstack/react-table';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { TooltipTabela } from '../utils/Tooltip';
import { LuCalendarClock } from "react-icons/lu";

// Define o tipo das propriedades de cada linha da tabela
export type TableRowProps = {
  chamado_os: string;
  cod_os: string;
  codtrf_os?: string | null;
  dtini_os: string;
  nome_cliente: string;
  status_chamado: string;
  solicitacao_chamado?: string | null;
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

// FUNÇÃO QUE RETORNA AS COLUNAS BASEADO NO isAdmin
export const getColumns = (isAdmin: boolean): ColumnDef<TableRowProps>[] => {
  const allColumns: ColumnDef<TableRowProps>[] = [
    {
      accessorKey: 'chamado_os',
      id: 'chamado_os',
      header: () => (
        <div className="text-center tracking-widest font-bold select-none text-white">
          CHAMADO
        </div>
      ),
      cell: ({ getValue, row }) => {
        const chamado = getValue() as string | null | undefined;
        const tarefa = row.original.codtrf_os;

        if (chamado) {
          return (
            <TooltipTabela content={`Chamado: ${chamado}`} maxWidth="150px">
              <div className="text-center font-medium select-none tracking-widest text-slate-800 text-sm">
                {formatarNumeros(chamado)}
              </div>
            </TooltipTabela>
          );
        }

        if (tarefa) {
          return (
            <TooltipTabela content={`Tarefa: ${tarefa}`} maxWidth="150px">
              <div className="text-center font-medium select-none tracking-widest text-orange-600 text-sm">
                <span className="font-bold">T-</span>
                {formatarNumeros(tarefa)}
              </div>
            </TooltipTabela>
          );
        }

        return (
          <div className="text-center font-medium select-none tracking-widest text-slate-400 text-sm italic">
            n/a
          </div>
        );
      },
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.trim() === '') return true;

        const chamado = row.getValue(columnId);
        const tarefa = row.original.codtrf_os;
        const filterString = String(filterValue).replace(/\D/g, '');

        if (chamado != null) {
          const chamadoString = String(chamado).replace(/\D/g, '');
          if (chamadoString.includes(filterString)) return true;
        }

        if (tarefa != null) {
          const tarefaString = String(tarefa).replace(/\D/g, '');
          if (tarefaString.includes(filterString)) return true;
        }

        return false;
      },
    },

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
          {formatarNumeros(getValue() as number)}
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

    // COLUNA CLIENTE - APENAS PARA ADMIN
    ...(isAdmin
      ? [
          {
            accessorKey: 'nome_cliente' as const,
            id: 'nome_cliente',
            header: () => (
              <div className="text-center tracking-widest font-bold select-none text-white">
                CLIENTE
              </div>
            ),
            cell: ({ getValue }: any) => {
              const fullName = (getValue() as string) ?? '';
              const parts = fullName.trim().split(/\s+/).filter(Boolean);
              const display =
                parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
              return (
                <div className="text-left tracking-widest select-none font-medium text-slate-800 text-sm">
                  {display}
                </div>
              );
            },
            enableColumnFilter: true,
          } as ColumnDef<TableRowProps>,
        ]
      : []),

    {
      accessorKey: 'status_chamado',
      id: 'status_chamado',
      header: () => (
        <div className="text-center tracking-widest font-bold select-none text-white">
          STATUS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string | null | undefined;
        const displayValue = value ? value : 'Sem status';
        const isSemStatus = displayValue === 'Sem status';
        const colorClass = isSemStatus ? 'text-red-500 italic' : 'text-slate-800';

        return (
          <div
            className={`text-left font-medium tracking-widest select-none ${colorClass} text-sm`}
          >
            {displayValue}
          </div>
        );
      },
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
          <div className="text-center tracking-widest select-none font-medium text-slate-800 text-sm">
            {formatarHora(value)}
          </div>
        );
      },
      enableColumnFilter: true,
    },

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
          <div className="text-center tracking-widest select-none font-medium text-slate-800 text-sm">
            {formatarHora(value)}
          </div>
        );
      },
      enableColumnFilter: true,
    },

    {
      accessorKey: 'total_horas',
      id: 'total_horas',
      header: () => (
        <div className="text-center tracking-widest font-bold select-none text-white">
          TOTAL{' '}
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
      <div className="flex items-center gap-2 rounded-lg bg-purple-200 px-4 py-2 text-sm font-extrabold text-purple-800 tracking-widest select-none italic">
            <LuCalendarClock className="text-purple-800" size={20} />
            {value}
          </div>
        );
      },
      enableColumnFilter: true,
    },

    {
      accessorKey: 'valcli_os',
      id: 'valcli_os',
      header: () => (
        <div className="text-center tracking-widest font-bold select-none text-white">
          VALIDAÇÃO
        </div>
      ),
      cell: ({ getValue }) => (
        <div className="flex justify-center tracking-widest font-medium select-none text-slate-800 text-sm">
          <ValidacaoBadge status={getValue() as string | null} />
        </div>
      ),
      enableColumnFilter: true,
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue) return true;

        const value = row.getValue('valcli_os') as string | null | undefined;
        const cellValueUpper = (value ?? '').toString().toUpperCase().trim();
        const filterValueUpper = filterValue.toString().toUpperCase().trim();

        return cellValueUpper === filterValueUpper;
      },
    },

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
        const textoCorrigido = corrigirTextoCorrompido(value);
        const displayValue = textoCorrigido ? textoCorrigido : 'Sem observação';
        const isNoObervation = displayValue === 'Sem observação';
        const colorClass = isNoObervation
          ? 'text-red-500 italic'
          : 'text-slate-800';

        return (
          <TooltipTabela content={displayValue} maxWidth="300px">
            <div
              className={`truncate tracking-widest select-none font-medium text-sm w-full ${colorClass}`}
            >
              {displayValue}
            </div>
          </TooltipTabela>
        );
      },
      enableColumnFilter: true,
      size: 300,
    },
  ];

  return allColumns;
};

// MANTÉM A EXPORTAÇÃO columns PARA COMPATIBILIDADE (mas use getColumns no componente)
export const columns = getColumns(true); // default com todas as colunas