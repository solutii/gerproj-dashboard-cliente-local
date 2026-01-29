// src/app/paginas/chamados/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { FiltrosChamado } from '../../../components/shared/Filtros_Chamado';
import { LayoutPaginaChamados } from './Layout_Pagina_Chamados';
import { ChamadoRowProps } from './tabelas/Colunas_Tabela_Chamados';
import { TabelaChamados } from './tabelas/Tabela_Chamados';

export default function ChamadosPage() {
    const [dadosChamados, setDadosChamados] = useState<ChamadoRowProps[]>([]);

    // ✅ Log para debug
    useEffect(() => {
        console.log('🎯 ChamadosPage: dadosChamados atualizados:', dadosChamados.length);
    }, [dadosChamados]);

    return (
        <LayoutPaginaChamados pageTitle="Chamados">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                <FiltrosChamado dadosChamados={dadosChamados}>
                    <div className="flex h-full flex-col overflow-hidden">
                        <div className="min-h-0 flex-1">
                            <TabelaChamados onDataChange={setDadosChamados} />
                        </div>
                    </div>
                </FiltrosChamado>
            </div>
        </LayoutPaginaChamados>
    );
}
