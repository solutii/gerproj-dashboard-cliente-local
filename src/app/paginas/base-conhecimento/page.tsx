// src/app/paginas/base-conhecimento/page.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import { FaBook, FaChartBar, FaHeadset, FaSearch } from 'react-icons/fa';
import { LayoutPaginaBaseConhecimento } from './Layout_Pagina_Base_Conhecimento';
import { ModalArtigoBaseConhecimento } from './modais/Modal_Artigo_Base_Conhecimento';

interface ArtigoMeta {
    slug: string;
    title: string;
    categoria: string;
    resumo: string;
}

interface ArtigosResponse {
    success: boolean;
    artigos: ArtigoMeta[];
}

interface CategoriaConfig {
    icon: IconType;
    iconBg: string;
    iconColor: string;
    tagColor: string;
    chipBorder: string;
}

// Estilo por categoria (ícone + cor) — categoria fora dessa lista cai no padrão.
const CATEGORIA_CONFIG: Record<string, CategoriaConfig> = {
    'Portal do Cliente': {
        icon: FaHeadset,
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-700',
        tagColor: 'text-teal-700',
        chipBorder: 'border-teal-700 bg-teal-700 text-white',
    },
    Dashboard: {
        icon: FaChartBar,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-700',
        tagColor: 'text-indigo-700',
        chipBorder: 'border-indigo-700 bg-indigo-700 text-white',
    },
};

const CATEGORIA_PADRAO: CategoriaConfig = {
    icon: FaBook,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    tagColor: 'text-gray-600',
    chipBorder: 'border-gray-700 bg-gray-700 text-white',
};

const getCategoriaConfig = (categoria: string): CategoriaConfig =>
    CATEGORIA_CONFIG[categoria] ?? CATEGORIA_PADRAO;

async function fetchArtigos(): Promise<ArtigosResponse> {
    const response = await fetch('/api/base-conhecimento');
    if (!response.ok) throw new Error('Erro ao carregar a base de conhecimento');
    return response.json();
}

export default function BaseConhecimentoPage() {
    const [busca, setBusca] = useState('');
    const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
    const [slugSelecionado, setSlugSelecionado] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['base-conhecimento'],
        queryFn: fetchArtigos,
    });

    const artigos = useMemo(() => data?.artigos ?? [], [data]);

    // Contagem por categoria não é afetada pela busca — só pelo filtro de chip,
    // pra sempre refletir o total real de cada categoria.
    const categorias = useMemo(() => {
        const contagem = new Map<string, number>();
        for (const artigo of artigos) {
            contagem.set(artigo.categoria, (contagem.get(artigo.categoria) ?? 0) + 1);
        }
        return Array.from(contagem.entries());
    }, [artigos]);

    const artigosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return artigos.filter((a) => {
            if (categoriaSelecionada && a.categoria !== categoriaSelecionada) return false;
            if (!termo) return true;
            return (
                a.title.toLowerCase().includes(termo) ||
                a.resumo.toLowerCase().includes(termo) ||
                a.categoria.toLowerCase().includes(termo)
            );
        });
    }, [artigos, busca, categoriaSelecionada]);

    return (
        <LayoutPaginaBaseConhecimento>
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-teal-100 bg-white shadow-md shadow-black/10">
                {/* ========== HERO ========== */}
                <div className="relative flex flex-shrink-0 flex-col items-center gap-3 rounded-t-xl bg-gradient-to-br from-teal-700 to-teal-800 px-6 pt-10 pb-16 text-center sm:px-10">
                    <div className="flex items-center gap-3">
                        <FaBook className="text-white" size={26} />
                        <h1 className="text-xl font-extrabold tracking-widest text-white select-none sm:text-2xl">
                            BASE DE CONHECIMENTO
                        </h1>
                    </div>
                    <p className="text-sm tracking-wider text-teal-100 select-none">
                        Artigos e tutoriais — consulte antes de abrir um chamado.
                    </p>
                </div>

                {/* Busca — sobreposta na borda inferior do hero */}
                <div className="relative z-10 -mt-7 flex justify-center px-6 sm:px-10">
                    <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-lg shadow-black/20">
                        <FaSearch className="flex-shrink-0 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar por título, categoria ou palavra-chave..."
                            className="w-full text-sm tracking-wider text-black outline-none placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* ========== CONTEÚDO ========== */}
                <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-8 pb-10 sm:px-10">
                    {/* Chips de categoria (filtro) */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setCategoriaSelecionada(null)}
                            className={`cursor-pointer rounded-full border px-5 py-2 text-xs font-bold tracking-wider transition-all select-none ${
                                categoriaSelecionada === null
                                    ? 'border-teal-700 bg-teal-700 text-white'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                        >
                            Todos ({artigos.length})
                        </button>
                        {categorias.map(([categoria, count]) => {
                            const config = getCategoriaConfig(categoria);
                            const Icon = config.icon;
                            const isSelected = categoriaSelecionada === categoria;
                            return (
                                <button
                                    key={categoria}
                                    onClick={() =>
                                        setCategoriaSelecionada(isSelected ? null : categoria)
                                    }
                                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wider transition-all select-none ${
                                        isSelected
                                            ? config.chipBorder
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                    }`}
                                >
                                    <Icon size={13} />
                                    {categoria} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {isLoading && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Carregando artigos...
                        </p>
                    )}

                    {isError && (
                        <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                            Erro ao carregar a base de conhecimento.
                        </p>
                    )}

                    {data && artigosFiltrados.length === 0 && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Nenhum artigo encontrado.
                        </p>
                    )}

                    {/* Grade de cards */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {artigosFiltrados.map((artigo) => {
                            const config = getCategoriaConfig(artigo.categoria);
                            const Icon = config.icon;
                            return (
                                <button
                                    key={artigo.slug}
                                    onClick={() => setSlugSelecionado(artigo.slug)}
                                    className="flex cursor-pointer flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-black/15"
                                >
                                    <div
                                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}
                                    >
                                        <Icon className={config.iconColor} size={20} />
                                    </div>
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        <span className="text-base font-bold tracking-wide text-black">
                                            {artigo.title}
                                        </span>
                                        <span className="line-clamp-2 text-sm tracking-wide text-gray-500">
                                            {artigo.resumo}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                                        <span
                                            className={`text-[11px] font-bold tracking-widest uppercase select-none ${config.tagColor}`}
                                        >
                                            {artigo.categoria}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ModalArtigoBaseConhecimento
                isOpen={!!slugSelecionado}
                slug={slugSelecionado}
                onClose={() => setSlugSelecionado(null)}
            />
        </LayoutPaginaBaseConhecimento>
    );
}
