import { IoEye, IoEyeOff, IoLockClosed } from 'react-icons/io5';

interface Props {
    value: string;
    onChange: (value: string) => void;
    showPassword: boolean;
    toggleShowPassword: () => void;
}

export default function PasswordField({
    value,
    onChange,
    showPassword,
    toggleShowPassword,
}: Props) {
    return (
        <div className="space-y-2 sm:space-y-3">
            <label htmlFor="password" className="block text-sm font-semibold text-white/90">
                Senha
            </label>
            <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 sm:pl-4">
                    <IoLockClosed className="h-4 w-4 text-white/60 transition-colors duration-200 group-focus-within:text-purple-300 sm:h-5 sm:w-5" />
                </div>
                <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    className="block w-full rounded-xl border border-white/20 bg-white/10 py-3 pr-10 pl-10 text-sm text-white placeholder-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/15 focus:border-transparent focus:ring-2 focus:ring-purple-400 focus:outline-none sm:rounded-2xl sm:py-4 sm:pr-12 sm:pl-12 sm:text-base"
                />
                <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute inset-y-0 right-0 z-10 flex touch-manipulation items-center pr-3 transition-transform duration-200 hover:scale-110 sm:pr-4"
                    tabIndex={-1}
                >
                    {showPassword ? (
                        <IoEyeOff className="h-4 w-4 text-white/60 sm:h-5 sm:w-5" />
                    ) : (
                        <IoEye className="h-4 w-4 text-white/60 sm:h-5 sm:w-5" />
                    )}
                </button>
                <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 blur-sm transition-opacity duration-200 group-focus-within:opacity-100 sm:rounded-2xl"></div>
            </div>
        </div>
    );
}
