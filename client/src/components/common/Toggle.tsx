// Brand toggle switch (navy when on) — shared by all settings sections
export default function Toggle({
  enabled,
  onChange,
  size = 'md',
  disabled = false,
  ariaLabel,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'md' | 'lg';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const sizeClasses = size === 'lg' ? 'w-14 h-8' : 'w-11 h-6';
  const dotSizeClasses = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const translateClass = size === 'lg' ? 'translate-x-6' : 'translate-x-5';

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!enabled);
      }}
      className={`${sizeClasses} relative inline-flex flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        enabled ? 'bg-primary' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`${dotSizeClasses} pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? translateClass : 'translate-x-0'
        }`}
      />
    </button>
  );
}
