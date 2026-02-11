// src/app/paginas/chamados/page.tsx

'use client';

import { useMemo, useState } from 'react';
import { FiltrosTabelaChamados, useFiltrosChamado } from './componentes/Filtros_Tabela_Chamados';
import { LayoutPaginaChamados } from './Layout_Pagina_Chamados';
import { ChamadoRowProps } from './tabelas/Colunas_Tabela_Chamados';
import { TabelaChamados } from './tabelas/Tabela_Chamados';

interface TabelaComFiltrosProps {
    onDataChange: (data: ChamadoRowProps[]) => void;
}

function TabelaComFiltros({ onDataChange }: TabelaComFiltrosProps) {
    const filtros = useFiltrosChamado();

    // ✅ Incluir TODOS os filtros na key
    const tableKey = useMemo(() => {
        return [
            filtros.ano,
            filtros.mes,
            filtros.cliente,
            filtros.recurso,
            filtros.status,
            filtros.chamado,
            filtros.entrada,
            filtros.prioridade,
            filtros.classificacao,
            filtros.atribuicao,
            filtros.finalizacao,
            filtros.inicio,
        ].join('-');
    }, [
        filtros.ano,
        filtros.mes,
        filtros.cliente,
        filtros.recurso,
        filtros.status,
        filtros.chamado,
        filtros.entrada,
        filtros.prioridade,
        filtros.classificacao,
        filtros.atribuicao,
        filtros.finalizacao,
        filtros.inicio,
    ]);

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
                <TabelaChamados key={tableKey} onDataChange={onDataChange} />
            </div>
        </div>
    );
}

export default function ChamadosPage() {
    const [dadosChamados, setDadosChamados] = useState<ChamadoRowProps[]>([]);

    return (
        <LayoutPaginaChamados pageTitle="Chamados">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                <FiltrosTabelaChamados dadosChamados={dadosChamados}>
                    <TabelaComFiltros onDataChange={setDadosChamados} />
                </FiltrosTabelaChamados>
            </div>
        </LayoutPaginaChamados>
    );
}
