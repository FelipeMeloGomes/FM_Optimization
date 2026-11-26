import { Palette } from 'lucide-react';
import { AccentColorPicker } from '../AccentColorPicker';
import { ThemeSelector } from '../ThemeSelector';
import { SettingsSectionShell } from './SettingsSectionShell';

export function ThemeSection() {
  return (
    <SettingsSectionShell title="Tema" tone="primary">
      <div>
        <span className="mb-3 block text-sm font-medium text-foreground">Aparencia</span>
        <p className="mb-3 text-xs text-muted-foreground">Escolha o visual do FM Optimize</p>
        <ThemeSelector />
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Cor de destaque</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Personalize a cor principal da interface
        </p>
        <AccentColorPicker />
      </div>
    </SettingsSectionShell>
  );
}
