import { DisplaySettingsPanel } from '../components/display/DisplaySettingsPanel';
import { MONITOR_PAGE } from '../lib/device-pages';
import DevicePage from './DevicePage';

export default function MonitorPage() {
  return <DevicePage config={MONITOR_PAGE} beforeContent={<DisplaySettingsPanel />} />;
}
