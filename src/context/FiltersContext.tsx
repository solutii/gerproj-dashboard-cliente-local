// src/context/FiltersContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Define a interface para o estado dos filtros
interface FiltersState {
    ano: number;
    mes: number;
    cliente: string;
    recurso: string;
    status: string;
}

// Define a interface para o contexto dos filtros
interface FiltersContextType {
    filters: FiltersState;
    setFilters: (filters: FiltersState) => void;
    clearFilters: () => void;
}

// Cria o contexto dos filtros, inicialmente indefinido
const FiltersContext = createContext<FiltersContextType | undefined>(undefined);

// Chave para armazenar os filtros no localStorage
const STORAGE_KEY = 'gerproj_filters';

// Função auxiliar para obter o estado inicial dos filtros
const getInitialFilters = (): FiltersState => {
    // Tenta recuperar do localStorage primeiro
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed;
            }
        } catch (error) {
            console.error('❌ Erro ao recuperar filtros do localStorage:', error);
        }
    }

    // Se não houver nada salvo, usa os valores padrão (data atual)
    const hoje = new Date();
    const defaultFilters = {
        ano: hoje.getFullYear(),
        mes: hoje.getMonth() + 1,
        cliente: '',
        recurso: '',
        status: '',
    };

    return defaultFilters;
};

// Componente provedor do contexto dos filtros
export function FiltersProvider({ children }: { children: React.ReactNode }) {
    // Estado dos filtros e função para atualizá-lo
    const [filters, setFilters] = useState<FiltersState>(getInitialFilters());
    const [isInitialized, setIsInitialized] = useState(false);

    // Marca como inicializado após a primeira renderização
    useEffect(() => {
        setIsInitialized(true);
    }, []);

    // Função para limpar os filtros (voltar à data atual, mas manter no localStorage)
    const clearFilters = () => {
        const hoje = new Date();
        const clearedFilters = {
            ano: hoje.getFullYear(),
            mes: hoje.getMonth() + 1,
            cliente: '',
            recurso: '',
            status: '',
        };
        setFilters(clearedFilters);
    };

    // Salva os filtros no localStorage sempre que mudarem (após inicialização)
    useEffect(() => {
        if (!isInitialized) return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (error) {
            console.error('❌ Erro ao salvar filtros no localStorage:', error);
        }
    }, [filters, isInitialized]);

    // DEBUG: Log quando os filtros mudarem
    useEffect(() => {}, [filters]);

    // Retorna o provedor do contexto, disponibilizando os valores e funções
    return (
        <FiltersContext.Provider value={{ filters, setFilters, clearFilters }}>
            {children}
        </FiltersContext.Provider>
    );
}

// Hook customizado para acessar o contexto dos filtros
export function useFilters() {
    const context = useContext(FiltersContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FiltersProvider');
    }
    return context;
}
