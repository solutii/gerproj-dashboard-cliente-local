// src/app/paginas/base-conhecimento/page.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FaBook, FaSearch } from 'react-icons/fa';
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

async function fetchArtigos(): Promise<ArtigosResponse> {
    const response = await fetch('/api/base-conhecimento');
    if (!response.ok) throw new Error('Erro ao carregar a base de conhecimento');
    return response.json();
}

export default function BaseConhecimentoPage() {
    const [busca, setBusca] = useState('');
    const [slugSelecionado, setSlugSelecionado] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['base-conhecimento'],
        queryFn: fetchArtigos,
    });

    const artigosFiltrados = useMemo(() => {
        const artigos = data?.artigos ?? [];
        const termo = busca.trim().toLowerCase();
        if (!termo) return artigos;
        return artigos.filter(
            (a) =>
                a.title.toLowerCase().includes(termo) ||
                a.resumo.toLowerCase().includes(termo) ||
                a.categoria.toLowerCase().includes(termo)
        );
    }, [data, busca]);

    const artigosPorCategoria = useMemo(() => {
        const grupos = new Map<string, ArtigoMeta[]>();
        for (const artigo of artigosFiltrados) {
            const lista = grupos.get(artigo.categoria) ?? [];
            lista.push(artigo);
            grupos.set(artigo.categoria, lista);
        }
        return Array.from(grupos.entries());
    }, [artigosFiltrados]);

    return (
        <LayoutPaginaBaseConhecimento>
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-teal-100 bg-white p-10 shadow-md shadow-black/10">
                {/* Título */}
                <div className="mb-8 flex items-center gap-4">
                    <FaBook className="flex-shrink-0 text-teal-700" size={36} />
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-widest text-black select-none">
                            BASE DE CONHECIMENTO
                        </h1>
                        <p className="text-sm tracking-wider text-gray-400 select-none">
                            Artigos e tutoriais — consulte antes de abrir um chamado.
                        </p>
                    </div>
                </div>

                {/* Busca */}
                <div className="mb-8 flex items-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5">
                    <FaSearch className="text-gray-400" size={16} />
                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por título, categoria ou palavra-chave..."
                        className="w-full text-sm tracking-wider text-black outline-none placeholder:text-gray-400"
                    />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto">
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
                            Nenhum artigo encontrado pra essa busca.
                        </p>
                    )}

                    {artigosPorCategoria.map(([categoria, artigos]) => (
                        <div key={categoria} className="mb-8">
                            <h2 className="mb-3 text-xs font-extrabold tracking-widest text-teal-700 uppercase select-none">
                                {categoria}
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {artigos.map((artigo) => (
                                    <button
                                        key={artigo.slug}
                                        onClick={() => setSlugSelecionado(artigo.slug)}
                                        className="flex cursor-pointer flex-col items-start gap-2 rounded-md border border-gray-200 bg-white p-4 text-left shadow-sm shadow-black transition-all duration-200 hover:-translate-y-1 hover:border-teal-400 hover:shadow-lg hover:shadow-black"
                                    >
                                        <span className="text-sm font-bold tracking-wider text-black">
                                            {artigo.title}
                                        </span>
                                        <span className="line-clamp-2 text-xs tracking-wider text-gray-500">
                                            {artigo.resumo}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
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
