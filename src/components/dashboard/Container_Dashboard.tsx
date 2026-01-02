import { CardHrsContratadasHrsExecutadas } from './Card_Hrs_Contratadas_Hrs_Executadas';
import { CardTotalChamadosOS } from './Card_Total_Chamados_OS';
import { CardMediaHrsChamadoTarefa } from './CardMediaHrsChamadoTarefa';
import { Graficos } from './Graficos';

interface FilterProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
}

export function ContainerDashboard({ filters }: FilterProps) {
    return (
        <div className="h-full overflow-y-auto border-b-slate-500 px-3 pb-4 sm:px-4 sm:pb-6">
            <div className="flex w-full flex-col gap-6 sm:gap-8 lg:gap-10">
                {/* Cards de métricas */}
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-10">
                        <CardTotalChamadosOS filters={filters} />
                        <CardHrsContratadasHrsExecutadas filters={filters} />
                        <CardMediaHrsChamadoTarefa filters={filters} />
                    </div>
                </div>

                {/* Gráficos */}
                <Graficos filters={filters} />
            </div>
        </div>
    );
}
