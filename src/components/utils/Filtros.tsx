import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { formatarHoraSufixo } from '@/formatters/formatar-hora';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdFilterAlt } from 'react-icons/md';
import { useDebounce } from 'use-debounce';

// Interface para as props do componente de filtro
interface FiltersProps {
  onFiltersChange: (filters: {
    ano: number;
    mes: number;
    cliente: string;
    recurso: string;
    status: string;
  }) => void;
}

// Componente principal de filtros do dashboard
export function Filtros({ onFiltersChange }: FiltersProps) {
  // Obtém a data atual
  const hoje = new Date();
  // Hooks de contexto para filtros globais
  const { filters, setFilters } = useFilters();

  // Estados locais para ano e mês selecionados
  const [ano, setAno] = useState(filters.ano || hoje.getFullYear());
  const [mes, setMes] = useState(filters.mes || hoje.getMonth() + 1);

  // Estados para lista de clientes e cliente selecionado
  const [cliente, setCliente] = useState<Array<{ cod: string; nome: string }>>(
    [],
  );
  const [clienteSelecionado, setClienteSelecionado] = useState(
    filters.cliente || '',
  );

  // Estados para lista de recursos e recurso selecionado
  const [recurso, setRecurso] = useState<Array<{ cod: string; nome: string }>>(
    [],
  );
  const [recursoSelecionado, setRecursoSelecionado] = useState(
    filters.recurso || '',
  );

  // Estados para lista de status e status selecionado
  const [status, setStatus] = useState<string[]>([]);
  const [statusSelecionado, setStatusSelecionado] = useState(
    filters.status || '',
  );

  // Estado para indicar carregamento de dados
  const [isLoading, setIsLoading] = useState(false);

  // Debounce dos filtros para evitar chamadas excessivas
  const [debouncedAno] = useDebounce(ano, 300);
  const [debouncedMes] = useDebounce(mes, 300);
  const [debouncedClienteSelecionado] = useDebounce(clienteSelecionado, 300);
  const [debouncedRecursoSelecionado] = useDebounce(recursoSelecionado, 300);
  const [debouncedStatusSelecionado] = useDebounce(statusSelecionado, 300);

  // Obtém informações do usuário autenticado
  const { isAdmin, codCliente } = useAuth();

  // Atualiza o contexto de filtro e notifica o componente pai quando filtros mudam
  useEffect(() => {
    setFilters({
      ano: debouncedAno,
      mes: debouncedMes,
      cliente: debouncedClienteSelecionado,
      recurso: debouncedRecursoSelecionado,
      status: debouncedStatusSelecionado,
    });
    onFiltersChange({
      ano: debouncedAno,
      mes: debouncedMes,
      cliente: debouncedClienteSelecionado,
      recurso: debouncedRecursoSelecionado,
      status: debouncedStatusSelecionado,
    });
  }, [
    debouncedAno,
    debouncedMes,
    debouncedClienteSelecionado,
    debouncedRecursoSelecionado,
    debouncedStatusSelecionado,
    onFiltersChange,
    setFilters,
  ]);

  // -----------------------------------------------------------------------------

  // Efeito para carregar a lista de clientes ao alterar ano/mês/admin/cliente
  useEffect(() => {
    if (mes && ano) {
      setCliente([]);

      if (!codCliente) {
        setClienteSelecionado('');
      }

      setRecurso([]);
      setRecursoSelecionado('');
      setStatus([]);
      setStatusSelecionado('');

      const params = new URLSearchParams();
      params.append('mes', mes.toString());
      params.append('ano', ano.toString());
      params.append('isAdmin', isAdmin.toString());

      if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
      }

      const url = `/api/clientes?${params.toString()}`;

      axios
        .get(url)
        .then((response) => {
          const data = response.data;
          if (Array.isArray(data)) {
            setCliente(data);
          } else {
            console.error('Erro: resposta inesperada ao buscar clientes', data);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar clientes:', err);
        });
    }
  }, [isAdmin, codCliente, mes, ano]);

  // -----------------------------------------------------------------------------

  // Função para carregar a lista de recursos baseada nos filtros atuais
  const carregarRecursos = useCallback(async () => {
    setIsLoading(true);
    setRecurso([]);
    setRecursoSelecionado('');
    setStatus([]);
    setStatusSelecionado('');

    try {
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

      const url = `/api/recursos?${params.toString()}`;

      axios
        .get(url)
        .then((response) => {
          const data = response.data;
          if (Array.isArray(data)) {
            setRecurso(data);
          } else {
            console.error('Erro: resposta inesperada ao buscar recursos', data);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar recursos:', err);
        });
    } catch (err) {
      console.error('Erro ao carregar recursos:', err);
      setRecurso([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, codCliente, mes, ano, clienteSelecionado]);

  // Efeito para carregar recursos quando filtros relevantes mudam
  useEffect(() => {
    const deveCarregarRecursos = mes && ano && (isAdmin || codCliente);

    if (deveCarregarRecursos) {
      carregarRecursos();
    }
  }, [isAdmin, codCliente, mes, ano, clienteSelecionado, carregarRecursos]);

  // -----------------------------------------------------------------------------

  // Função para carregar a lista de status baseada nos filtros atuais
  const carregarStatus = useCallback(async () => {
    setIsLoading(true);
    setStatus([]);
    setStatusSelecionado('');

    try {
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

      const url = `/api/status?${params.toString()}`;

      axios
        .get(url)
        .then((response) => {
          const data = response.data;
          if (Array.isArray(data)) {
            setStatus(data);
          } else {
            console.error('Erro: resposta inesperada ao buscar status', data);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar status:', err);
        });
    } catch (err) {
      console.error('Erro ao carregar status:', err);
      setStatus([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, codCliente, mes, ano, clienteSelecionado, recursoSelecionado]);

  // Efeito para carregar status quando filtros relevantes mudam
  useEffect(() => {
    const deveCarregarRecursos = mes && ano && (isAdmin || codCliente);

    if (deveCarregarRecursos) {
      carregarStatus();
    }
  }, [
    isAdmin,
    codCliente,
    mes,
    ano,
    clienteSelecionado,
    recursoSelecionado,
    carregarStatus,
  ]);

  // -----------------------------------------------------------------------------

  // Lista fixa de anos disponíveis para filtro
  const years = [2024, 2025];

  // Lista fixa de meses disponíveis para filtro
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

  // Adicione este componente helper dentro do arquivo, antes do return:

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
          className={className}
        >
          <option value="" key="placeholder-option">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option
              key={`option-${opt.value}`} // ← ADICIONEI A KEY ÚNICA
              value={opt.value}
              className="tracking-widest font-medium italic select-none"
            >
              {opt.label}
            </option>
          ))}
        </select>

        {showClear && hasValue && !disabled && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="group absolute right-10 top-1/2 -translate-y-1/2 bg-slate-300 p-1 rounded-full hover:bg-red-500 cursor-pointer shadow-sm shadow-black"
            title="Limpar filtro"
          >
            <IoClose
              size={24}
              className="text-black group-hover:text-white group-hover:rotate-180 transition-all"
            />
          </button>
        )}
      </div>
    );
  }

  // Renderização do componente de filtros (mobile e desktop)
  return (
    <div className="mb-6 lg:mb-8 lg:flex-shrink-0">
      {/* Título para desktop */}
      <header className="mb-4 flex items-center justify-between lg:mb-0">
        <div className="flex items-center justify-center gap-4 mb-1">
          <MdFilterAlt className="text-black" size={28} />
          <h1 className=" hidden text-2xl select-none tracking-widest font-extrabold text-black lg:block">
            FILTROS
          </h1>
        </div>

        <span className="text-xl font-extrabold tracking-widest select-none text-black italic">
          {new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
          {' - '}
          {formatarHoraSufixo(
            new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
          )}
        </span>
      </header>

      {/* Filtros para desktop */}
      <div className="hidden lg:block">
        <div className="mb-4 grid grid-cols-5 gap-4">
          {/* Ano */}
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            {years.map((yearOption) => (
              <option
                key={yearOption}
                value={yearOption}
                className="tracking-widest font-medium italic select-none"
              >
                {yearOption}
              </option>
            ))}
          </select>
          {/* ===== */}

          {/* Mês */}
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            {months.map((monthName, i) => (
              <option
                key={i}
                value={i + 1}
                className="tracking-widest font-medium italic select-none"
              >
                {monthName}
              </option>
            ))}
          </select>
          {/* ===== */}

          {/* Cliente */}
          <SelectWithClear
            value={clienteSelecionado}
            onChange={setClienteSelecionado}
            onClear={() => setClienteSelecionado('')}
            disabled={!cliente.length || !!codCliente}
            options={cliente.map((c) => ({ value: c.cod, label: c.nome }))}
            placeholder="Selecione o cliente"
            showClear={!codCliente}
            className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-slate-300"
          />

          <SelectWithClear
            value={recursoSelecionado}
            onChange={setRecursoSelecionado}
            onClear={() => setRecursoSelecionado('')}
            disabled={!recurso.length || isLoading}
            options={recurso.map((r) => ({ value: r.cod, label: r.nome }))}
            placeholder={
              isLoading ? 'Carregando recursos...' : 'Selecione o recurso'
            }
            className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-slate-300"
          />

          {/* Status */}
          <SelectWithClear
            value={statusSelecionado}
            onChange={setStatusSelecionado}
            onClear={() => setStatusSelecionado('')}
            disabled={!status.length || isLoading}
            options={status.map((s) => ({ value: s, label: s }))}
            placeholder={
              isLoading ? 'Carregando status...' : 'Selecione o status'
            }
            className="w-full cursor-pointer rounded-md tracking-widest font-extrabold text-lg select-none border p-3 shadow-md shadow-black transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
