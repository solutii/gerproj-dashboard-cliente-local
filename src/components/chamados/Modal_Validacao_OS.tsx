// src/components/chamados/Modal_OS.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import {
  formatarHora,
  formatarHorasTotaisSufixo,
} from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { removerAcentos } from '@/formatters/remover-acentuacao';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BsChatSquareTextFill } from 'react-icons/bs';
import {
  FaCalendar,
  FaClock,
  FaExclamationTriangle,
  FaHashtag,
  FaUser,
} from 'react-icons/fa';
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
import { TbAlertOctagonFilled } from 'react-icons/tb';
import { LoadingButton } from '../utils/Loading_Button';
import { OSRowProps } from './Colunas_Tabela_OS';

interface ModalDataProps {
  concordaPagar: boolean;
  observacao: string;
}

interface ModalValidacaoOSProps {
  isOpen: boolean;
  selectedRow: OSRowProps | null;
  onClose: () => void;
  onSave: (updatedRow: OSRowProps) => void;
}
// ====================

//  Objeto de configuração para status e seus ícones/cores
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
// ====================

// Objeto padrão para status desconhecidos
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
    (key) => statusLower.includes(key) || key.includes(statusLower),
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
    tooltip = false,
    fullValue,
  }: {
    icon: any;
    label: string;
    value: string;
    fullWidth?: boolean;
    tooltip?: boolean;
    fullValue?: string;
  }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <div
        className={`group rounded-md border bg-gradient-to-br from-slate-50 to-white p-4 transition-all shadow-xs shadow-black relative ${fullWidth ? 'col-span-full' : ''}`}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => tooltip && setShowTooltip(false)}
      >
        <div className="mb-2 flex items-center gap-2">
          <Icon className="text-slate-800" size={16} />
          <span className="text-xs font-bold text-slate-800 tracking-widest select-none">
            {label}
          </span>
        </div>
        <div className="text-base font-bold text-slate-800 tracking-widest select-none truncate overflow-hidden whitespace-nowrap">
          {value}
        </div>

        {/* Tooltip */}
        {tooltip && showTooltip && fullValue && (
          <div className="absolute z-[80] left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-lg px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="break-words whitespace-normal">{fullValue}</div>
            {/* Seta do tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-800"></div>
          </div>
        )}
      </div>
    );
  },
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
export function ModalValidacaoOS({
  isOpen,
  selectedRow,
  onClose,
  onSave,
}: ModalValidacaoOSProps) {
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
    onSuccess: async (data, variables) => {
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

  // Handler para mudança do checkbox
  const handleCheckboxChange = useCallback((checked: boolean) => {
    setModalData((prev) => ({
      ...prev,
      concordaPagar: checked,
    }));
    if (checked) setValidationError('');
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
        'Para salvar a discordância e/ou fechar o formulário, você deve informar o motivo na observação, ou aprovar a OS.',
      );
      return;
    }

    setModalData({ concordaPagar: true, observacao: '' });
    setValidationError('');
    onClose();
  }, [
    saveValidationMutation.isPending,
    modalData.concordaPagar,
    modalData.observacao,
    onClose,
  ]);
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
    [saveModalData],
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
    <>
      <div className="animate-in fade-in fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

        <div className="animate-in slide-in-from-bottom-4 relative z-10 max-h-[95vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white transition-all ease-out">
          <header className="relative flex items-center justify-between bg-teal-700 p-6 shadow-md shadow-black">
            <div className="flex items-center justify-center gap-6">
              <FaFileWaveform className="text-white" size={60} />
              <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold tracking-widest text-gray-200 select-none">
                  DETALHES DA OS
                </h1>
                <p className="text-lg font-extrabold tracking-widest text-gray-200 select-none">
                  Revise e Valide a OS
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={saveValidationMutation.isPending}
              className="group active:scale-95 cursor-pointer rounded-full bg-white/20 p-3 shadow-md shadow-black transition-all hover:scale-125 hover:bg-red-500"
            >
              <IoClose
                className="text-white group-hover:scale-125 group-active:scale-95"
                size={20}
              />
            </button>
          </header>

          <div className="rounded-b-2xl bg-white p-4 shadow-2xl">
            <div className="mb-6 grid grid-cols-2 gap-2">
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
                  getPrimeirosDoisNomes(selectedRow.NOME_RECURSO ?? ''),
                )}
                tooltip={true}
                fullValue={corrigirTextoCorrompido(
                  selectedRow.NOME_RECURSO ?? '',
                )}
              />

              <InfoCard
                icon={FaCalendar}
                label="Entregável"
                value={formatarDataParaBR(selectedRow.NOME_TAREFA)}
                tooltip={true}
                fullValue={formatarDataParaBR(selectedRow.NOME_TAREFA)}
              />

              <InfoCard
                icon={BsChatSquareTextFill}
                label="Descrição da OS"
                value={corrigirTextoCorrompido(
                  selectedRow.OBS ?? '---------------',
                )}
                fullWidth
                tooltip={true}
                fullValue={corrigirTextoCorrompido(
                  selectedRow.OBS ?? '---------------',
                )}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-400"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 font-extrabold text-slate-800 tracking-widest select-none text-base">
                    Validação
                  </span>
                </div>
              </div>

              <div
                className={`group relative flex cursor-pointer items-center gap-6 border rounded-md shadow-xs shadow-black ${modalData.concordaPagar ? 'bg-blue-100 border-blue-500' : 'bg-red-100 border-red-500'} px-4 py-2 transition-all hover:shadow-lg hover:shadow-black`}
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={modalData.concordaPagar}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    disabled={saveValidationMutation.isPending}
                    className="h-5 w-5 rounded-md border bg-white transition-all disabled:cursor-not-allowed disabled:opacity-50 shadow-xs shadow-black active:scale-85 hover:shadow-lg hover:shadow-black"
                  />
                </div>
                <div className="flex-1">
                  <span
                    className={`block text-lg font-bold select-none tracking-widest ${
                      modalData.concordaPagar
                        ? 'text-blue-600 font-extrabold'
                        : 'text-red-600 font-extrabold'
                    }`}
                  >
                    {modalData.concordaPagar
                      ? 'OS Aprovada'
                      : 'OS Não Aprovada'}
                  </span>

                  {modalData.concordaPagar && (
                    <span className="text-xs text-slate-700 font-semibold tracking-widest select-none">
                      Caso não concorde, desmarque e informe o motivo na
                      observação abaixo
                    </span>
                  )}
                </div>
              </div>

              {!modalData.concordaPagar && (
                <div className="animate-in fade-in slide-in-from-top-2 transition-all rounded-md border border-amber-500 bg-amber-100 px-4 py-2">
                  <div className="flex items-center gap-6">
                    <FaExclamationTriangle
                      className="text-amber-700 animate-pulse"
                      size={32}
                    />
                    <div className="flex-1">
                      <p className="font-bold text-amber-800 tracking-widest select-none text-base">
                        Atenção!
                      </p>
                      <p className="mt-1 text-sm text-amber-800 font-semibold tracking-widest select-none">
                        Você deve informar o motivo da discordância no campo de
                        observação
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                <label
                  htmlFor="observacao"
                  className="mb-1 block text-xs font-bold text-slate-800 tracking-widest select-none"
                >
                  {!modalData.concordaPagar ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                        Observação{' '}
                      </div>
                    </>
                  ) : (
                    <>Observação (Opcional)</>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    id="observacao"
                    value={modalData.observacao}
                    onChange={(e) => handleObservacaoChange(e.target.value)}
                    rows={4}
                    className={`w-full rounded-xl border bg-white px-4 py-2 text-slate-800 tracking-widest placeholder:text-sm placeholder:font-semibold select-none font-semibold transition-all focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs shadow-black hover:shadow-lg hover:shadow-black placeholder:tracking-widest placeholder:text-slate-400 ${
                      !modalData.concordaPagar
                        ? 'focus:ring-red-600 focus:shadow-none focus:ring-2 focus:border-none border-red-500'
                        : 'focus:ring-2 focus:ring-blue-600 focus:shadow-none'
                    }`}
                    placeholder={
                      !modalData.concordaPagar
                        ? 'Por favor, informe o motivo da Não Aprovação...'
                        : 'Digite uma observação, se necessário...'
                    }
                    disabled={saveValidationMutation.isPending}
                  />
                </div>
              </div>

              {validationError && (
                <div className="animate-in fade-in slide-in-from-top-2 transition-all rounded-md border border-red-500 bg-red-100 px-4 py-2">
                  <div className="flex items-center gap-4">
                    <TbAlertOctagonFilled
                      className="text-red-600 animate-pulse"
                      size={28}
                    />
                    <p className="flex-1 text-sm tracking-widest select-none font-semibold text-red-800">
                      {validationError}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-10">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saveValidationMutation.isPending}
                  className="w-[200px] cursor-pointer rounded-md border-none bg-gradient-to-r from-red-600 to-red-700 px-6 py-2 text-lg font-extrabold tracking-widest text-white shadow-xs shadow-black transition-all hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="group relative overflow-hidden w-[200px] cursor-pointer rounded-md border-none bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 text-lg font-extrabold tracking-widest text-white shadow-xs shadow-black transition-all hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saveValidationMutation.isPending || !isFormValid()}
                >
                  {saveValidationMutation.isPending ? (
                    <span className="flex items-center justify-center gap-3">
                      <LoadingButton size={24} />
                      Salvando...
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <IoIosSave className="mr-2 inline-block" size={24} />
                      <span>Salvar</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
