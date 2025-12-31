// ========== Container_Cards_Metricas.tsx ==========
import { CardHorasContratadasHorasExecutadas } from './Card_Horas_Contratadas_Horas_Executadas';
import { CardMediaHorasChamado } from './Card_Media_Horas_Chamado';
import { CardTotalChamadosOS } from './Card_Total_Chamados_OS';

interface FilterProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
}

export function ContainerCardsMetricas({ filters }: FilterProps) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-10">
            <CardTotalChamadosOS filters={filters} />
            <CardHorasContratadasHorasExecutadas filters={filters} />
            <CardMediaHorasChamado filters={filters} />
        </div>
    );
}
