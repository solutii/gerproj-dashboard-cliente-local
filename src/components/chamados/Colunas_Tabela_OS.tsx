import { formatarDataParaBR } from '@/formatters/formatar-data';
import {
  formatarHora,
  formatarHorasTotaisSufixo,
} from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';

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
  NOME_CLIENTE?: string | null;
}

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

// ✅ NOVO: Componente auxiliar para células com tooltip condicional
const CellWithConditionalTooltip = ({
  content,
  className,
  isCentered = false,
}: {
  content: string;
  className: string;
  isCentered?: boolean;
}) => {
  const cellRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const checkTruncation = () => {
      if (cellRef.current) {
        setIsTruncated(
          cellRef.current.scrollWidth > cellRef.current.clientWidth,
        );
      }
    };

    checkTruncation();

    const resizeObserver = new ResizeObserver(checkTruncation);
    if (cellRef.current) {
      resizeObserver.observe(cellRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [content]);

  const cellContent = (
    <div 
      ref={cellRef} 
      className={className}
      title={isTruncated ? content : undefined}
    >
      {content}
    </div>
  );

  return cellContent;
};

// ==================== COLUNAS ====================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
  return [
    // Número da OS
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

    // ✅ MODIFICADO: Observação da OS - Agora expansível
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
        
        if (isSemObs) {
          return (
            <div className="text-center font-semibold tracking-widest text-sm text-gray-800 select-none">
              {value}
            </div>
          );
        }

        return (
          <CellWithConditionalTooltip
            content={corrigirTextoCorrompido(value)}
            className="font-semibold tracking-widest text-sm text-gray-800 select-none overflow-hidden whitespace-nowrap text-ellipsis text-left"
          />
        );
      },
    },

    // ✅ MODIFICADO: Consultor da OS - Agora expansível
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
        const isSemRecurso = value === '---------------';
        
        if (isSemRecurso) {
          return (
            <div className="text-center font-semibold select-none tracking-widest text-sm text-gray-800">
              {value}
            </div>
          );
        }

        const corrected = corrigirTextoCorrompido(value);
        const parts = corrected.trim().split(/\s+/).filter(Boolean);
        const display =
          parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
        
        return (
          <CellWithConditionalTooltip
            content={display}
            className="text-center font-semibold select-none tracking-widest text-sm text-gray-800 overflow-hidden whitespace-nowrap text-ellipsis"
            isCentered={true}
          />
        );
      },
    },

    // ✅ MODIFICADO: Nome da Tarefa - Agora expansível
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
        
        if (isSemNomeTarefa) {
          return (
            <div className="text-center font-semibold tracking-widest text-sm text-gray-800 select-none">
              {value}
            </div>
          );
        }

        return (
          <CellWithConditionalTooltip
            content={corrigirTextoCorrompido(value)}
            className="font-semibold tracking-widest text-sm text-gray-800 select-none overflow-hidden whitespace-nowrap text-ellipsis text-left"
          />
        );
      },
    },

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
  ];
};