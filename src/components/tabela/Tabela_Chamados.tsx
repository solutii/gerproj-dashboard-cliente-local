'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaEraser } from 'react-icons/fa';
import { IoCall } from 'react-icons/io5';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { IsError } from '../utils/IsError';
import { IsLoading } from '../utils/IsLoading';
import { ExportaExcelButton } from './Button_Excel';
import { ExportaPDFButton } from './Button_PDF';
import { TableRowProps, columns } from './Colunas_Tabela';
import {
  FiltroHeaderChamados,
  useFiltrosChamados,
} from './Filtro_Header_Tabela';
import { ModalChamado } from './Modal_Chamado';
import { StatusBadge } from './Status_Badge';

// ==================== TIPOS ====================
interface FiltersProps {
  ano: string;
  mes: string;
  cliente?: string;
  recurso?: string;
  status?: string;
}

interface ApiResponse {
  apontamentos: TableRowProps[];
  totalHorasGeral: string;
}

// ==================== CONSTANTES ====================
const PDF_COLUMNS: { key: keyof TableRowProps; label: string }[] = [
  { key: 'chamado_os', label: 'CHAMADO' },
  { key: 'cod_os', label: 'OS' },
  { key: 'dtini_os', label: 'DATA' },
  { key: 'nome_cliente', label: 'CLIENTE' },
  { key: 'status_chamado', label: 'STATUS' },
  { key: 'nome_recurso', label: 'CONSULTOR' },
  { key: 'hrini_os', label: 'HR INÍCIO' },
  { key: 'hrfim_os', label: 'HR FIM' },
  { key: 'total_horas', label: "HR's GASTAS" },
  { key: 'valcli_os', label: 'VALIDAÇÃO' },
  { key: 'obs', label: 'OBSERVAÇÃO' },
];

// ==================== UTILITÁRIOS ====================
const createAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
  'x-is-admin': localStorage.getItem('isAdmin') || 'false',
  'x-user-email': localStorage.getItem('userEmail') || '',
  'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

const parseHorasParaMinutos = (horaStr: string): number => {
  if (!horaStr || horaStr === '-' || horaStr.trim() === '') return 0;

  const str = horaStr.trim().toLowerCase();

  // Formato: "2hs:30min" ou "2h:30min" ou "2hs30min"
  const regexHsMin = /(\d+)\s*h[s]?\s*:?\s*(\d+)\s*min/i;
  const matchHsMin = str.match(regexHsMin);
  if (matchHsMin) {
    const horas = parseInt(matchHsMin[1]) || 0;
    const minutos = parseInt(matchHsMin[2]) || 0;
    return horas * 60 + minutos;
  }

  // Formato: "30min" ou "45 min"
  const regexSoMin = /(\d+)\s*min/i;
  const matchSoMin = str.match(regexSoMin);
  if (matchSoMin) {
    const minutos = parseInt(matchSoMin[1]) || 0;
    return minutos;
  }

  // Formato: "2hs" ou "2h" (sem minutos)
  const regexSoHs = /(\d+)\s*h[s]?$/i;
  const matchSoHs = str.match(regexSoHs);
  if (matchSoHs) {
    const horas = parseInt(matchSoHs[1]) || 0;
    return horas * 60;
  }

  // Formato: "2:30" (HH:MM)
  const regexHHMM = /(\d+):(\d+)/;
  const matchHHMM = str.match(regexHHMM);
  if (matchHHMM) {
    const horas = parseInt(matchHHMM[1]) || 0;
    const minutos = parseInt(matchHHMM[2]) || 0;
    return horas * 60 + minutos;
  }

  return 0;
};

const formatarMinutosParaHoras = (totalMinutos: number): string => {
  if (totalMinutos === 0) return '0h:00min';

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  if (horas === 0) {
    return `${minutos}min`;
  }

  const sufixoHora = horas === 1 ? 'h' : 'hs';

  if (minutos === 0) {
    return `${String(horas).padStart(2, '0')}${sufixoHora}`;
  }

  return `${String(horas).padStart(2, '0')}${sufixoHora}:${String(minutos).padStart(2, '0')}min`;
};

// ==================== FUNÇÃO DE FETCH ====================
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
}): Promise<ApiResponse> => {
  const params = new URLSearchParams({
    ano,
    mes,
    isAdmin: String(isAdmin),
    ...(cliente && { codClienteFilter: cliente }),
    ...(recurso && { codRecursoFilter: recurso }),
    ...(status && { status }),
  });

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  const response = await fetch(`/api/tabela?${params.toString()}`, {
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao carregar chamados');
  }

  return response.json();
};

// ==================== COMPONENTE PRINCIPAL ====================
export default function TabelaChamados({
  ano,
  mes,
  cliente,
  recurso,
  status,
}: FiltersProps) {
  // Contexto
  const { isAdmin, codCliente, isLoggedIn } = useAuth();

  // Estados do modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TableRowProps | null>(null);

  // Estados de filtros
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { columnFilterFn } = useFiltrosChamados();

  // ==================== REACT QUERY ====================
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'chamados',
      ano,
      mes,
      cliente,
      recurso,
      status,
      isAdmin,
      codCliente,
    ],
    queryFn: () =>
      fetchChamados({
        ano,
        mes,
        isAdmin,
        codCliente,
        cliente,
        recurso,
        status,
      }),
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5, // 5 minutos
    retry: 2,
  });

  const data = useMemo(
    () => apiData?.apontamentos ?? [],
    [apiData?.apontamentos],
  );
  const totalHorasGeral = apiData?.totalHorasGeral || '';
  // ==================== CALLBACKS ====================
  const openModal = useCallback((row: TableRowProps) => {
    setSelectedRow(row);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedRow(null);
  }, []);

  const handleSaveValidation = useCallback(
    (updatedRow: TableRowProps) => {
      // Atualiza o cache do React Query
      refetch();
    },
    [refetch],
  );

  const clearAllFilters = useCallback(() => {
    setColumnFilters([]);
  }, []);

  // ==================== MEMOIZAÇÕES ====================

  // 1. Dados corrigidos (texto)
  const dataCorrigida = useMemo(() => {
    return data.map((item) => ({
      ...item,
      obs: corrigirTextoCorrompido(item.obs),
    }));
  }, [data]);

  // 2. Detectar filtros ativos
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

  // 3. APLICAR FILTROS MANUALMENTE
  const dadosFiltrados = useMemo(() => {
    if (!hasActiveFilters) {
      return dataCorrigida;
    }

    return dataCorrigida.filter((row) => {
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
          getValue: (id: string) => row[id as keyof TableRowProps],
        };

        return columnFilterFn(
          fakeRow,
          columnId as string,
          normalizedFilterValue,
        );
      });
    });
  }, [dataCorrigida, columnFilters, hasActiveFilters, columnFilterFn]);

  // 4. Configurar a tabela
  const table = useReactTable<TableRowProps>({
    data: dadosFiltrados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
  });

  // 5. Totais SEM filtros (dados originais)
  const totalChamados = useMemo(() => {
    // Conta chamados únicos (chamado_os)
    const chamadosUnicos = Array.from(
      new Set(data.map((item) => item.chamado_os)),
    ).filter(Boolean);
    return chamadosUnicos.length;
  }, [data]);

  const totalOS = useMemo(() => {
    // Conta O.S. únicas (cod_os)
    return data.length;
  }, [data]);

  const totalRecursos = useMemo(() => {
    const recursos = Array.from(
      new Set(data.map((item) => item.nome_recurso || '')),
    ).filter(Boolean).length;
    return recursos;
  }, [data]);

  const totalHorasSemFiltro = useMemo(() => totalHorasGeral, [totalHorasGeral]);

  // 6. Totais COM filtros
  const totalChamadosFiltrados = useMemo(() => {
    const chamadosUnicos = Array.from(
      new Set(dadosFiltrados.map((item) => item.chamado_os)),
    ).filter(Boolean);
    return chamadosUnicos.length;
  }, [dadosFiltrados]);

  const totalOSFiltrados = useMemo(() => {
    return dadosFiltrados.length;
  }, [dadosFiltrados]);

  const totalRecursosFiltrados = useMemo(() => {
    const recursos = Array.from(
      new Set(dadosFiltrados.map((item) => item.nome_recurso || '')),
    ).filter(Boolean).length;
    return recursos;
  }, [dadosFiltrados]);

  const totalHorasFiltrado = useMemo(() => {
    const totalMinutes = dadosFiltrados.reduce((acc, item) => {
      const minutos = parseHorasParaMinutos(item.total_horas);
      return acc + minutos;
    }, 0);
    return formatarMinutosParaHoras(totalMinutes);
  }, [dadosFiltrados]);

  // 7. Valores para exibição
  const chamadosExibidos = useMemo(() => {
    return hasActiveFilters ? totalChamadosFiltrados : totalChamados;
  }, [hasActiveFilters, totalChamadosFiltrados, totalChamados]);

  const osExibidas = useMemo(() => {
    return hasActiveFilters ? totalOSFiltrados : totalOS;
  }, [hasActiveFilters, totalOSFiltrados, totalOS]);

  const recursosExibidos = useMemo(() => {
    return hasActiveFilters ? totalRecursosFiltrados : totalRecursos;
  }, [hasActiveFilters, totalRecursosFiltrados, totalRecursos]);

  const horasExibidas = useMemo(() => {
    const resultado = hasActiveFilters
      ? totalHorasFiltrado
      : totalHorasSemFiltro;
    return resultado || '0h:00min';
  }, [hasActiveFilters, totalHorasFiltrado, totalHorasSemFiltro]);

  // 8. LOG PARA DEBUG
  useEffect(() => {
    console.log('🔍 DEBUG COMPLETO:', {
      hasActiveFilters,
      columnFilters: columnFilters.map((f) => ({
        id: f.id,
        value: f.value,
        tipo: typeof f.value,
      })),
      dataOriginalLength: data.length,
      dadosFiltradosLength: dadosFiltrados.length,
      tableRowsLength: table.getRowModel().rows.length,
      totalizadores: {
        chamados: chamadosExibidos,
        os: osExibidas,
        recursos: recursosExibidos,
        horas: horasExibidas,
      },
    });
  }, [
    hasActiveFilters,
    columnFilters,
    data.length,
    dadosFiltrados.length,
    table,
    chamadosExibidos,
    osExibidas,
    recursosExibidos,
    horasExibidas,
  ]);

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
        title="Aguarde, buscando dados no servidor"
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
      <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black">
        {/* Cabeçalho */}
        <HeaderSection
          isAdmin={isAdmin}
          totalChamados={totalChamados}
          totalChamadosFiltrados={chamadosExibidos}
          totalOS={totalOS}
          totalOSFiltrados={osExibidas}
          totalRecursos={totalRecursos}
          totalRecursosFiltrados={recursosExibidos}
          horasExibidas={horasExibidas}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          filteredData={dadosFiltrados}
          mes={mes}
          ano={ano}
        />

        {/* Tabela */}
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-purple-500/30 hover:scrollbar-thumb-purple-500/50"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            <table className="w-full border-separate border-spacing-0">
              {/* Header */}
              <TableHeader table={table} />

              {/* Body */}
              <TableBody
                table={table}
                columns={columns}
                openModal={openModal}
                clearAllFilters={clearAllFilters}
              />
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ModalChamado
        isOpen={isModalOpen}
        selectedRow={selectedRow}
        onClose={closeModal}
        onSave={handleSaveValidation}
      />
    </>
  );
}

// ==================== SUBCOMPONENTES ====================

interface HeaderSectionProps {
  isAdmin: boolean;
  totalChamados: number;
  totalChamadosFiltrados: number;
  totalOS: number;
  totalOSFiltrados: number;
  totalRecursos: number;
  totalRecursosFiltrados: number;
  horasExibidas: string;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  filteredData: TableRowProps[];
  mes: string;
  ano: string;
}

function HeaderSection({
  isAdmin,
  totalChamados,
  totalChamadosFiltrados,
  totalOS,
  totalOSFiltrados,
  totalRecursos,
  totalRecursosFiltrados,
  horasExibidas,
  hasActiveFilters,
  clearAllFilters,
  filteredData,
  mes,
  ano,
}: HeaderSectionProps) {
  return (
    <header className="flex flex-col gap-10 bg-purple-900 p-6">
      {/* Título */}
      <div className="flex items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-white/30 shadow-md shadow-black">
          <IoCall className="text-white animate-pulse" size={48} />
        </div>
        <h2 className="text-4xl tracking-widest select-none font-bold text-white">
          TABELA DE DADOS - {mes}/{ano}
        </h2>
      </div>

      {/* Badges e Ações */}
      <div className="flex w-full items-center justify-between gap-4">
        {/* Badges Totalizadores */}
        <div className="flex items-center justify-start flex-1 gap-4">
          <BadgeTotalizador
            label={totalChamadosFiltrados === 1 ? 'Chamado' : 'Chamados'}
            valor={totalChamadosFiltrados}
            valorTotal={hasActiveFilters ? totalChamados : undefined}
          />
          <BadgeTotalizador
            label={totalOSFiltrados === 1 ? 'OS' : "OS's"}
            valor={totalOSFiltrados}
            valorTotal={hasActiveFilters ? totalOS : undefined}
          />
          <BadgeTotalizador
            label={totalRecursosFiltrados === 1 ? 'Consultor' : 'Consultores'}
            valor={totalRecursosFiltrados}
            valorTotal={hasActiveFilters ? totalRecursos : undefined}
          />
          <BadgeTotalizador label="Horas" valor={horasExibidas} />
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-20">
          {/* Botão Limpar Filtros */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              title="Limpar Filtros"
              className="group cursor-pointer rounded-full border-none bg-gradient-to-br from-red-600 to-red-700 px-6 py-4 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all hover:scale-110 active:scale-95"
            >
              <FaEraser
                size={20}
                className="text-white group-hover:scale-110"
              />
            </button>
          )}

          {/* Botões de Exportação */}
          <div className="flex gap-2">
            <ExportaExcelButton
              data={filteredData as any}
              filename={`relatorio_chamados_${mes}_${ano}.xlsx`}
              buttonText=""
              className=""
              disabled={filteredData.length === 0}
            />
            <ExportaPDFButton
              data={filteredData as any}
              fileName={`relatorio_chamados_${mes}_${ano}`}
              title={`Relatório de Chamados - ${mes}/${ano}`}
              columns={PDF_COLUMNS}
              logoUrl="/caminho/para/logo.png"
              footerText="Gerado pelo sistema em"
              className="ml-2"
              disabled={filteredData.length === 0}
            />
          </div>

          {/* Badge Admin */}
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-6 py-2 ring-2 ring-emerald-400/80 shadow-md shadow-black">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"></div>
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

interface BadgeTotalizadorProps {
  label: string;
  valor: string | number;
  valorTotal?: number;
}

function BadgeTotalizador({ label, valor, valorTotal }: BadgeTotalizadorProps) {
  return (
    <div className="group flex items-center gap-2 rounded-md bg-white px-6 py-2 transition-all  shadow-md shadow-black w-[300px]">
      <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500"></div>
      <span className="text-lg tracking-widest font-bold select-none text-black">
        {label}:{' '}
        <span className="text-lg tracking-widest font-bold select-none text-purple-500">
          {valor}
          {valorTotal !== undefined && (
            <span className="ml-1">/{valorTotal}</span>
          )}
        </span>
      </span>
    </div>
  );
}

function TableHeader({ table }: { table: any }) {
  return (
    <thead className="sticky top-0 z-20">
      {table.getHeaderGroups().map((headerGroup: any) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: any) => (
            <th key={header.id} className="bg-teal-700 p-6">
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </th>
          ))}
        </tr>
      ))}

      {/* Filtros */}
      <tr className="shadow-sm shadow-black bg-teal-700">
        {table.getAllColumns().map((column: any) => (
          <th key={column.id} className="py-4 px-2">
            <FiltroHeaderChamados
              value={(column.getFilterValue() as string) ?? ''}
              onChange={(value) => column.setFilterValue(value)}
              columnId={column.id}
            />
          </th>
        ))}
      </tr>
    </thead>
  );
}

interface TableBodyProps {
  table: any;
  columns: any;
  openModal: (row: TableRowProps) => void;
  clearAllFilters: () => void;
}

function TableBody({
  table,
  columns,
  openModal,
  clearAllFilters,
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
    <tbody>
      {rows.map((row: any, rowIndex: number) => (
        <tr
          key={row.id}
          className={`group cursor-pointer transition-all ${
            rowIndex % 2 === 0
              ? 'bg-white hover:bg-blue-100'
              : 'bg-gray-50 hover:bg-blue-100'
          } hover:shadow-lg hover:shadow-purple-500/20`}
          onClick={() => openModal(row.original)}
        >
          {row.getVisibleCells().map((cell: any, cellIndex: number) => (
            <td
              key={cell.id}
              className={`border-b border-slate-200 p-3 transition-all ${
                cellIndex === 0 ? 'pl-6' : ''
              } ${cellIndex === row.getVisibleCells().length - 1 ? 'pr-6' : ''}`}
            >
              {cell.column.id === 'status' ? (
                <StatusBadge status={cell.getValue() as string} />
              ) : (
                <span className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

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
