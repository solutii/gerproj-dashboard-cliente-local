// src/store/useFiltersStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define a interface para o estado dos filtros
interface FiltersState {
    ano: number;
    mes: number;
    cliente: string;
    recurso: string;
    status: string;
}

// Define a interface para a store completa
interface FiltersStore {
    filters: FiltersState;
    setFilters: (filters: FiltersState) => void;
    clearFilters: () => void;
}

// Função auxiliar para obter os filtros padrão
const getDefaultFilters = (): FiltersState => {
    const hoje = new Date();
    return {
        ano: hoje.getFullYear(),
        mes: hoje.getMonth() + 1,
        cliente: '',
        recurso: '',
        status: '',
    };
};

// Cria a store do Zustand com persistência no localStorage
export const useFiltersStore = create<FiltersStore>()(
    persist(
        (set) => ({
            // Estado inicial
            filters: getDefaultFilters(),

            // Função para atualizar os filtros
            setFilters: (filters) => set({ filters }),

            // Função para limpar os filtros (volta à data atual)
            clearFilters: () => set({ filters: getDefaultFilters() }),
        }),
        {
            name: 'gerproj_filters', // Chave no localStorage
        }
    )
);
