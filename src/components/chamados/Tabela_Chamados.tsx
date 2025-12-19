// src/components/chamados/Tabela_Chamados.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { useColumnResize } from '@/hooks/useColumnResize';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React, { useCallback, useMemo, useState } from 'react';
import { FaEraser } from 'react-icons/fa';
import { FiRefreshCw } from 'react-icons/fi';
import { IoCall } from 'react-icons/io5';
import { IsError } from '../utils/IsError';
import { IsLoading } from '../utils/IsLoading';
import { ExportaExcelChamadosButton } from './Button_Excel';
import { ExportaPDFChamadosButton } from './Button_PDF';
import { ChamadoRowProps, getColunasChamados } from './Colunas_Tabela_Chamados';
import { OSRowProps } from './Colunas_Tabela_OS';
import {
  FiltroHeaderChamados,
  useFiltrosChamados,
} from './Filtro_Header_Tabela_Chamados';
import { ModalOS } from './Modal_OS';
import { ModalValidacaoOS } from './Modal_Validacao_OS';
import { ResizeHandle } from './ResizeHandle';

// ==================== INTERFACE ====================
interface ApiResponseChamados {
  success: boolean;
  totalChamados: number;
  totalOS: number;
  totalHorasOS: number;
  data: ChamadoRowProps[];
}

// ==================== UTILITÁRIOS ====================
const createAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
  'x-is-admin': localStorage.getItem('isAdmin') || 'false',
  'x-user-email': localStorage.getItem('userEmail') || '',
  'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

// ==================== FUNÇÕES DE FETCH ====================
const fetchChamados = async ({
  ano,
  mes,
  isAdmin,
  codCliente,
  cliente,
  recurso,
  status,
}: {
  ano: string;
  mes: string;
  isAdmin: boolean;
  codCliente: string | null;
  cliente?: string;
  recurso?: string;
  status?: string;
}): Promise<ApiResponseChamados> => {
  const params = new URLSearchParams({
    ano,
    mes,
    isAdmin: String(isAdmin),
    ...(cliente && { codClienteFilter: cliente }),
    ...(recurso && { codRecursoFilter: recurso }),
    ...(status && { statusFilter: status }),
  });

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  const response = await fetch(`/api/chamados?${params.toString()}`, {
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao carregar chamados');
  }

  return response.json();
};

// ==================== COMPONENTE PRINCIPAL ====================
export function TabelaChamados() {
  const { isAdmin, codCliente, isLoggedIn } = useAuth();
  const { filters } = useFilters();
  const { ano, mes, cliente, recurso, status } = filters;

  // Estados
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isModalListaOSOpen, setIsModalListaOSOpen] = useState(false);
  const [isModalOSOpen, setIsModalOSOpen] = useState(false);
  const [selectedChamado, setSelectedChamado] = useState<number | null>(null);
  const [selectedOS, setSelectedOS] = useState<OSRowProps | null>(null);

  const { columnFilterFn } = useFiltrosChamados();

  const initialColumnWidths = {
    COD_CHAMADO: 110,
    DATA_CHAMADO: 170,
    PRIOR_CHAMADO: 110,
    ASSUNTO_CHAMADO: 280,
    EMAIL_CHAMADO: 220,
    NOME_CLASSIFICACAO: 180,
    DTENVIO_CHAMADO: 170,
    NOME_RECURSO: 180,
    STATUS_CHAMADO: 220,
    CONCLUSAO_CHAMADO: 150,
    TOTAL_HORAS_OS: 120,
  };

  const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
    useColumnResize(initialColumnWidths);

  // Query de Chamados
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'tabela-chamados',
      ano ?? 0,
      mes ?? 0,
      cliente ?? '',
      recurso ?? '',
      status ?? '',
      isAdmin,
      codCliente ?? '',
    ],
    queryFn: () =>
      fetchChamados({
        ano: String(ano ?? new Date().getFullYear()),
        mes: String(mes ?? new Date().getMonth() + 1),
        isAdmin,
        codCliente,
        cliente: cliente ?? '',
        recurso: recurso ?? '',
        status: status ?? '',
      }),
    enabled: isLoggedIn && !!ano && !!mes,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const data = useMemo(() => {
    const chamados = apiData?.data ?? [];
    return chamados;
  }, [apiData?.data]);

  const totalOS = useMemo(() => apiData?.totalOS ?? 0, [apiData?.totalOS]);

  // Função para abrir modal de lista de OS's
  const handleChamadoClick = useCallback(
    (codChamado: number, temOS: boolean) => {
      if (temOS) {
        setSelectedChamado(codChamado);
        setIsModalListaOSOpen(true);
      }
    },
    [],
  );

  // Função para abrir modal de detalhes da OS
  const handleOSSelect = useCallback((os: OSRowProps) => {
    setSelectedOS(os);
    setIsModalOSOpen(true);
  }, []);

  // Função para fechar modal de lista de OS's
  const handleCloseModalListaOS = useCallback(() => {
    setIsModalListaOSOpen(false);
    setSelectedChamado(null);
  }, []);

  // Função para fechar modal de detalhes da OS
  const handleCloseModalOS = useCallback(() => {
    setIsModalOSOpen(false);
    setSelectedOS(null);
  }, []);

  // Função para salvar validação
  const handleSaveValidation = useCallback(
    (updatedRow: OSRowProps) => {
      refetch();
    },
    [refetch],
  );

  // Colunas dinâmicas (sem expandedRows)
  const columns = useMemo(
    () => getColunasChamados(isAdmin, new Set(), columnWidths),
    [isAdmin, columnWidths],
  );

  // ==================== CALLBACKS ====================
  const clearAllFilters = useCallback(() => {
    setColumnFilters([]);
  }, []);

  // ==================== MEMORIZAÇÕES ====================
  const hasActiveFilters = useMemo(() => {
    return columnFilters.some((filter) => {
      const value = filter.value;
      if (value == null) return false;
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return true;
    });
  }, [columnFilters]);

  const dadosFiltrados = useMemo(() => {
    if (!hasActiveFilters) {
      return data;
    }

    return data.filter((row) => {
      return columnFilters.every((filter) => {
        const columnId = filter.id;
        const filterValue = filter.value;

        if (
          !filterValue ||
          (typeof filterValue === 'string' && filterValue.trim() === '')
        ) {
          return true;
        }

        const normalizedFilterValue =
          typeof filterValue === 'string' ? filterValue : String(filterValue);

        const fakeRow: any = {
          getValue: (id: string) => row[id as keyof ChamadoRowProps],
        };

        return columnFilterFn(
          fakeRow,
          columnId as string,
          normalizedFilterValue,
        );
      });
    });
  }, [data, columnFilters, hasActiveFilters, columnFilterFn]);

  const totalHorasOS = useMemo(
    () => apiData?.totalHorasOS ?? 0,
    [apiData?.totalHorasOS],
  );

  const totalHorasFiltradas = useMemo(() => {
    if (!hasActiveFilters) {
      return totalHorasOS;
    }

    return dadosFiltrados.reduce((acc, chamado) => {
      return acc + (chamado.TOTAL_HORAS_OS || 0);
    }, 0);
  }, [dadosFiltrados, hasActiveFilters, totalHorasOS]);

  const table = useReactTable<ChamadoRowProps>({
    data: dadosFiltrados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    meta: {
      handleChamadoClick,
    },
  });

  const totalChamados = useMemo(() => data.length, [data]);
  const totalChamadosFiltrados = useMemo(
    () => dadosFiltrados.length,
    [dadosFiltrados],
  );
  const chamadosExibidos = useMemo(() => {
    return hasActiveFilters ? totalChamadosFiltrados : totalChamados;
  }, [hasActiveFilters, totalChamadosFiltrados, totalChamados]);

  const totalOSFiltrados = useMemo(() => {
    if (!hasActiveFilters) {
      return totalOS;
    }

    return dadosFiltrados.reduce((acc, chamado) => {
      return acc + (chamado.TOTAL_HORAS_OS > 0 ? 1 : 0);
    }, 0);
  }, [dadosFiltrados, hasActiveFilters, totalOS]);

  // ==================== RENDERIZAÇÃO CONDICIONAL ====================
  if (!isLoggedIn) {
    return (
      <IsError
        isError={true}
        error={
          new Error('Você precisa estar logado para visualizar os chamados')
        }
        title="Acesso Negado"
      />
    );
  }

  if (isLoading) {
    return (
      <IsLoading
        isLoading={isLoading}
        title="Aguarde, buscando dados do servidor"
      />
    );
  }

  if (error) {
    return (
      <IsError
        isError={!!error}
        error={error as Error}
        title="Erro ao Carregar Chamados"
      />
    );
  }

  // ==================== RENDERIZAÇÃO PRINCIPAL ====================
  return (
    <>
      <div className="relative flex h-full flex-col overflow-hidden border bg-white shadow-md shadow-black w-full border-b-slate-500">
        <Header
          isAdmin={isAdmin}
          totalChamados={totalChamados}
          totalChamadosFiltrados={chamadosExibidos}
          totalOS={totalOS}
          totalOSFiltrados={totalOSFiltrados}
          totalHorasOS={totalHorasOS}
          totalHorasFiltradas={totalHorasFiltradas}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          filteredData={dadosFiltrados}
          mes={String(mes)}
          ano={String(ano)}
          codCliente={codCliente}
          onRefresh={() => {
            clearAllFilters();
            setTimeout(() => {
              if (typeof window !== 'undefined') window.location.reload();
            }, 100);
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800"
            style={{ maxHeight: 'calc(100vh - 370px)' }}
          >
            <table
              className="w-full border-separate border-spacing-0"
              style={{ tableLayout: 'fixed' }}
            >
              <TableHeader
                table={table}
                isAdmin={isAdmin}
                columnWidths={columnWidths}
                handleMouseDown={handleMouseDown}
                handleDoubleClick={handleDoubleClick}
                resizingColumn={resizingColumn}
              />
              <TableBody
                table={table}
                columns={columns}
                isAdmin={isAdmin}
                clearAllFilters={clearAllFilters}
                columnWidths={columnWidths}
              />
            </table>
          </div>
        </div>
      </div>

      {/* Modal Lista de OS's */}
      <ModalOS
        isOpen={isModalListaOSOpen}
        codChamado={selectedChamado}
        onClose={handleCloseModalListaOS}
        onSelectOS={handleOSSelect}
      />

      {/* Modal Detalhes da OS */}
      <ModalValidacaoOS
        isOpen={isModalOSOpen}
        selectedRow={selectedOS}
        onClose={handleCloseModalOS}
        onSave={handleSaveValidation}
      />
    </>
  );
}

// ============================================================
// ========== SUB-COMPONENTES =================================
// ============================================================

// ==================== HEADER ====================
interface HeaderProps {
  isAdmin: boolean;
  totalChamados: number;
  totalChamadosFiltrados: number;
  totalOS: number;
  totalOSFiltrados: number;
  totalHorasOS: number;
  totalHorasFiltradas: number;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  filteredData: ChamadoRowProps[];
  mes: string;
  ano: string;
  codCliente: string | null;
  onRefresh: () => void;
}

function Header({
  isAdmin,
  totalChamados,
  totalChamadosFiltrados,
  totalOS,
  totalOSFiltrados,
  totalHorasOS,
  totalHorasFiltradas,
  hasActiveFilters,
  clearAllFilters,
  filteredData,
  mes,
  ano,
  codCliente,
  onRefresh,
}: HeaderProps) {
  const { cliente, recurso, status } = useFilters().filters;

  return (
    <header className="flex flex-col gap-10 bg-purple-900 p-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-white border border-purple-300">
            <IoCall className="text-black" size={48} />
          </div>
          <h2 className="text-4xl tracking-widest select-none font-bold text-white">
            RELATÓRIO CHAMADOS - {mes}/{ano}
          </h2>
        </div>

        <FiRefreshCw
          onClick={onRefresh}
          title="Atualizar Dados"
          className="cursor-pointer text-white transition-all hover:scale-125 hover:rotate-180 active:scale-95 mr-7"
          size={52}
        />
      </div>

      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center justify-start flex-1 gap-4 flex-wrap">
          <BadgeTotalizador
            label={totalChamadosFiltrados === 1 ? 'Chamado' : 'Chamados'}
            valor={totalChamadosFiltrados}
            valorTotal={hasActiveFilters ? totalChamados : undefined}
            width="w-[280px]"
          />

          <BadgeTotalizador
            label={totalOSFiltrados === 1 ? 'OS' : "OS's"}
            valor={totalOSFiltrados}
            valorTotal={hasActiveFilters ? totalOS : undefined}
            width="w-[230px]"
          />

          <BadgeTotalizador
            label="Horas Trabalhadas"
            valor={formatarHorasTotaisSufixo(totalHorasFiltradas)}
            valorTotal={
              hasActiveFilters
                ? formatarHorasTotaisSufixo(totalHorasOS)
                : undefined
            }
            width="w-[590px]"
          />
        </div>

        <div className="flex items-center justify-end gap-10">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              title="Limpar Filtros"
              className="group cursor-pointer rounded-full border border-purple-300 bg-white p-4 text-lg font-extrabold tracking-widest text-white transition-all hover:scale-115 active:scale-95"
            >
              <FaEraser
                size={20}
                className="text-black group-hover:scale-115 transition-all"
              />
            </button>
          )}

          <div className="flex items-center gap-4">
            <ExportaExcelChamadosButton
              data={filteredData}
              isAdmin={isAdmin}
              codCliente={codCliente}
              filtros={{
                ano,
                mes,
                cliente,
                recurso,
                status,
                totalChamados: totalChamadosFiltrados,
                totalOS: totalOSFiltrados,
                totalHorasOS: totalHorasFiltradas,
              }}
              disabled={filteredData.length === 0}
            />

            {/* ← ADICIONAR O BOTÃO PDF AQUI */}
            <ExportaPDFChamadosButton
              data={filteredData}
              isAdmin={isAdmin}
              codCliente={codCliente}
              filtros={{
                ano,
                mes,
                cliente,
                recurso,
                status,
                totalChamados: totalChamadosFiltrados,
                totalOS: totalOSFiltrados,
                totalHorasOS: totalHorasFiltradas,
              }}
              disabled={filteredData.length === 0}
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-4 rounded-full bg-purple-900 px-6 py-2 ring-2 ring-emerald-600 shadow-md shadow-black">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-600"></div>
              <span className="text-base font-bold text-emerald-300 tracking-widest select-none italic">
                Administrador
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ==================== BADGE TOTALIZADOR ====================
interface BadgeTotalizadorProps {
  label: string;
  valor: string | number;
  valorTotal?: string | number;
  width?: string;
}

function BadgeTotalizador({
  label,
  valor,
  valorTotal,
  width,
}: BadgeTotalizadorProps) {
  return (
    <div
      className={`group flex items-center gap-4 rounded bg-white px-6 py-2 border border-purple-300 flex-shrink-0 ${width}`}
    >
      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-purple-900"></div>
      <span className="text-lg tracking-widest font-extrabold select-none text-gray-800">
        {label}:{' '}
        <span className="text-lg tracking-widest font-extrabold select-none text-purple-600 italic">
          {valor}
          {valorTotal !== undefined && (
            <span className="ml-1">/{valorTotal}</span>
          )}
        </span>
      </span>
    </div>
  );
}

// ==================== TABLE HEADER ====================
function TableHeader({
  table,
  isAdmin,
  columnWidths,
  handleMouseDown,
  handleDoubleClick,
  resizingColumn,
}: {
  table: any;
  isAdmin: boolean;
  columnWidths: Record<string, number>;
  handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
  handleDoubleClick: (columnId: string) => void;
  resizingColumn: string | null;
}) {
  return (
    <thead className="sticky top-0 z-20">
      {table.getHeaderGroups().map((headerGroup: any) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: any, idx: number) => (
            <th
              key={header.id}
              className="bg-teal-700 py-6 pl-3.5 pr-4 relative border-r border-teal-900 shadow-md shadow-black"
              style={{ width: `${columnWidths[header.id]}px` }}
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}

              {idx < headerGroup.headers.length - 1 && (
                <ResizeHandle
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

      <tr className="bg-teal-700 shadow-md shadow-black">
        {table.getAllColumns().map((column: any, idx: number) => (
          <th
            key={column.id}
            className="py-4 pl-4 pr-4 relative"
            style={{ width: `${columnWidths[column.id]}px` }}
          >
            {column.id === 'TOTAL_HORAS_OS' ? (
              <div className="h-[42px]" />
            ) : (
              <FiltroHeaderChamados
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(value: string) => column.setFilterValue(value)}
                columnId={column.id}
              />
            )}

            {idx < table.getAllColumns().length - 1 && (
              <ResizeHandle
                columnId={column.id}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                isResizing={resizingColumn === column.id}
              />
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ==================== TABLE BODY ====================
interface TableBodyProps {
  table: any;
  columns: any;
  isAdmin: boolean;
  clearAllFilters: () => void;
  columnWidths: Record<string, number>;
}

function TableBody({
  table,
  columns,
  isAdmin,
  clearAllFilters,
  columnWidths,
}: TableBodyProps) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={columns.length} className="py-40 text-center">
            <EmptyState clearAllFilters={clearAllFilters} />
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="relative">
      {rows.map((row: any, rowIndex: number) => {
        const handleChamadoClick = table.options.meta?.handleChamadoClick;
        const temOS = row.original.TEM_OS ?? false;

        return (
          <tr
            key={row.id}
            data-chamado-id={row.original.COD_CHAMADO}
            onClick={() => {
              if (temOS && handleChamadoClick) {
                handleChamadoClick(row.original.COD_CHAMADO, temOS);
              }
            }}
            className={`group transition-all relative ${
              temOS ? 'cursor-pointer' : 'cursor-not-allowed'
            } ${
              rowIndex % 2 === 0
                ? 'bg-white hover:bg-gray-300'
                : 'bg-white hover:bg-gray-300'
            }`}
          >
            {row.getVisibleCells().map((cell: any, cellIndex: number) => (
              <td
                key={cell.id}
                style={{ width: `${columnWidths[cell.column.id]}px` }}
                className={`border-b border-r border-gray-500 p-3 transition-all ${
                  cellIndex === 0 ? 'pl-3' : ''
                } ${cellIndex === row.getVisibleCells().length - 1 ? 'pr-4' : ''}`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

// ==================== EMPTY STATE ====================
function EmptyState({ clearAllFilters }: { clearAllFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <FaEraser className="text-slate-300 mb-6" size={80} />
      <div className="text-3xl font-extrabold text-black select-none tracking-widest">
        Nenhum resultado encontrado
      </div>
      <div className="text-lg text-slate-600 select-none tracking-widest italic font-semibold mb-6">
        Tente ajustar os filtros para encontrar o que procura
      </div>
      <button
        className="group cursor-pointer rounded-md border-none bg-gradient-to-br from-red-600 to-red-700 px-6 py-3 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all hover:scale-110 active:scale-95"
        onClick={clearAllFilters}
      >
        Limpar Filtros
      </button>
    </div>
  );
}
