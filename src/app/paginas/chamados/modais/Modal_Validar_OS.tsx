// src/app/paginas/chamados/modais/Modal_Validar_OS.tsx

'use client';

import { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { LoadingButton } from '@/components/shared/Loading_Button';
import { useAuth } from '@/context/AuthContext';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { removerAcentos } from '@/formatters/remover-acentuacao';
import { useMutation, useQueryClient } from '@tanstack/react-query';
// =====================================================
import { memo, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BsChatSquareTextFill } from 'react-icons/bs';
import { FaCalendar, FaClock, FaHashtag, FaUser } from 'react-icons/fa';
import {
    FaFileWaveform,
    FaRegCircleCheck,
    FaRegCirclePause,
    FaRegCirclePlay,
    FaRegCircleRight,
    FaRegCircleUser,
    FaRegCircleXmark,
} from 'react-icons/fa6';
import { IoIosSave } from 'react-icons/io';
import { IoClose } from 'react-icons/io5';
import { LuTriangleAlert } from 'react-icons/lu';
// ==========

interface ModalDataProps {
    concordaPagar: boolean;
    observacao: string;
}
// ==========

interface ModalValidacaoOSProps {
    isOpen: boolean;
    selectedRow: OSRowProps | null;
    onClose: () => void;
    onSave: (updatedRow: OSRowProps) => void;
}
// ==========

//  ================== CONFIGURAÇÃO DE STATUS ====================
const STATUS_CONFIG = {
    finalizado: {
        icon: FaRegCircleCheck,
        color: 'text-emerald-700',
        bg: 'bg-emerald-100',
        border: 'border-emerald-500',
    },
    'aguardando validacao': {
        icon: FaRegCirclePlay,
        color: 'text-purple-700',
        bg: 'bg-purple-100',
        border: 'border-purple-500',
    },
    atribuido: {
        icon: FaRegCircleRight,
        color: 'text-pink-700',
        bg: 'bg-pink-100',
        border: 'border-pink-500',
    },
    standby: {
        icon: FaRegCirclePause,
        color: 'text-amber-700',
        bg: 'bg-amber-100',
        border: 'border-amber-500',
    },
    'em atendimento': {
        icon: FaRegCircleUser,
        color: 'text-blue-700',
        bg: 'bg-blue-100',
        border: 'border-blue-500',
    },
} as const;
// ==========

//
const DEFAULT_STATUS = {
    icon: FaRegCircleXmark,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-500',
};
// ====================

// Função para obter o ícone e cores com base no status
const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    const matchedStatus = Object.keys(STATUS_CONFIG).find(
        (key) => statusLower.includes(key) || key.includes(statusLower)
    );
    return matchedStatus
        ? STATUS_CONFIG[matchedStatus as keyof typeof STATUS_CONFIG]
        : DEFAULT_STATUS;
};
// ===================

// Componente memoizado para o StatusBadge
const StatusBadge = memo(({ status }: { status: string }) => {
    const { icon: Icon, color, bg, border } = getStatusIcon(status);

    return (
        <div
            className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-bold tracking-widest select-none ${bg} ${color} ${border}`}
        >
            <Icon className="mr-2 h-4 w-4" />
            {status}
        </div>
    );
});

StatusBadge.displayName = 'StatusBadge';
// ===================

// Função para obter os primeiros dois nomes de um nome completo
const getPrimeirosDoisNomes = (nomeCompleto: string): string => {
    if (!nomeCompleto) return '---------------';
    const nomes = nomeCompleto.trim().split(' ');
    return nomes.slice(0, 2).join(' ');
};
// ===================

// Componente memoizado para o InfoCard
const InfoCard = memo(
    ({
        icon: Icon,
        label,
        value,
        fullWidth = false,
        span = 1,
        tooltip = false,
        fullValue,
        minHeight,
        maxHeight,
    }: {
        icon: any;
        label: string;
        value: string;
        fullWidth?: boolean;
        span?: 1 | 2 | 3 | 4;
        tooltip?: boolean;
        fullValue?: string;
        minHeight?: string;
        maxHeight?: string;
    }) => {
        const [isTruncated, setIsTruncated] = useState(false);

        const contentRef = useCallback(
            (node: HTMLDivElement | null) => {
                if (node && tooltip) {
                    // Para texto de largura completa, verifica se está truncado verticalmente
                    if (fullWidth) {
                        const isOverflowing = node.scrollHeight > node.clientHeight;
                        setIsTruncated(isOverflowing);
                    } else {
                        // Para texto em uma linha, verifica se está truncado horizontalmente
                        const isOverflowing = node.scrollWidth > node.clientWidth;
                        setIsTruncated(isOverflowing);
                    }
                }
            },
            [fullWidth, tooltip]
        );

        // Mapeamento explícito das classes
        const spanClass = fullWidth
            ? 'col-span-full'
            : span === 2
              ? 'col-span-2'
              : span === 3
                ? 'col-span-3'
                : span === 4
                  ? 'col-span-4'
                  : '';

        // Só adiciona cursor-help se tooltip estiver habilitado E o texto estiver truncado
        const shouldShowTooltip = tooltip && isTruncated && fullValue;

        return (
            <div
                className={`group relative rounded-md border-t border-gray-200 bg-white p-6 shadow-sm shadow-black transition-all duration-200 ${spanClass}`}
                style={{ minHeight, maxHeight }}
            >
                <div className="mb-2 flex items-center gap-2">
                    <Icon className="text-black" size={14} />
                    <span className="text-sm font-bold tracking-widest text-black select-none">
                        {label}
                    </span>
                </div>
                <div
                    ref={contentRef}
                    className={`text-justify font-bold tracking-widest text-black select-none ${
                        fullWidth
                            ? 'line-clamp-5 break-words whitespace-normal'
                            : 'truncate overflow-hidden whitespace-nowrap'
                    } ${shouldShowTooltip ? 'cursor-help' : ''}`}
                    title={shouldShowTooltip ? fullValue : undefined}
                >
                    {value}
                </div>
            </div>
        );
    }
);

InfoCard.displayName = 'InfoCard';
// ===================

// Função para salvar a validação via API
const saveValidationApi = async ({
    cod_os,
    concordaPagar,
    observacao,
}: {
    cod_os: string | number;
    concordaPagar: boolean;
    observacao: string | null;
}) => {
    const response = await fetch('/api/salvar-validacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cod_os,
            concordaPagar,
            observacao: observacao ? removerAcentos(observacao) : null,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar validação');
    }

    return response.json();
};
// ===================

// ==================== COMPONENTE PRINCIPAL ====================
export function ModalValidarOS({ isOpen, selectedRow, onClose, onSave }: ModalValidacaoOSProps) {
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();

    // Estados locais
    const [modalData, setModalData] = useState<ModalDataProps>({
        concordaPagar: true,
        observacao: '',
    });
    const [validationError, setValidationError] = useState('');
    // ====================

    // Mutação para salvar a validação
    const saveValidationMutation = useMutation({
        mutationFn: saveValidationApi,
        onSuccess: async (variables) => {
            if (selectedRow) {
                const updatedRow: OSRowProps = {
                    ...selectedRow,
                    VALCLI_OS: variables.concordaPagar ? 'SIM' : 'NAO',
                };

                await queryClient.invalidateQueries({
                    queryKey: ['modal-os-lista'],
                    exact: false,
                    refetchType: 'active',
                });

                onSave(updatedRow);
            }

            toast.success('Validação salva com sucesso!');

            setTimeout(() => {
                setModalData({ concordaPagar: true, observacao: '' });
                setValidationError('');
                onClose();
            }, 1000);
        },
        onError: (error: Error) => {
            console.error('Erro ao processar validação:', error);
            toast.error(`Erro ao salvar validação: ${error.message}`);
        },
    });
    // ====================

    // Handler para mudança do radio
    const handleRadioChange = useCallback((approved: boolean) => {
        setModalData((prev) => ({
            ...prev,
            concordaPagar: approved,
        }));
        if (approved) setValidationError('');
    }, []);
    // ===================

    // Handler para mudança na observação
    const handleObservacaoChange = useCallback((value: string) => {
        const trimmed = value.replace(/^\s+/, '');
        const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

        setModalData((prev) => ({
            ...prev,
            observacao: formatted,
        }));
    }, []);
    // ===================

    // Validação do formulário antes de salvar
    const validateForm = useCallback((): boolean => {
        if (!modalData.concordaPagar && modalData.observacao.trim() === '') {
            setValidationError('.');
            return false;
        }
        setValidationError('');
        return true;
    }, [modalData.concordaPagar, modalData.observacao]);
    // ===================

    // Handler para fechar o modal
    const handleClose = useCallback(() => {
        if (saveValidationMutation.isPending) return;

        if (!modalData.concordaPagar && modalData.observacao.trim() === '') {
            setValidationError(
                'Em caso de OS Reprovada, informe o motivo no campo de observação para salvar a validação ou fechar o formulário.'
            );
            return;
        }

        setModalData({ concordaPagar: true, observacao: '' });
        setValidationError('');
        onClose();
    }, [saveValidationMutation.isPending, modalData.concordaPagar, modalData.observacao, onClose]);
    // ===================

    // Verifica se o formulário é válido para habilitar o botão de salvar
    const isFormValid = useCallback(() => {
        return modalData.concordaPagar || modalData.observacao.trim() !== '';
    }, [modalData.concordaPagar, modalData.observacao]);

    const saveModalData = useCallback(async () => {
        if (!selectedRow || !validateForm()) return;

        saveValidationMutation.mutate({
            cod_os: selectedRow.COD_OS,
            concordaPagar: modalData.concordaPagar,
            observacao: modalData.observacao.trim() || null,
        });
    }, [
        selectedRow,
        validateForm,
        modalData.concordaPagar,
        modalData.observacao,
        saveValidationMutation,
    ]);
    // ==================

    // Handler para submissão do formulário
    const handleSubmit = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            saveModalData();
        },
        [saveModalData]
    );
    // ==================

    // Efeito para resetar o estado ao abrir o modal
    useEffect(() => {
        if (isOpen && selectedRow) {
            const concordaInicial = selectedRow.VALCLI_OS === 'SIM';

            setModalData({
                concordaPagar: concordaInicial,
                observacao: selectedRow.OBSCLI_OS || '',
            });
            setValidationError('');
        }
    }, [isOpen, selectedRow]);
    // ==================

    // Renderização condicional
    if (!isOpen || !selectedRow) return null;
    // ==================

    // =================== RENDERIZAÇÃO PRINCIPAL ===================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex max-w-7xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <FaFileWaveform className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-3xl font-extrabold">VALIDAÇÃO OS</h1>
                            <p className="text-lg font-semibold">Aprovação | Reprovação</p>
                        </div>
                    </div>
                    {/* = */}

                    <button
                        onClick={handleClose}
                        disabled={saveValidationMutation.isPending || !!validationError}
                        className="mr-2 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:from-red-500 hover:to-red-600 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100 disabled:hover:from-red-600 disabled:hover:to-red-700"
                    >
                        <IoClose className="text-white" size={36} />
                    </button>
                </header>
                {/* ========== */}

                {/* ========== CONTEÚDO ========== */}
                <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-stone-300 px-6 py-10">
                    {/* ===== CARDS INFORMAÇÕES ===== */}
                    <div className="grid grid-cols-4 gap-4">
                        <InfoCard
                            icon={FaHashtag}
                            label="Número OS"
                            value={formatarNumeros(selectedRow.NUM_OS ?? '---------------')}
                        />

                        {isAdmin && selectedRow.NOME_CLIENTE && (
                            <InfoCard
                                icon={FaUser}
                                label="Cliente"
                                value={corrigirTextoCorrompido(selectedRow.NOME_CLIENTE)}
                            />
                        )}

                        <InfoCard
                            icon={FaCalendar}
                            label="Data Início"
                            value={formatarDataParaBR(selectedRow.DTINI_OS)}
                        />

                        <InfoCard
                            icon={FaClock}
                            label="Hora Início"
                            value={formatarHora(selectedRow.HRINI_OS)}
                        />

                        <InfoCard
                            icon={FaClock}
                            label="Hora Fim"
                            value={formatarHora(selectedRow.HRFIM_OS)}
                        />

                        <InfoCard
                            icon={FaClock}
                            label="Total Horas"
                            value={formatarHorasTotaisSufixo(selectedRow.TOTAL_HORAS_OS)}
                        />

                        <InfoCard
                            icon={FaUser}
                            label="Consultor(a)"
                            value={corrigirTextoCorrompido(
                                getPrimeirosDoisNomes(selectedRow.NOME_RECURSO ?? '')
                            )}
                            tooltip={true}
                            fullValue={corrigirTextoCorrompido(selectedRow.NOME_RECURSO ?? '')}
                        />

                        <InfoCard
                            icon={FaCalendar}
                            label="Entregável"
                            value={formatarDataParaBR(selectedRow.NOME_TAREFA)}
                            tooltip={true}
                            fullValue={formatarDataParaBR(selectedRow.NOME_TAREFA)}
                            span={2}
                        />

                        <InfoCard
                            icon={BsChatSquareTextFill}
                            label="Descrição da OS"
                            value={corrigirTextoCorrompido(selectedRow.OBS ?? '---------------')}
                            fullWidth
                            tooltip={true}
                            fullValue={corrigirTextoCorrompido(
                                selectedRow.OBS ?? '---------------'
                            )}
                            minHeight="150px"
                            maxHeight="400px"
                        />
                    </div>
                    {/* ===== */}

                    {/* ===== VALIDAÇÃO ========*/}
                    <div className="flex flex-col gap-6">
                        {/* === LINHA SEPARADORA | TÍTULO === */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-400"></div>
                            </div>
                            {/* = */}
                            <div className="relative flex justify-center">
                                <span className="bg-stone-300 px-4 font-extrabold tracking-widest text-slate-800 select-none">
                                    VALIDAÇÃO OS
                                </span>
                            </div>
                        </div>
                        {/* === */}

                        {/* === INPUTS RADIO APROVAÇÃO | REPROVAÇÃO === */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* INPUT OS APROVADA */}
                            <div
                                onClick={() => handleRadioChange(true)}
                                className={`group relative flex cursor-pointer items-center gap-4 rounded-md border-t shadow-sm shadow-black transition-all duration-200 hover:shadow-lg hover:shadow-black ${
                                    modalData.concordaPagar
                                        ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500'
                                        : 'border-blue-200 bg-white hover:bg-blue-50'
                                } py-3 pl-4`}
                            >
                                <div className="relative flex items-center">
                                    <input
                                        type="radio"
                                        name="validacao"
                                        checked={modalData.concordaPagar}
                                        onChange={() => handleRadioChange(true)}
                                        disabled={saveValidationMutation.isPending}
                                        className="h-5 w-5 cursor-pointer text-blue-600 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span
                                        className={`text-base font-bold tracking-widest select-none ${
                                            modalData.concordaPagar
                                                ? 'font-extrabold text-blue-700'
                                                : 'text-blue-600'
                                        }`}
                                    >
                                        OS Aprovada
                                    </span>
                                </div>
                            </div>

                            {/* INPUT OS RECUSADA */}
                            <div
                                onClick={() => handleRadioChange(false)}
                                className={`group relative flex cursor-pointer items-center gap-4 rounded-md border-t shadow-sm shadow-black transition-all duration-200 hover:shadow-lg hover:shadow-black ${
                                    !modalData.concordaPagar
                                        ? 'border-red-500 bg-red-100 ring-2 ring-red-500'
                                        : 'border-red-200 bg-white hover:bg-red-50'
                                } py-3 pl-4`}
                            >
                                <div className="relative flex items-center">
                                    <input
                                        type="radio"
                                        name="validacao"
                                        checked={!modalData.concordaPagar}
                                        onChange={() => handleRadioChange(false)}
                                        disabled={saveValidationMutation.isPending}
                                        className="h-5 w-5 cursor-pointer text-red-600 transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span
                                        className={`text-base font-bold tracking-widest select-none ${
                                            !modalData.concordaPagar
                                                ? 'font-extrabold text-red-700'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        OS Reprovada
                                    </span>
                                </div>
                            </div>
                        </div>
                        {/* === */}

                        {/* === OBSERVAÇÃO === */}
                        <div className="flex flex-col">
                            <label
                                htmlFor="observacao"
                                className="mb-1 block text-xs font-bold tracking-widest text-black select-none"
                            >
                                {!modalData.concordaPagar ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-700"></div>
                                            Observação obrigatória
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-700"></div>
                                        Observação opcional
                                    </div>
                                )}
                            </label>
                            {/* = */}
                            <div className="relative">
                                <textarea
                                    id="observacao"
                                    value={modalData.observacao}
                                    onChange={(e) => handleObservacaoChange(e.target.value)}
                                    rows={4}
                                    className={`w-full cursor-pointer rounded-xl px-4 pt-4 font-medium tracking-widest text-black shadow-sm shadow-black transition-all duration-200 select-none placeholder:text-sm placeholder:font-bold placeholder:tracking-widest placeholder:text-slate-500 hover:shadow-lg hover:shadow-black focus:ring focus:outline-none ${
                                        !modalData.concordaPagar
                                            ? 'border-t border-red-200 bg-red-100 focus:border-none focus:shadow-none focus:ring-2 focus:ring-red-500'
                                            : 'border-t border-blue-200 bg-blue-100 focus:border-none focus:shadow-none focus:ring-2 focus:ring-blue-500'
                                    }`}
                                    placeholder={
                                        !modalData.concordaPagar
                                            ? 'Por favor, informe o motivo da reprovação...'
                                            : 'Digite uma observação, se necessário...'
                                    }
                                    disabled={saveValidationMutation.isPending}
                                />
                            </div>
                        </div>
                        {/* === */}

                        {/* === ALERTA === */}
                        {validationError && (
                            <div className="animate-in fade-in slide-in-from-top-2 rounded-md border-t border-yellow-200 bg-yellow-100 py-1 pl-4 shadow-sm shadow-black transition-all duration-200">
                                <div className="flex items-center justify-center gap-2">
                                    <LuTriangleAlert
                                        className="flex-shrink-0 text-yellow-700"
                                        size={20}
                                    />
                                    <p className="flex-1 text-sm font-bold tracking-widest text-yellow-700 select-none">
                                        {validationError}
                                    </p>
                                </div>
                            </div>
                        )}
                        {/* === */}

                        {/* === BOTÃO SALVAR === */}
                        <div className="flex items-center justify-end">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={saveValidationMutation.isPending || !isFormValid()}
                                className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-3 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 select-none hover:-translate-y-1 hover:from-blue-500 hover:to-blue-600 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saveValidationMutation.isPending ? (
                                    <>
                                        <LoadingButton size={24} />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoIosSave className="text-white" size={24} />
                                        <span>Salvar</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {/* === */}
                    </div>
                    {/* ========== */}
                </div>
                {/* ========== */}
            </div>
        </div>
    );
}
