import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { playNotificationSound } from '../lib/notification-sound';
import { cn } from '../lib/utils';

const ICONS = { success: CheckCircle, error: XCircle, info: Info, warning: AlertTriangle };
const DURATIONS = { short: 2000, medium: 4000, long: 8000 };

export function showEnhancedToast({
  type,
  title,
  description,
  action,
  duration = 'medium',
  sound = false,
}: {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: 'short' | 'medium' | 'long';
  sound?: boolean;
}) {
  playNotificationSound(sound);
  const Icon = ICONS[type];
  const isDanger = type === 'error' || type === 'warning';
  toast[type](title, {
    description,
    duration: DURATIONS[duration],
    action: action ? { label: action.label, onClick: action.onClick } : undefined,
    icon: Icon ? (
      <Icon className={cn('h-4 w-4', isDanger ? 'text-destructive' : 'text-primary')} />
    ) : undefined,
    classNames: {
      toast: isDanger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
    },
  });
}
