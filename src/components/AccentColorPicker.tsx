import { Check } from 'lucide-react';
import { useSettingsContext } from '../contexts/SettingsContext';
import { readableForegroundForHex } from '../lib/color-contrast';

const PRESET_COLORS = [
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Ambar', hex: '#f59e0b' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Ciano', hex: '#06b6d4' },
];

export function AccentColorPicker() {
  const { settings, update } = useSettingsContext();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => {
          const isActive = settings.accentColor.toLowerCase() === color.hex.toLowerCase();
          return (
            <button
              key={color.hex}
              type="button"
              aria-label={`Cor ${color.name}`}
              aria-pressed={isActive}
              onClick={() => update({ accentColor: color.hex })}
              className={`group relative size-8 rounded-full transition-[transform,box-shadow] duration-200 ${
                isActive
                  ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                  : 'hover:scale-110 hover:ring-2 hover:ring-offset-2 hover:ring-offset-background hover:ring-muted-foreground/30'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
              style={{
                backgroundColor: color.hex,
                color: readableForegroundForHex(color.hex),
                ...(isActive && { '--tw-ring-color': color.hex }),
              }}
              title={color.name}
            >
              {isActive && <Check className="size-4 absolute inset-0 m-auto" strokeWidth={3} />}
            </button>
          );
        })}
        {/* Custom color input */}
        <label
          htmlFor="custom-accent-color"
          className="relative size-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer transition-[border-color,transform] duration-200 hover:border-muted-foreground/60 hover:scale-110 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
          title="Cor personalizada"
        >
          <span className="text-lg text-muted-foreground leading-none" aria-hidden="true">
            +
          </span>
          <input
            id="custom-accent-color"
            type="color"
            value={settings.accentColor}
            aria-label="Selecionar cor personalizada"
            onChange={(e) => update({ accentColor: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
      {/* Current color info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="size-3 rounded-full" style={{ backgroundColor: settings.accentColor }} />
        <span>Cor atual: {settings.accentColor.toUpperCase()}</span>
      </div>
      {/* Live preview */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-16 rounded-md"
            style={{ backgroundColor: 'var(--color-primary)' }}
          />
          <div className="h-5 w-10 rounded-md" style={{ backgroundColor: 'var(--color-accent)' }} />
          <div className="flex size-5 items-center justify-center rounded-full bg-primary">
            <Check className="size-3 text-primary-foreground" strokeWidth={3} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full"
              style={{ width: '60%', backgroundColor: 'var(--color-primary)' }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">60%</span>
        </div>
      </div>
    </div>
  );
}
