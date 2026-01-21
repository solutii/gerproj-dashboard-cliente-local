// src/app/paginas/chamados/page.tsx
'use client';

import { LayoutTabelaChamados } from '../../../components/chamados/Layout_Tabela_Chamados';
import { TabelaChamados } from '../../../components/chamados/Tabela_Chamados';
import { FiltrosChamado } from '../../../components/shared/Filtros_Chamado';

export default function ChamadosPage() {
    return (
        <LayoutTabelaChamados pageTitle="Chamados">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                <FiltrosChamado>
                    <div className="flex h-full flex-col overflow-hidden">
                        <div className="min-h-0 flex-1">
                            <TabelaChamados />
                        </div>
                    </div>
                </FiltrosChamado>
            </div>
        </LayoutTabelaChamados>
    );
}
