'use client';

import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { IoIosArrowDown } from 'react-icons/io';
import { IoClose } from 'react-icons/io5';
import { formatarDataParaBR } from '../../formatters/formatar-data';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { useFiltersStore } from '../../store/useFiltersStore';

// ================================================================================
// INTERFACES
// ================================================================================
interface DropdownFilterProps {
    value: string;
    onChange: (value: string) => void;
    columnId: 'NOME_CLASSIFICACAO' | 'NOME_RECURSO' | 'STATUS_CHAMADO';
}

interface OptionItem {
    cod: string;
    nome: string;
}

// ================================================================================
// FUNÇÕES DE FETCH
// ================================================================================
const createAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
    'x-is-admin': localStorage.getItem('isAdmin') || 'false',
    'x-user-email': localStorage.getItem('userEmail') || '',
    'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

// Função para buscar classificações
async function fetchClassificacoes(params: {
    ano: number;
    mes: number;
    isAdmin: boolean;
    codCliente?: string;
    cliente?: string;
}): Promise<OptionItem[]> {
    const queryParams = new URLSearchParams({
        ano: String(params.ano),
        mes: String(params.mes),
        isAdmin: String(params.isAdmin),
    });
    if (!params.isAdmin && params.codCliente) {
        queryParams.append('codCliente', params.codCliente);
    }
    if (params.cliente) {
        queryParams.append('cliente', params.cliente);
    }
    const response = await fetch(`/api/filtros/classificacoes?${queryParams.toString()}`, {
        headers: createAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Erro ao carregar classificações');
    }
    return response.json();
}
// ===============

// Função para buscar recursos
async function fetchRecursos(params: {
    ano: number;
    mes: number;
    isAdmin: boolean;
    codCliente?: string;
    cliente?: string;
}): Promise<OptionItem[]> {
    const queryParams = new URLSearchParams({
        ano: String(params.ano),
        mes: String(params.mes),
        isAdmin: String(params.isAdmin),
    });

    if (!params.isAdmin && params.codCliente) {
        queryParams.append('codCliente', params.codCliente);
    }

    if (params.cliente) {
        queryParams.append('cliente', params.cliente);
    }

    const response = await fetch(`/api/filtros/recursos?${queryParams.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Erro ao carregar recursos');
    }

    return response.json();
}
// ===============

// Função para buscar status - ATUALIZADA para lidar com strings ou objetos
async function fetchStatus(params: {
    ano: number;
    mes: number;
    isAdmin: boolean;
    codCliente?: string;
    cliente?: string;
}): Promise<OptionItem[]> {
    const queryParams = new URLSearchParams({
        ano: String(params.ano),
        mes: String(params.mes),
        isAdmin: String(params.isAdmin),
    });

    if (!params.isAdmin && params.codCliente) {
        queryParams.append('codCliente', params.codCliente);
    }

    if (params.cliente) {
        queryParams.append('cliente', params.cliente);
    }

    const response = await fetch(`/api/filtros/status?${queryParams.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Erro ao carregar status');
    }

    const data = await response.json();

    //  Normalizar o retorno: se vier array de strings, converter para objetos
    if (Array.isArray(data) && data.length > 0) {
        if (typeof data[0] === 'string') {
            // Se for array de strings, converter para objetos
            return data.map((status: string) => ({
                cod: status,
                nome: status,
            }));
        }
    }

    // Se já vier como objetos, retornar direto
    return data;
}
// ===============

// ================================================================================
// FUNÇÕES AUXILIARES
// ================================================================================
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ================================================================================
// COMPONENTE DROPDOWN COM FILTRO
// ================================================================================
const DropdownWithFilter = memo(({ value, onChange, columnId }: DropdownFilterProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const ano = useFiltersStore((state) => state.filters.ano);
    const mes = useFiltersStore((state) => state.filters.mes);
    const cliente = useFiltersStore((state) => state.filters.cliente);

    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    const codCliente = localStorage.getItem('codCliente') || undefined;

    // Query para buscar dados APENAS DO PERÍODO FILTRADO
    const { data: options = [], isLoading } = useQuery({
        queryKey: [
            columnId === 'NOME_CLASSIFICACAO'
                ? 'classificacao-periodo'
                : columnId === 'NOME_RECURSO'
                  ? 'recursos-periodo'
                  : 'status-periodo',
            ano,
            mes,
            isAdmin,
            codCliente,
            columnId === 'NOME_RECURSO' ||
            columnId === 'STATUS_CHAMADO' ||
            columnId === 'NOME_CLASSIFICACAO'
                ? cliente
                : undefined,
        ],
        queryFn: () => {
            if (!ano || !mes) {
                return [];
            }

            if (columnId === 'NOME_CLASSIFICACAO') {
                return fetchClassificacoes({
                    ano,
                    mes,
                    isAdmin,
                    codCliente,
                });
            } else if (columnId === 'NOME_RECURSO') {
                return fetchRecursos({
                    ano,
                    mes,
                    isAdmin,
                    codCliente,
                    cliente: cliente ?? undefined,
                });
            } else {
                return fetchStatus({
                    ano,
                    mes,
                    isAdmin,
                    codCliente,
                    cliente: cliente ?? undefined,
                });
            }
        },
        enabled: !!ano && !!mes,
        staleTime: 1000 * 60 * 5,
        refetchOnMount: true,
    });
    // =====

    // Função para formatar o nome exibido
    const formatDisplayName = useCallback(
        (fullName: string) => {
            // Primeiro corrige o texto corrompido
            const textoCorrigido = corrigirTextoCorrompido(fullName);

            // Se for status ou classificação, retorna o nome completo corrigido
            if (columnId === 'NOME_CLASSIFICACAO' || columnId === 'STATUS_CHAMADO') {
                return textoCorrigido;
            }

            // Para cliente e recurso, pega apenas os dois primeiros nomes
            const parts = textoCorrigido.trim().split(/\s+/).filter(Boolean);
            return parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
        },
        [columnId]
    );
    // =====

    // Filtrar opções baseado no termo de busca
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) {
            return options;
        }

        const normalizedSearch = normalizeText(searchTerm);
        return options.filter((option) => normalizeText(option.nome).includes(normalizedSearch));
    }, [options, searchTerm]);
    // =====

    // Opção selecionada atualmente
    const selectedOption = useMemo(() => {
        return options.find((opt) => opt.nome === value);
    }, [options, value]);
    // =====

    // Nome exibido formatado
    const displayedName = useMemo(() => {
        if (!selectedOption) return null;
        return formatDisplayName(selectedOption.nome);
    }, [selectedOption, formatDisplayName]);
    // =====

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // =====

    // Focar no input de busca quando abrir
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);
    // =====

    // Manipuladores de eventos
    const handleSelect = useCallback(
        (nome: string) => {
            onChange(nome);
            setIsOpen(false);
            setSearchTerm('');
        },
        [onChange]
    );
    // =====

    // Limpar seleção
    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange('');
            setIsOpen(false);
            setSearchTerm('');
        },
        [onChange]
    );
    // =====

    // Alternar abertura do dropdown
    const handleToggle = useCallback(() => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);
    // =====

    // Placeholders e mensagens
    const placeholder =
        columnId === 'NOME_CLASSIFICACAO'
            ? 'Todas'
            : columnId === 'NOME_RECURSO'
              ? 'Todos'
              : 'Todos';
    // =====

    // Mensagem para lista vazia
    const emptyMessage =
        columnId === 'NOME_CLASSIFICACAO'
            ? 'Nenhuma classificação encontrada'
            : columnId === 'NOME_RECURSO'
              ? 'Nenhum recurso encontrado'
              : 'Nenhum status encontrado';
    // =====

    // Renderização do componente
    return (
        <div ref={dropdownRef} className="relative w-full">
            <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`group relative flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-sm font-bold tracking-widest transition-all hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-pink-600 focus:outline-none active:scale-95 ${
                    value
                        ? 'bg-white text-black ring-2 ring-pink-600'
                        : 'border border-teal-950 bg-teal-900 text-white'
                }`}
            >
                <span className={`truncate ${!value ? 'text-gray-400 italic' : ''}`}>
                    {isLoading ? 'Carregando...' : displayedName || placeholder}
                </span>

                <div className="ml-2 flex items-center gap-1">
                    {value && !isLoading && (
                        <span onClick={handleClear} title="Limpar Filtro">
                            <IoClose
                                size={20}
                                className="text-red-600 transition-all hover:scale-125 active:scale-95"
                            />
                        </span>
                    )}
                    <span
                        className={`transition-all ${isOpen ? 'rotate-180' : ''} ${
                            value ? 'text-gray-800' : 'text-gray-400'
                        }`}
                    >
                        <IoIosArrowDown size={20} />
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md bg-white shadow-lg ring-1 shadow-black ring-black">
                    {/* Campo de busca interno */}
                    <div className="border-b border-slate-200 bg-slate-50 p-2">
                        <div className="relative">
                            <FiSearch
                                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                                size={16}
                            />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full rounded-md border border-slate-300 py-2 pr-3 pl-9 text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Lista de opções */}
                    <div className="scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300 max-h-60 overflow-y-auto">
                        {/* Opção "Todos" */}
                        <button
                            onClick={() => handleSelect('')}
                            className={`w-full px-3 py-2 text-left text-sm font-semibold tracking-widest italic transition-all ${
                                value === ''
                                    ? 'bg-blue-600 text-white'
                                    : 'text-black hover:bg-black hover:text-white'
                            }`}
                        >
                            {placeholder}
                        </button>

                        {/* Opções filtradas */}
                        {isLoading ? (
                            <div className="px-3 py-8 text-center text-sm text-slate-500 italic">
                                Carregando opções...
                            </div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-slate-500 italic">
                                {searchTerm ? 'Nenhum resultado encontrado' : emptyMessage}
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                //  Formata o nome exibido e corrige texto
                                const optionDisplayName = formatDisplayName(option.nome);
                                const tituloCorrigido = corrigirTextoCorrompido(option.nome);

                                return (
                                    <button
                                        key={option.cod}
                                        onClick={() => handleSelect(option.nome)}
                                        className={`w-full px-3 py-2 text-left text-sm font-semibold tracking-widest italic transition-all ${
                                            value === option.nome
                                                ? 'bg-blue-600 text-white'
                                                : 'text-black hover:bg-black hover:text-white'
                                        }`}
                                        title={tituloCorrigido}
                                    >
                                        <div className="truncate">{optionDisplayName}</div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

DropdownWithFilter.displayName = 'DropdownWithFilter';

// ================================================================================
// COMPONENTE PRINCIPAL - WRAPPER ATUALIZADO
// ================================================================================
interface InputFilterProps {
    value: string;
    onChange: (value: string) => void;
    columnId?: string;
}

// Constante fora do componente para evitar recriação
const COLUMN_MAX_LENGTH: Record<string, number> = {
    COD_CHAMADO: 5,
    DATA_CHAMADO: 10,
    PRIOR_CHAMADO: 3,
    ASSUNTO_CHAMADO: 15,
    EMAIL_CHAMADO: 15,
    DTENVIO_CHAMADO: 10,
    CONCLUSAO_CHAMADO: 10,
};

// Função para aplicar máscara de data dd/mm/yyyy
function aplicarMascaraData(value: string): string {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Aplica a máscara progressivamente
    if (numbers.length <= 2) {
        return numbers; // DD
    } else if (numbers.length <= 4) {
        return `${numbers.slice(0, 2)}/${numbers.slice(2)}`; // DD/MM
    } else {
        return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`; // DD/MM/YYYY
    }
}
// ===============

// Input com máscara de data e debounce
const InputFilterDate = memo(
    ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
        const [localValue, setLocalValue] = useState(value);
        const isUserTyping = useRef(false);
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (!isUserTyping.current && value !== localValue) {
                setLocalValue(value);
            }
        }, [value, localValue]);

        const debouncedOnChange = useMemo(
            () =>
                debounce((newValue: string) => {
                    onChange(newValue);
                    isUserTyping.current = false;
                }, 600),
            [onChange]
        );

        useEffect(() => {
            return () => {
                debouncedOnChange.cancel();
            };
        }, [debouncedOnChange]);

        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                isUserTyping.current = true;
                let inputValue = e.target.value;

                // Aplica a máscara de data
                const maskedValue = aplicarMascaraData(inputValue);

                // Limita a 10 caracteres (DD/MM/YYYY)
                const finalValue = maskedValue.slice(0, 10);

                setLocalValue(finalValue);
                debouncedOnChange(finalValue);
            },
            [debouncedOnChange]
        );

        const handleClear = useCallback(() => {
            isUserTyping.current = false;
            setLocalValue('');
            onChange('');
            debouncedOnChange.cancel();

            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }, [onChange, debouncedOnChange]);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClear();
                } else if (e.key === 'Enter') {
                    debouncedOnChange.flush();
                }
            },
            [handleClear, debouncedOnChange]
        );

        return (
            <div className="group relative w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Filtrar..."
                    className={`w-full rounded-md px-3 py-2 text-sm font-bold transition-all select-none placeholder:text-gray-400 placeholder:italic hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-pink-600 focus:outline-none active:scale-95 ${
                        localValue
                            ? 'bg-white text-black ring-2 ring-pink-600'
                            : 'border border-teal-950 bg-teal-900 text-white'
                    }`}
                />

                {localValue && (
                    <button
                        onClick={handleClear}
                        aria-label="Limpar filtro"
                        title="Limpar Filtro"
                        type="button"
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-all"
                    >
                        <IoClose
                            size={20}
                            className="text-red-600 transition-all hover:scale-125 active:scale-95"
                        />
                    </button>
                )}
            </div>
        );
    }
);

InputFilterDate.displayName = 'InputFilterDate';
// ===============================

// Funções para formatação de números com milhares
const InputFilterNumber = memo(
    ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
        const [localValue, setLocalValue] = useState(value);
        const isUserTyping = useRef(false);
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (!isUserTyping.current && value !== localValue) {
                const formattedValue = value ? formatarNumeroMilhar(value) : '';
                setLocalValue(formattedValue);
            }
        }, [value, localValue]);

        const debouncedOnChange = useMemo(
            () =>
                debounce((newValue: string) => {
                    onChange(newValue);
                    isUserTyping.current = false;
                }, 600),
            [onChange]
        );

        useEffect(() => {
            return () => {
                debouncedOnChange.cancel();
            };
        }, [debouncedOnChange]);

        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                isUserTyping.current = true;
                let inputValue = e.target.value;

                const numbersOnly = removerFormatacaoMilhar(inputValue);

                if (numbersOnly.length > 5) return;

                const formattedValue = formatarNumeroMilhar(numbersOnly);

                setLocalValue(formattedValue);

                debouncedOnChange(numbersOnly);
            },
            [debouncedOnChange]
        );

        const handleClear = useCallback(() => {
            isUserTyping.current = false;
            setLocalValue('');
            onChange('');
            debouncedOnChange.cancel();

            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }, [onChange, debouncedOnChange]);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClear();
                } else if (e.key === 'Enter') {
                    debouncedOnChange.flush();
                }
            },
            [handleClear, debouncedOnChange]
        );

        return (
            <div className="group relative w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Filtrar..."
                    className={`w-full rounded-md px-3 py-2 text-sm font-bold transition-all select-none placeholder:text-gray-400 placeholder:italic hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-pink-600 focus:outline-none active:scale-95 ${
                        localValue
                            ? 'bg-white text-black ring-2 ring-pink-600'
                            : 'border border-teal-950 bg-teal-900 text-white'
                    }`}
                />

                {localValue && (
                    <button
                        onClick={handleClear}
                        aria-label="Limpar filtro"
                        title="Limpar Filtro"
                        type="button"
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-all"
                    >
                        <IoClose
                            size={20}
                            className="text-red-600 transition-all hover:scale-125 active:scale-95"
                        />
                    </button>
                )}
            </div>
        );
    }
);

InputFilterNumber.displayName = 'InputFilterNumber';
// ==============================

// Component input para prioridade com formatação P-XXX
const InputFilterPriority = memo(
    ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
        const [localValue, setLocalValue] = useState(value);
        const isUserTyping = useRef(false);
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (!isUserTyping.current && value !== localValue) {
                const formattedValue = value ? formatarPrioridade(value) : '';
                setLocalValue(formattedValue);
            }
        }, [value, localValue]);

        const debouncedOnChange = useMemo(
            () =>
                debounce((newValue: string) => {
                    onChange(newValue);
                    isUserTyping.current = false;
                }, 600),
            [onChange]
        );

        useEffect(() => {
            return () => {
                debouncedOnChange.cancel();
            };
        }, [debouncedOnChange]);

        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                isUserTyping.current = true;
                let inputValue = e.target.value;

                const numbersOnly = removerFormatacaoPrioridade(inputValue);

                if (numbersOnly.length > 3) return;

                const numValue = parseInt(numbersOnly);
                if (numbersOnly && (numValue < 1 || numValue > 100)) return;

                const formattedValue = formatarPrioridade(numbersOnly);

                setLocalValue(formattedValue);

                debouncedOnChange(numbersOnly);
            },
            [debouncedOnChange]
        );

        const handleClear = useCallback(() => {
            isUserTyping.current = false;
            setLocalValue('');
            onChange('');
            debouncedOnChange.cancel();

            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }, [onChange, debouncedOnChange]);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClear();
                } else if (e.key === 'Enter') {
                    debouncedOnChange.flush();
                }
            },
            [handleClear, debouncedOnChange]
        );

        return (
            <div className="group relative w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Filtrar..."
                    className={`w-full rounded-md px-3 py-2 text-sm font-bold transition-all select-none placeholder:text-gray-400 placeholder:italic hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-pink-600 focus:outline-none active:scale-95 ${
                        localValue
                            ? 'bg-white text-black ring-2 ring-pink-600'
                            : 'border border-teal-950 bg-teal-900 text-white'
                    }`}
                />

                {localValue && (
                    <button
                        onClick={handleClear}
                        aria-label="Limpar filtro"
                        title="Limpar Filtro"
                        type="button"
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-all"
                    >
                        <IoClose
                            size={20}
                            className="text-red-600 transition-all hover:scale-125 active:scale-95"
                        />
                    </button>
                )}
            </div>
        );
    }
);

InputFilterPriority.displayName = 'InputFilterPriority';
// ==============================

// Memorizador com debounce para inputs genéricos
const InputFilterWithDebounce = memo(({ value, onChange, columnId }: InputFilterProps) => {
    const [localValue, setLocalValue] = useState(value);
    const isUserTyping = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const maxLength = useMemo(
        () => (columnId ? COLUMN_MAX_LENGTH[columnId] : undefined),
        [columnId]
    );

    useEffect(() => {
        if (!isUserTyping.current && value !== localValue) {
            setLocalValue(value);
        }
    }, [value, localValue]);

    const debouncedOnChange = useMemo(
        () =>
            debounce((newValue: string) => {
                onChange(newValue);
                isUserTyping.current = false;
            }, 600),
        [onChange]
    );

    useEffect(() => {
        return () => {
            debouncedOnChange.cancel();
        };
    }, [debouncedOnChange]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            isUserTyping.current = true;
            let processedValue = e.target.value;

            if (maxLength && processedValue.length > maxLength) {
                processedValue = processedValue.slice(0, maxLength);
            }

            setLocalValue(processedValue);
            debouncedOnChange(processedValue);
        },
        [debouncedOnChange, maxLength]
    );

    const handleClear = useCallback(() => {
        isUserTyping.current = false;
        setLocalValue('');
        onChange('');
        debouncedOnChange.cancel();

        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    }, [onChange, debouncedOnChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClear();
            } else if (e.key === 'Enter') {
                debouncedOnChange.flush();
            }
        },
        [handleClear, debouncedOnChange]
    );

    return (
        <div className="group relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Filtrar..."
                className={`w-full rounded-md px-3 py-2 text-sm font-bold transition-all select-none placeholder:text-gray-400 placeholder:italic hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-pink-600 focus:outline-none active:scale-95 ${
                    localValue
                        ? 'bg-white text-black ring-2 ring-pink-600'
                        : 'border border-teal-950 bg-teal-900 text-white'
                }`}
            />

            {localValue && (
                <button
                    onClick={handleClear}
                    aria-label="Limpar filtro"
                    title="Limpar Filtro"
                    type="button"
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-all"
                >
                    <IoClose
                        size={20}
                        className="text-red-600 transition-all hover:scale-125 active:scale-95"
                    />
                </button>
            )}
        </div>
    );
});

InputFilterWithDebounce.displayName = 'InputFilterWithDebounce';

export const FiltroHeaderChamados = memo(({ value, onChange, columnId }: InputFilterProps) => {
    // Status, Cliente, Recurso e Classificação usam dropdown com busca e API
    if (
        columnId === 'NOME_CLASSIFICACAO' ||
        columnId === 'NOME_RECURSO' ||
        columnId === 'STATUS_CHAMADO'
    ) {
        return (
            <DropdownWithFilter
                value={value}
                onChange={onChange}
                columnId={columnId as 'NOME_CLASSIFICACAO' | 'NOME_RECURSO' | 'STATUS_CHAMADO'}
            />
        );
    }

    //  COD_CHAMADO usa input com separador de milhares
    if (columnId === 'COD_CHAMADO') {
        return <InputFilterNumber value={value} onChange={onChange} />;
    }

    //  PRIOR_CHAMADO usa input com formatação P-
    if (columnId === 'PRIOR_CHAMADO') {
        return <InputFilterPriority value={value} onChange={onChange} />;
    }

    // DATA_CHAMADO usa input com máscara de data
    if (columnId === 'DATA_CHAMADO') {
        return <InputFilterDate value={value} onChange={onChange} />;
    }

    if (columnId === 'DTENVIO_CHAMADO') {
        return <InputFilterDate value={value} onChange={onChange} />;
    }

    if (columnId === 'CONCLUSAO_CHAMADO') {
        return <InputFilterDate value={value} onChange={onChange} />;
    }

    // Outros campos usam input com debounce
    return <InputFilterWithDebounce value={value} onChange={onChange} columnId={columnId} />;
});

FiltroHeaderChamados.displayName = 'FiltroHeaderChamados';

// ================================================================================
// HOOK PERSONALIZADO PARA FUNÇÕES DE FILTRO
// ================================================================================

// Constantes fora do hook para evitar recriação
const DATE_COLUMNS = new Set(['DATA_CHAMADO', 'DTENVIO_CHAMADO', 'CONCLUSAO_CHAMADO']);
const NUMERIC_COLUMNS = new Set(['COD_CHAMADO', 'PRIOR_CHAMADO', 'CLASSIFICACAO_CHAMADO']);
// ===============

// Função para normalizar texto (remover acentos, minúsculas, etc.)
function normalizeTextForFilter(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
// ===============

// Função para formatar número com separador de milhar
function formatarNumeroMilhar(value: string): string {
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    return Number(numbers).toLocaleString('pt-BR');
}
// =====

// Função para remover formatação de milhar
function removerFormatacaoMilhar(value: string): string {
    return value.replace(/\D/g, '');
}
// ====================

//  Função para formatar prioridade como P-XXX
function formatarPrioridade(value: string): string {
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    const limitedNumbers = numbers.slice(0, 3);
    const numValue = parseInt(limitedNumbers);

    if (numValue > 100) return 'P-100';
    if (numValue < 1) return '';

    return `P-${numValue}`;
}
// =====

//  Função para remover formatação de prioridade
function removerFormatacaoPrioridade(value: string): string {
    return value.replace(/\D/g, '');
}
// ====================

// Hook personalizado para filtros de chamados
export const useFiltrosChamados = () => {
    const columnFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        if (!filterValue || filterValue.trim() === '') {
            return true;
        }

        const cellValue = row.getValue(columnId);
        const filterTrimmed = filterValue.trim();

        if (cellValue == null || cellValue === '') {
            return false;
        }

        const cellString = String(cellValue).trim();

        // Tratamento especial para status
        if (columnId === 'STATUS_CHAMADO') {
            const cellUpper = cellString.toUpperCase();
            const filterUpper = filterTrimmed.toUpperCase();
            return cellUpper === filterUpper;
        }

        // Tratamento especial para Cliente, Recurso e Classificação (match exato)
        if (columnId === 'NOME_CLASSIFICACAO' || columnId === 'NOME_RECURSO') {
            return cellString === filterTrimmed;
        }

        // Tratamento especial para DATA_CHAMADO
        if (columnId === 'DATA_CHAMADO') {
            const dataFormatada = formatarDataParaBR(cellString);
            const normalizedCell = dataFormatada.replace(/\D/g, '');
            const normalizedFilter = filterTrimmed.replace(/\D/g, '');
            return normalizedCell.includes(normalizedFilter);
        }

        // Tratamento especial para CONCLUSAO_CHAMADO
        if (columnId === 'CONCLUSAO_CHAMADO') {
            // Se o valor já estiver formatado (DD/MM/YYYY), usa direto
            // Se não, formata primeiro
            const dataFormatada = cellString.includes('/')
                ? cellString
                : formatarDataParaBR(cellString);
            const normalizedCell = dataFormatada.replace(/\D/g, '');
            const normalizedFilter = filterTrimmed.replace(/\D/g, '');
            return normalizedCell.includes(normalizedFilter);
        }

        // Tratamento para campos de data genéricos (outras colunas de data)
        if (DATE_COLUMNS.has(columnId)) {
            const normalizedCell = cellString.replace(/\D/g, '');
            const normalizedFilter = filterTrimmed.replace(/\D/g, '');
            return normalizedCell.startsWith(normalizedFilter);
        }

        // Tratamento para campos numéricos
        if (NUMERIC_COLUMNS.has(columnId)) {
            const cellNumbers = cellString.replace(/\D/g, '');
            const filterNumbers = filterTrimmed.replace(/\D/g, '');

            // Para PRIOR_CHAMADO, usa match exato
            if (columnId === 'PRIOR_CHAMADO') {
                return cellNumbers === filterNumbers;
            }

            // Para outros campos numéricos, usa includes (comportamento parcial)
            return cellNumbers.includes(filterNumbers);
        }

        // Tratamento padrão para texto
        const normalizedCell = normalizeTextForFilter(cellString);
        const normalizedFilter = normalizeTextForFilter(filterTrimmed);

        return normalizedCell.includes(normalizedFilter);
    }, []);

    return { columnFilterFn };
};
