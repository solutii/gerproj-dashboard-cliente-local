import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { ColumnDef } from '@tanstack/react-table';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaMinusCircle,
  FaTimesCircle,
} from 'react-icons/fa';

export interface SaldoRowProps {
  mes: number;
  ano: number;
  horasContratadas: number;
  horasExecutadas: number;
  saldo: number;
  validoAte: string;
  status: 'disponivel' | 'expirado' | 'zerado' | 'negativo';
  mesesDesdeApuracao: number;
}

const StatusBadge = ({
  status,
}: {
  status: 'disponivel' | 'expirado' | 'zerado' | 'negativo';
}) => {
  if (status === 'disponivel') {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-emerald-100 px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-700 tracking-wider select-none border border-emerald-300">
        <FaCheckCircle size={14} />
        <span>Disponível</span>
      </div>
    );
  }

  if (status === 'negativo') {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-orange-100 px-3 py-1.5 text-xs sm:text-sm font-bold text-orange-700 tracking-wider select-none border border-orange-300">
        <FaMinusCircle size={14} />
        <span>Débito</span>
      </div>
    );
  }

  if (status === 'expirado') {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-red-100 px-3 py-1.5 text-xs sm:text-sm font-bold text-red-700 tracking-wider select-none border border-red-300">
        <FaTimesCircle size={14} />
        <span>Expirado</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-700 tracking-wider select-none border border-gray-300">
      <FaExclamationTriangle size={14} />
      <span>Zerado</span>
    </div>
  );
};

export const getColunasSaldo = (): ColumnDef<SaldoRowProps>[] => {
  return [
    {
      accessorKey: 'periodo',
      id: 'periodo',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          PERÍODO
        </div>
      ),
      cell: ({ row }) => {
        const { mes, ano } = row.original;
        return (
          <div className="text-center font-bold select-none tracking-widest text-xs sm:text-sm text-gray-900">
            {mes.toString().padStart(2, '0')}/{ano}
          </div>
        );
      },
    },

    {
      accessorKey: 'horasContratadas',
      id: 'horasContratadas',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          CONTRATADAS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-xs sm:text-sm text-blue-700">
            {formatarHorasTotaisSufixo(value)}
          </div>
        );
      },
    },

    {
      accessorKey: 'horasExecutadas',
      id: 'horasExecutadas',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          EXECUTADAS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="text-center font-semibold select-none tracking-widest text-xs sm:text-sm text-purple-700">
            {formatarHorasTotaisSufixo(value)}
          </div>
        );
      },
    },

    {
      accessorKey: 'saldo',
      id: 'saldo',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          SALDO
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as number;
        const color =
          value > 0
            ? 'text-emerald-700'
            : value < 0
              ? 'text-orange-700'
              : 'text-gray-700';

        const sinal = value > 0 ? '+' : value < 0 ? '' : '';
        const valorFormatado = formatarHorasTotaisSufixo(Math.abs(value));

        return (
          <div
            className={`text-center font-bold select-none tracking-widest text-xs sm:text-sm ${color}`}
          >
            {value < 0 && '-'}
            {value > 0 && '+'}
            {valorFormatado}
          </div>
        );
      },
    },

    {
      accessorKey: 'validoAte',
      id: 'validoAte',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          VÁLIDO ATÉ
        </div>
      ),
      cell: ({ getValue, row }) => {
        const value = getValue() as string;
        const { status } = row.original;

        if (status === 'expirado') {
          return (
            <div className="text-center font-semibold select-none tracking-widest text-xs sm:text-sm text-red-600">
              Expirado
            </div>
          );
        }

        if (status === 'zerado') {
          return (
            <div className="text-center font-semibold select-none tracking-widest text-xs sm:text-sm text-gray-500">
              N/A
            </div>
          );
        }

        if (status === 'negativo') {
          return (
            <div className="text-center font-bold select-none tracking-widest text-xs sm:text-sm text-orange-600">
              -
            </div>
          );
        }

        return (
          <div className="text-center font-semibold select-none tracking-widest text-xs sm:text-sm text-emerald-600">
            {value}
          </div>
        );
      },
    },

    {
      accessorKey: 'status',
      id: 'status',
      header: () => (
        <div className="text-center tracking-widest font-extrabold select-none text-white text-xs sm:text-sm">
          STATUS
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as
          | 'disponivel'
          | 'expirado'
          | 'zerado'
          | 'negativo';
        return (
          <div className="flex justify-center w-full">
            <StatusBadge status={value} />
          </div>
        );
      },
    },
  ];
};
