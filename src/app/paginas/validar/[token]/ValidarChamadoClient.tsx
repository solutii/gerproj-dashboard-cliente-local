// src/app/paginas/validar/[token]/ValidarChamadoClient.tsx

'use client';

import { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { alertConfirm, alertError, alertSuccess } from '@/store/useAlertDialogStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import { FaCalendar, FaClock, FaHashtag, FaUser } from 'react-icons/fa';
import { FaFileWaveform, FaRegCircleCheck, FaRegCircleXmark } from 'react-icons/fa6';

interface OSResponse {
    success: boolean;
    codChamado: number;
    dataChamado: string | null;
    chamadoFinalizado?: boolean;
    data: OSRowProps[];
}

async function fetchOS(codChamado: number, token: string): Promise<OSResponse> {
    const response = await fetch(
        `/api/chamados/${codChamado}/os?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.error ?? 'Erro ao buscar OS do chamado');
    }
    return response.json();
}

interface ValidarChamadoClientProps {
    token: string;
    codChamado: number;
    codCliente: string;
}

export function ValidarChamadoClient({ token, codChamado, codCliente }: ValidarChamadoClientProps) {
    const queryClient = useQueryClient();
    const [validandoTudo, setValidandoTudo] = useState(false);

    const queryKey = useMemo(
        () => ['validar-os', codChamado, codCliente],
        [codChamado, codCliente]
    );
    const { data, isLoading, isError, error } = useQuery({
        queryKey,
        queryFn: () => fetchOS(codChamado, token),
    });

    const handleValidarTudo = useCallback(async () => {
        if (validandoTudo) return;
        const qtdReprovadas = data?.data.filter((os) => os.VALCLI_OS === 'NAO').length ?? 0;
        const mensagem =
            qtdReprovadas > 0
                ? `Este chamado tem ${qtdReprovadas} OS reprovada${qtdReprovadas > 1 ? 's' : ''}. Ao validar, TODAS as OS serão aprovadas e ${qtdReprovadas > 1 ? 'as reprovações serão desfeitas' : 'a reprovação será desfeita'}. Para contestar alguma OS, acesse o portal. Confirma?`
                : 'Isso vai aprovar TODAS as OS deste chamado. Confirma?';
        const confirmado = await alertConfirm(mensagem, {
            title: 'Validar chamado',
            confirmText: 'Sim, aprovar tudo',
        });
        if (!confirmado) return;

        setValidandoTudo(true);
        try {
            const res = await fetch(`/api/chamados/${codChamado}/validar-tudo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? 'Erro ao validar chamado');
            }
            alertSuccess('Chamado validado com sucesso!');
            await queryClient.invalidateQueries({ queryKey });
        } catch (err) {
            alertError(err instanceof Error ? err.message : 'Erro ao validar chamado');
        } finally {
            setValidandoTudo(false);
        }
    }, [validandoTudo, data, codChamado, token, queryClient, queryKey]);

    return (
        <div className="min-h-screen bg-stone-100 pb-16">
            <header className="flex items-center justify-between gap-3 bg-teal-700 px-4 py-3 shadow-md shadow-black sm:px-8">
                <div className="flex items-center gap-3">
                    <FaFileWaveform className="flex-shrink-0 text-white" size={26} />
                    <div className="flex flex-col tracking-wide text-white select-none">
                        <h1 className="text-base font-extrabold sm:text-lg">
                            VALIDAÇÃO DE CHAMADO
                        </h1>
                        <p className="text-xs font-semibold text-teal-100">
                            Nº {String(codChamado).padStart(5, '0')}
                        </p>
                    </div>
                </div>
                <Image
                    src="/logo-solutii.png"
                    alt="Solutii"
                    width={32}
                    height={32}
                    priority
                    className="rounded-md"
                />
            </header>

            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-8">
                {isLoading && (
                    <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                        Carregando OS's do chamado...
                    </p>
                )}

                {isError && (
                    <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                        {error instanceof Error ? error.message : 'Erro ao carregar OS do chamado.'}
                    </p>
                )}

                {data && data.data.length === 0 && (
                    <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                        Nenhuma OS encontrada para este chamado.
                    </p>
                )}

                {data?.chamadoFinalizado && (
                    <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold tracking-wide text-emerald-800 select-none">
                        Este chamado já foi validado e está finalizado. A avaliação está disponível
                        somente para consulta.
                    </p>
                )}

                {data && data.data.length > 0 && (
                    <>
                        {!data.chamadoFinalizado && (
                            <button
                                type="button"
                                onClick={handleValidarTudo}
                                disabled={validandoTudo}
                                className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-2 text-xs font-extrabold tracking-wide text-white shadow-sm shadow-black transition-all duration-200 select-none hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600 hover:shadow-md hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FaRegCircleCheck size={14} />
                                {validandoTudo
                                    ? 'Validando...'
                                    : 'Validar chamado (aprovar todas as OS)'}
                            </button>
                        )}

                        {!data.chamadoFinalizado && (
                            <p className="text-xs font-semibold tracking-wide text-gray-500 select-none">
                                Confira as OS abaixo. Para contestar alguma OS, acesse o portal ou
                                fale com o consultor responsável.
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            {data.data.map((os) => (
                                <OSItem key={os.COD_OS} os={os} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function OSItem({ os }: { os: OSRowProps }) {
    const validada = os.VALCLI_OS === 'SIM' || os.VALCLI_OS === 'NAO';

    return (
        <div className="flex flex-col gap-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm shadow-black/10">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <Campo icon={FaHashtag} label="OS" value={formatarNumeros(os.NUM_OS)} />
                <Campo icon={FaCalendar} label="Data" value={formatarDataParaBR(os.DTINI_OS)} />
                <Campo
                    icon={FaClock}
                    label="Horário"
                    value={`${formatarHora(os.HRINI_OS)} - ${formatarHora(os.HRFIM_OS)}`}
                />
                <Campo
                    icon={FaClock}
                    label="Total"
                    value={formatarHorasTotaisSufixo(os.TOTAL_HORAS_OS)}
                />
                <Campo icon={FaUser} label="Consultor" value={os.NOME_RECURSO ?? '-'} />
            </div>

            {os.OBS && <p className="text-xs font-medium text-gray-600">{os.OBS}</p>}

            {validada && (
                <div className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1">
                    {os.VALCLI_OS === 'SIM' ? (
                        <FaRegCircleCheck className="flex-shrink-0 text-emerald-600" size={13} />
                    ) : (
                        <FaRegCircleXmark className="flex-shrink-0 text-red-600" size={13} />
                    )}
                    <span className="text-xs font-bold text-gray-600 select-none">
                        {os.VALCLI_OS === 'SIM' ? 'Aprovada' : 'Reprovada'}
                        {os.OBSCLI_OS ? ` — ${os.OBSCLI_OS}` : ''}
                    </span>
                </div>
            )}
        </div>
    );
}

function Campo({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <Icon className="flex-shrink-0 text-gray-400" size={11} />
            <span className="text-[11px] font-semibold tracking-wide text-gray-500 select-none">
                {label}:
            </span>
            <span className="text-xs font-bold text-black select-none">{value}</span>
        </div>
    );
}
