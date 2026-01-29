// src/app/paginas/chamados/page.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiltrosTabelaChamados, useFiltrosChamado } from './componentes/Filtros_Tabela_Chamados';
import { LayoutPaginaChamados } from './Layout_Pagina_Chamados';
import { ChamadoRowProps } from './tabelas/Colunas_Tabela_Chamados';
import { TabelaChamados } from './tabelas/Tabela_Chamados';

// ✅ CRIE UM COMPONENTE INTERNO QUE USA O CONTEXTO
function TabelaComFiltros() {
    const [dadosChamados, setDadosChamados] = useState<ChamadoRowProps[]>([]);
    const filtros = useFiltrosChamado();

    // ✅ Crie uma key única baseada nos filtros
    const tableKey = useMemo(() => {
        return `${filtros.ano}-${filtros.mes}-${filtros.cliente}-${filtros.recurso}-${filtros.status}-${Date.now()}`;
    }, [filtros.ano, filtros.mes, filtros.cliente, filtros.recurso, filtros.status]);

    useEffect(() => {
        console.log('🎯 ChamadosPage: dadosChamados atualizados:', dadosChamados.length);
        console.log('🔑 Table Key:', tableKey);
    }, [dadosChamados, tableKey]);

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
                <TabelaChamados
                    key={tableKey} // ✅ FORÇA RE-RENDER
                    onDataChange={setDadosChamados}
                />
            </div>
        </div>
    );
}

export default function ChamadosPage() {
    return (
        <LayoutPaginaChamados pageTitle="Chamados">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                <FiltrosTabelaChamados dadosChamados={[]}>
                    <TabelaComFiltros />
                </FiltrosTabelaChamados>
            </div>
        </LayoutPaginaChamados>
    );
}
