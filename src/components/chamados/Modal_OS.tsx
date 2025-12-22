// src/components/chamados/Modal_OS.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { useRedimensionarColunas } from '@/hooks/useRedimensionarColunas';
import { useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { IoClose } from 'react-icons/io5';
import { TbFileInvoice } from 'react-icons/tb';
import { IsError } from '../utils/IsError';
import { IsLoading } from '../utils/IsLoading';
import { getColunasOS, OSRowProps } from './Colunas_Tabela_OS';
import { RedimensionarColunas } from './Redimensionar_Colunas';

// ==================== INTERFACES ====================
interface ApiResponseOS {
  success: boolean;
  codChamado: number;
  dataChamado?: string; // ✅ NOVO: Data do chamado
  periodo?: {
    mes: number;
    ano: number;
  };
  totais: {
    quantidade_OS: number;
    total_horas_chamado: number;
  };
  data: OSRowProps[];
}

interface ModalOSProps {
  isOpen: boolean;
  codChamado: number | null;
  onClose: () => void;
  onSelectOS: (os: OSRowProps) => void;
}

// ==================== FUNÇÕES DE FETCH ====================
const createAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
  'x-is-admin': localStorage.getItem('isAdmin') || 'false',
  'x-user-email': localStorage.getItem('userEmail') || '',
  'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

const fetchOSByChamado = async ({
  codChamado,
  isAdmin,
  codCliente,
  mes,
  ano,
}: {
  codChamado: number;
  isAdmin: boolean;
  codCliente: string | null;
  mes: number;
  ano: number;
}): Promise<ApiResponseOS> => {
  const params = new URLSearchParams({
    isAdmin: String(isAdmin),
    mes: String(mes),
    ano: String(ano),
  });

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  const response = await fetch(
    `/api/chamados/${codChamado}/os?${params.toString()}`,
    {
      headers: createAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao carregar OS');
  }

  return response.json();
};

// ==================== COMPONENTE PRINCIPAL ====================
export function ModalOS({
  isOpen,
  codChamado,
  onClose,
  onSelectOS,
}: ModalOSProps) {
  const { isAdmin, codCliente } = useAuth();
  const { filters } = useFilters();
  const { mes, ano } = filters;

  // Larguras iniciais das colunas
  const initialColumnWidths = {
    NUM_OS: 120,
    DTINI_OS: 140,
    HRINI_OS: 120,
    HRFIM_OS: 120,
    TOTAL_HORAS_OS: 150,
    OBS: 300,
    NOME_RECURSO: 200,
    NOME_TAREFA: 250,
    VALCLI_OS: 150,
  };

  // Hook de resize
  const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
    useRedimensionarColunas(initialColumnWidths);

  // Query de OS's
  const { data, isLoading, error } = useQuery({
    queryKey: ['modal-os-lista', codChamado, isAdmin, codCliente, mes, ano],
    queryFn: () =>
      fetchOSByChamado({
        codChamado: codChamado!,
        isAdmin,
        codCliente,
        mes: mes ?? new Date().getMonth() + 1,
        ano: ano ?? new Date().getFullYear(),
      }),
    enabled: isOpen && codChamado !== null && !!mes && !!ano,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const osData = useMemo(() => data?.data ?? [], [data?.data]);
  const columns = useMemo(() => getColunasOS(), []);

  // ✅ NOVO: Extrai a data do chamado da resposta da API
  const dataChamado = useMemo(() => {
    if (data?.dataChamado) {
      return formatarDataParaBR(data.dataChamado);
    }
    // Fallback para mes/ano caso a API não retorne dataChamado
    return `${mes}/${ano}`;
  }, [data?.dataChamado, mes, ano]);

  const table = useReactTable<OSRowProps>({
    data: osData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Função para fechar modal
  const handleClose = () => {
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen || codChamado === null) return null;

  return (
    <div
      onClick={handleBackdropClick}
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal Container */}
      <div className="animate-in slide-in-from-bottom-4 relative z-10 max-h-[95vh] w-full max-w-[2200px] overflow-hidden rounded-xl bg-white transition-all ease-out">
        {/* Header */}
        <header className="relative flex items-center justify-between bg-teal-700 p-6 shadow-md shadow-black">
          <div className="flex items-center gap-6">
            <TbFileInvoice className="text-white" size={60} />
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold tracking-widest text-gray-200 select-none">
                ORDENS DE SERVIÇO
              </h1>
              {/* ✅ MODIFICADO: Agora usa dataChamado formatada */}
              <p className="text-xl font-extrabold tracking-widest text-gray-200 select-none italic">
                Chamado #{formatarNumeros(codChamado)} - {dataChamado}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="group cursor-pointer rounded-full bg-white/20 p-3 transition-all hover:scale-125 shadow-md shadow-black hover:bg-red-500 active:scale-95"
          >
            <IoClose
              className="text-white group-hover:scale-125 group-active:scale-95"
              size={20}
            />
          </button>
        </header>

        {/* Body */}
        <div
          className="overflow-y-auto p-6"
          style={{ maxHeight: '100vh', minHeight: '500px' }}
        >
          {isLoading && (
            <IsLoading
              isLoading={isLoading}
              title="Carregando OS's do chamado..."
            />
          )}

          {error && (
            <IsError
              isError={!!error}
              error={error as Error}
              title="Erro ao Carregar OS's"
            />
          )}

          {!isLoading && !error && osData.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xl font-bold text-slate-600 tracking-widest select-none">
                Nenhuma OS encontrada para este chamado no período {mes}/{ano}
              </p>
            </div>
          )}

          {!isLoading && !error && osData.length > 0 && (
            <>
              {/* Badge com total */}
              <div className="mb-6 flex items-center gap-4">
                <div className="h-2.5 w-2.5 rounded-full bg-teal-800 animate-pulse"></div>
                <span className="text-2xl font-extrabold text-gray-800 tracking-widest select-none">
                  Total: {osData.length} {osData.length === 1 ? 'OS' : "OS's"}{' '}
                  em {mes}/{ano}
                </span>
              </div>

              {/* Tabela de OS's */}
              <div className="overflow-hidden rounded-lg border border-teal-800 shadow-lg">
                <div
                  className="overflow-y-auto scrollbar-thin scrollbar-track-teal-100 scrollbar-thumb-teal-600 hover:scrollbar-thumb-teal-800"
                  style={{ maxHeight: '55vh' }}
                >
                  <table
                    className="w-full border-separate border-spacing-0"
                    style={{ tableLayout: 'fixed' }}
                  >
                    {/* Thead com ResizeHandle */}
                    <thead className="sticky top-0 z-10">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header, idx) => (
                            <th
                              key={header.id}
                              className="bg-teal-800 p-4 font-extrabold tracking-widest select-none text-base text-white border-teal-900 relative border-r shadow-md shadow-black"
                              style={{ width: `${columnWidths[header.id]}px` }}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}

                              {/* ResizeHandle em cada coluna (exceto última) */}
                              {idx < headerGroup.headers.length - 1 && (
                                <RedimensionarColunas
                                  columnId={header.id}
                                  onMouseDown={handleMouseDown}
                                  onDoubleClick={handleDoubleClick}
                                  isResizing={resizingColumn === header.id}
                                />
                              )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>

                    {/* Tbody com larguras dinâmicas */}
                    <tbody>
                      {table.getRowModel().rows.map((row, idx) => (
                        <tr
                          key={row.id}
                          onClick={() => onSelectOS(row.original)}
                          className={`cursor-pointer transition-all ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          } hover:bg-teal-100`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className="p-4 border-b border-gray-300"
                              style={{
                                width: `${columnWidths[cell.column.id]}px`,
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
