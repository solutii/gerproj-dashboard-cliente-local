import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdCalendarMonth, MdFilterAlt } from 'react-icons/md';
import { useDebounce } from 'use-debounce';
import { Relogio } from './Relogio';

// ==================== INTERFACES ====================
interface FiltersProps {
  showRefreshButton?: boolean;
}

interface Cliente {
  cod: string;
  nome: string;
}

interface Recurso {
  cod: string;
  nome: string;
}
// ==================== FUNÇÕES AUXILIARES ====================
// Limita o nome a um número máximo de palavras
function limitarNome(nome: string, maxPalavras: number = 2): string {
  if (!nome) return nome;

  const palavras = nome.trim().split(/\s+/);
  return palavras.slice(0, maxPalavras).join(' ');
}
// ===============

// Processa o nome corrigindo texto corrompido e limitando palavras
function processarNome(nome: string, maxPalavras: number = 2): string {
  const nomeCorrigido = corrigirTextoCorrompido(nome);
  return limitarNome(nomeCorrigido, maxPalavras);
}
// ===============

// ==================== FUNÇÕES DE FETCH ====================
// Fetch para buscar clientes
const fetchClientes = async ({
  mes,
  ano,
  isAdmin,
  codCliente,
}: {
  mes: number;
  ano: number;
  isAdmin: boolean;
  codCliente: string | null;
}): Promise<Cliente[]> => {
  const params = new URLSearchParams();
  params.append('mes', mes.toString());
  params.append('ano', ano.toString());
  params.append('isAdmin', isAdmin.toString());

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  const response = await fetch(`/api/clientes?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Erro ao carregar clientes');
  }

  return response.json();
};
// ===============

// Fetch para buscar recursos
const fetchRecursos = async ({
  mes,
  ano,
  isAdmin,
  codCliente,
  clienteSelecionado,
}: {
  mes: number;
  ano: number;
  isAdmin: boolean;
  codCliente: string | null;
  clienteSelecionado: string;
}): Promise<Recurso[]> => {
  const params = new URLSearchParams();
  params.append('mes', mes.toString());
  params.append('ano', ano.toString());
  params.append('isAdmin', isAdmin.toString());

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  if (isAdmin && clienteSelecionado) {
    params.append('cliente', clienteSelecionado);
  }

  const response = await fetch(`/api/recursos?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Erro ao carregar recursos');
  }

  return response.json();
};
// ===============

// Fetch para buscar status
const fetchStatus = async ({
  mes,
  ano,
  isAdmin,
  codCliente,
  clienteSelecionado,
  recursoSelecionado,
}: {
  mes: number;
  ano: number;
  isAdmin: boolean;
  codCliente: string | null;
  clienteSelecionado: string;
  recursoSelecionado: string;
}): Promise<string[]> => {
  const params = new URLSearchParams();
  params.append('mes', mes.toString());
  params.append('ano', ano.toString());
  params.append('isAdmin', isAdmin.toString());

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }

  if (isAdmin && clienteSelecionado) {
    params.append('cliente', clienteSelecionado);
  }

  if (recursoSelecionado) {
    params.append('recurso', recursoSelecionado);
  }

  const response = await fetch(`/api/status?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Erro ao carregar status');
  }

  return response.json();
};
// ==============

// ==============================================================
// ==================== COMPONENTE PRINCIPAL ====================
// ==============================================================
export function Filtros({ showRefreshButton = false }: FiltersProps) {
  const hoje = new Date();
  const { filters, setFilters } = useFilters();
  const { isAdmin, codCliente } = useAuth();
  const queryClient = useQueryClient();

  // Estados locais - inicializados APENAS com valores do contexto
  const [ano, setAno] = useState(filters.ano);
  const [mes, setMes] = useState(filters.mes);
  const [clienteSelecionado, setClienteSelecionado] = useState(filters.cliente);
  const [recursoSelecionado, setRecursoSelecionado] = useState(filters.recurso);
  const [statusSelecionado, setStatusSelecionado] = useState(filters.status);

  // Flag para controlar se já foi inicializado
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Atualiza os estados locais com os valores do contexto
    setAno(filters.ano);
    setMes(filters.mes);
    setClienteSelecionado(filters.cliente);
    setRecursoSelecionado(filters.recurso);
    setStatusSelecionado(filters.status);

    // Marca como inicializado
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce apenas dos filtros opcionais (não ano/mês)
  const [debouncedClienteSelecionado] = useDebounce(clienteSelecionado, 300);
  const [debouncedRecursoSelecionado] = useDebounce(recursoSelecionado, 300);
  const [debouncedStatusSelecionado] = useDebounce(statusSelecionado, 300);

  // ==================== REACT QUERY - CLIENTES ====================
  const { data: clientesData = [], isLoading: clientesLoading } = useQuery({
    queryKey: ['clientes', mes, ano, isAdmin, codCliente],
    queryFn: () => fetchClientes({ mes, ano, isAdmin, codCliente }),
    enabled: !!(mes && ano && isInitialized),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // ==================== REACT QUERY - RECURSOS ====================
  const { data: recursosData = [], isLoading: recursosLoading } = useQuery({
    queryKey: [
      'recursos',
      mes,
      ano,
      isAdmin,
      codCliente,
      debouncedClienteSelecionado,
    ],
    queryFn: () =>
      fetchRecursos({
        mes,
        ano,
        isAdmin,
        codCliente,
        clienteSelecionado: debouncedClienteSelecionado,
      }),
    enabled: !!(mes && ano && (isAdmin || codCliente) && isInitialized),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // ==================== REACT QUERY - STATUS ====================
  const { data: statusData = [], isLoading: statusLoading } = useQuery({
    queryKey: [
      'status',
      mes,
      ano,
      isAdmin,
      codCliente,
      debouncedClienteSelecionado,
      debouncedRecursoSelecionado,
    ],
    queryFn: () =>
      fetchStatus({
        mes,
        ano,
        isAdmin,
        codCliente,
        clienteSelecionado: debouncedClienteSelecionado,
        recursoSelecionado: debouncedRecursoSelecionado,
      }),
    enabled: !!(mes && ano && (isAdmin || codCliente) && isInitialized),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // ==================== EFEITOS ====================
  // CRITICAL: Atualiza o contexto apenas após inicialização completa
  useEffect(() => {
    if (!isInitialized) return;

    setFilters({
      ano,
      mes,
      cliente: debouncedClienteSelecionado,
      recurso: debouncedRecursoSelecionado,
      status: debouncedStatusSelecionado,
    });
  }, [
    ano,
    mes,
    debouncedClienteSelecionado,
    debouncedRecursoSelecionado,
    debouncedStatusSelecionado,
    isInitialized,
    setFilters,
  ]);

  // Validação de cliente selecionado quando a lista de clientes muda
  useEffect(() => {
    if (!isInitialized) return;

    if (clienteSelecionado && clientesData.length > 0) {
      const clienteExiste = clientesData.some(
        (c) => c.cod === clienteSelecionado,
      );
      if (!clienteExiste) {
        setClienteSelecionado('');
        setRecursoSelecionado('');
        setStatusSelecionado('');
      }
    }
  }, [clientesData, clienteSelecionado, isInitialized]);

  // Sincroniza cliente quando não é admin
  useEffect(() => {
    if (!isInitialized) return;

    if (!isAdmin && codCliente && clientesData.length > 0) {
      setClienteSelecionado(codCliente);
    }
  }, [isAdmin, codCliente, clientesData, isInitialized]);

  // Validação de recurso selecionado quando a lista de recursos muda
  useEffect(() => {
    if (!isInitialized) return;

    if (recursoSelecionado && recursosData.length > 0) {
      const recursoExiste = recursosData.some(
        (r) => r.cod === recursoSelecionado,
      );
      if (!recursoExiste) {
        setRecursoSelecionado('');
        setStatusSelecionado('');
      }
    }
  }, [recursosData, recursoSelecionado, isInitialized]);

  // Validação de status selecionado quando a lista de status muda
  useEffect(() => {
    if (!isInitialized) return;

    if (statusSelecionado && statusData.length > 0) {
      const statusExiste = statusData.includes(statusSelecionado);
      if (!statusExiste) {
        setStatusSelecionado('');
      }
    }
  }, [statusData, statusSelecionado, isInitialized]);

  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    const novoAno = hoje.getFullYear();
    const novoMes = hoje.getMonth() + 1;

    setAno(novoAno);
    setMes(novoMes);
    setClienteSelecionado('');
    setRecursoSelecionado('');
    setStatusSelecionado('');

    // Atualiza o contexto imediatamente
    setFilters({
      ano: novoAno,
      mes: novoMes,
      cliente: '',
      recurso: '',
      status: '',
    });
  };

  // Função para atualizar os dados e limpar os filtros
  const handleRefresh = () => {
    clearAllFilters();
    queryClient.invalidateQueries({ queryKey: ['clientes'] });
    queryClient.invalidateQueries({ queryKey: ['recursos'] });
    queryClient.invalidateQueries({ queryKey: ['status'] });
    queryClient.invalidateQueries({ queryKey: ['tabela-chamados'] });
    queryClient.invalidateQueries({ queryKey: ['tabela-os'] });
  };

  // ==================== CONSTANTES ====================
  const years = [2024, 2025, 2026];
  const months = [
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
  ];

  const isLoading = recursosLoading || statusLoading;

  // ==================== SUBCOMPONENTE ====================
  interface SelectWithClearProps {
    value: string | number;
    onChange: (value: string) => void;
    onClear: () => void;
    disabled?: boolean;
    options: Array<{ value: string | number; label: string }>;
    placeholder: string;
    className?: string;
    showClear?: boolean;
  }

  function SelectWithClear({
    value,
    onChange,
    onClear,
    disabled,
    options,
    placeholder,
    className,
    showClear = true,
  }: SelectWithClearProps) {
    const hasValue = value !== '' && value !== 0;

    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${className} ${hasValue && !disabled && showClear ? 'pr-16' : 'pr-10'}`}
          style={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <option
            value=""
            key="placeholder-option"
            className="select-none text-lg tracking-widest font-semibold"
          >
            {placeholder}
          </option>
          {options.map((opt) => (
            <option
              key={`option-${opt.value}`}
              value={opt.value}
              className="tracking-widest font-semibold select-none"
              title={opt.label}
            >
              {processarNome(opt.label, 2)}
            </option>
          ))}
        </select>

        {showClear && hasValue && !disabled && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="group absolute right-10 top-1/2 -translate-y-1/2 bg-red-500 p-1 rounded-full cursor-pointer hover:scale-125 transition-all active:scale-95 shadow-md shadow-black z-10"
            title="Limpar filtro"
          >
            <IoClose
              size={20}
              className="text-white group-hover:scale-125 group-active:scale-95 transition-all"
            />
          </button>
        )}
      </div>
    );
  }

  // ==================== RENDERIZAÇÃO PRINCIPAL ====================
  return (
    <div className="flex flex-col gap-3">
      {/* Título para desktop */}
      <header className="flex items-center justify-between">
        <div className="flex items-center justify-center gap-4">
          <MdFilterAlt className="text-black" size={32} />
          <h1 className="text-2xl select-none tracking-widest font-extrabold text-black">
            FILTROS
          </h1>
        </div>

        <div className="flex items-center gap-8 mr-4">
          {/* {showRefreshButton && (
            <div>
              <FiRefreshCw
                onClick={handleRefresh}
                title="Atualizar Dados"
                className="cursor-pointer text-blue-500 transition-all hover:scale-125 hover:rotate-180 active:scale-95 mr-7"
                size={32}
              />
            </div>
          )} */}
          <div className="flex items-center justify-center gap-2 text-xl font-extrabold tracking-widest select-none text-black">
            <MdCalendarMonth className="text-black" size={32} />
            {hoje.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          <div>
            <Relogio />
          </div>
        </div>
      </header>

      {/* ========== FILTROS ========== */}
      <div className="grid grid-cols-5 gap-6">
        {/* Ano */}
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
        >
          {years.map((yearOption) => (
            <option
              key={yearOption}
              value={yearOption}
              className="tracking-widest font-semibold select-none"
            >
              {yearOption}
            </option>
          ))}
        </select>

        {/* Mês */}
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
        >
          {months.map((monthName, i) => (
            <option
              key={i}
              value={i + 1}
              className="tracking-widest font-semibold select-none"
            >
              {monthName}
            </option>
          ))}
        </select>

        {/* Cliente */}
        <SelectWithClear
          value={clienteSelecionado}
          onChange={setClienteSelecionado}
          onClear={() => setClienteSelecionado('')}
          disabled={!clientesData.length || !!codCliente || clientesLoading}
          options={clientesData.map((c) => ({ value: c.cod, label: c.nome }))}
          placeholder={
            clientesLoading ? 'Carregando clientes...' : 'Selecione o cliente'
          }
          showClear={!codCliente}
          className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        />

        {/* Recurso */}
        <SelectWithClear
          value={recursoSelecionado}
          onChange={setRecursoSelecionado}
          onClear={() => setRecursoSelecionado('')}
          disabled={!recursosData.length || isLoading}
          options={recursosData.map((r) => ({ value: r.cod, label: r.nome }))}
          placeholder={
            isLoading ? 'Carregando recursos...' : 'Selecione o recurso'
          }
          className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
        />

        {/* Status */}
        <SelectWithClear
          value={statusSelecionado}
          onChange={setStatusSelecionado}
          onClear={() => setStatusSelecionado('')}
          disabled={!statusData.length || isLoading}
          options={statusData.map((s) => ({ value: s, label: s }))}
          placeholder={
            isLoading ? 'Carregando status...' : 'Selecione o status'
          }
          className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
        />
      </div>
    </div>
  );
}
