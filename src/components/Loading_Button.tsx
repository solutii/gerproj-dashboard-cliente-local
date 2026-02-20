import { FiLoader } from 'react-icons/fi';

// Componente LoadingButton
interface LoadingButtonProps {
    size?: number;
    className?: string;
}

export const LoadingButton = ({ size = 20, className = '' }: LoadingButtonProps) => {
    return <FiLoader size={size} className={`animate-spin ${className}`} />;
};

// Componente Button com Loading integrado
interface ButtonWithLoadingProps {
    isLoading?: boolean;
    children: React.ReactNode;
    loadingText?: string;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    className?: string;
    loaderSize?: number;
}

export const ButtonWithLoading = ({
    isLoading = false,
    children,
    loadingText = 'Carregando...',
    onClick,
    type = 'button',
    disabled = false,
    className = '',
    loaderSize = 20,
}: ButtonWithLoadingProps) => {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`flex items-center justify-center gap-2 ${className}`}
        >
            {isLoading ? (
                <>
                    <LoadingButton size={loaderSize} />
                    <span>{loadingText}</span>
                </>
            ) : (
                children
            )}
        </button>
    );
};
