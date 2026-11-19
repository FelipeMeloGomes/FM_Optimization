import { AnimatedKeyboard } from '../components/keyboard/AnimatedKeyboard';
import { KeyboardSettingsPanel } from '../components/keyboard/KeyboardSettingsPanel';
import { TECLADO_PAGE } from '../lib/device-pages';
import DevicePage from './DevicePage';

export default function KeyboardPage() {
  return (
    <DevicePage
      config={TECLADO_PAGE}
      heroVisual={<AnimatedKeyboard />}
      beforeContent={<KeyboardSettingsPanel />}
    />
  );
}
