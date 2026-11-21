import { MouseSettingsPanel } from '../components/mouse/MouseSettingsPanel';
import { MOUSE_PAGE } from '../lib/device-pages';
import DevicePage from './DevicePage';

export default function MousePage() {
  return <DevicePage config={MOUSE_PAGE} beforeContent={<MouseSettingsPanel />} />;
}
