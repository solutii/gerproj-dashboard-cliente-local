import { ImSpinner2 } from 'react-icons/im';
import { MdOutlineKeyboardArrowRight } from 'react-icons/md';

type SubmitButtonProps = {
    isLoading: boolean;
};

export default function SubmitButton({ isLoading }: SubmitButtonProps) {
    return (
        <button
            type="submit"
            disabled={isLoading}
            className={`group relative flex w-full transform items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3.5 text-sm font-semibold text-white shadow-xl transition-all duration-200 sm:rounded-2xl sm:px-6 sm:py-4 sm:text-base ${
                isLoading
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:-translate-y-1 hover:scale-[1.02] hover:from-purple-600 hover:to-pink-600 hover:shadow-2xl active:scale-[0.98]'
            }`}
        >
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-30 sm:rounded-2xl" />

            {isLoading ? (
                <span className="relative z-10 flex items-center gap-2">
                    <ImSpinner2 className="h-5 w-5 animate-spin" />
                    Entrando...
                </span>
            ) : (
                <>
                    <span className="relative z-10 mr-2">Entrar</span>
                    <MdOutlineKeyboardArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-2 sm:h-5 sm:w-5" />
                </>
            )}
        </button>
    );
}
