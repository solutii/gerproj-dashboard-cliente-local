'use client';

import { useEffect, useState } from 'react';
import { ChamadoRowProps } from '../../../components/chamados/Colunas_Tabela_Chamados';
import { LayoutTabelaChamados } from '../../../components/chamados/Layout_Tabela_Chamados';
import { TabelaChamados } from '../../../components/chamados/Tabela_Chamados';
import { FiltrosChamado } from '../../../components/shared/Filtros_Chamado';

export default function ChamadosPage() {
    const [dadosChamados, setDadosChamados] = useState<ChamadoRowProps[]>([]);

    // ✅ Log para debug
    useEffect(() => {
        console.log('🎯 ChamadosPage: dadosChamados atualizados:', dadosChamados.length);
    }, [dadosChamados]);

    return (
        <LayoutTabelaChamados pageTitle="Chamados">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                <FiltrosChamado dadosChamados={dadosChamados}>
                    <div className="flex h-full flex-col overflow-hidden">
                        <div className="min-h-0 flex-1">
                            <TabelaChamados onDataChange={setDadosChamados} />
                        </div>
                    </div>
                </FiltrosChamado>
            </div>
        </LayoutTabelaChamados>
    );
}
