import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, playNotificationSound } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  playNotificationSound: vi.fn(),
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('../lib/notification-sound', () => ({ playNotificationSound }));

import { showEnhancedToast } from './EnhancedToast';

type ToastType = 'success' | 'error' | 'info' | 'warning';

describe('EnhancedToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each<[ToastType, string, string]>([
    ['success', 'bg-primary/10 text-primary', 'text-primary'],
    ['info', 'bg-primary/10 text-primary', 'text-primary'],
    ['error', 'bg-destructive/10 text-destructive', 'text-destructive'],
    ['warning', 'bg-destructive/10 text-destructive', 'text-destructive'],
  ])('%s usa tokens de tema em vez de cores fixas', (type, toastClass, iconClass) => {
    showEnhancedToast({ type, title: 'Aviso' });

    expect(toast[type]).toHaveBeenCalledOnce();
    const options = toast[type].mock.calls[0][1];
    expect(options.classNames.toast).toBe(toastClass);
    expect(options.icon.props.className).toContain(iconClass);
  });

  it('repassa título, descrição, duração e ação', () => {
    const onClick = vi.fn();
    showEnhancedToast({
      type: 'info',
      title: 'Titulo',
      description: 'Descricao',
      duration: 'long',
      action: { label: 'Refazer', onClick },
    });

    const options = toast.info.mock.calls[0][1];
    expect(toast.info).toHaveBeenCalledWith('Titulo', expect.any(Object));
    expect(options.description).toBe('Descricao');
    expect(options.duration).toBe(8000);
    expect(options.action).toEqual({ label: 'Refazer', onClick });
  });

  it('aciona o som apenas quando solicitado', () => {
    showEnhancedToast({ type: 'success', title: 'Sem som' });
    expect(playNotificationSound).toHaveBeenCalledWith(false);

    showEnhancedToast({ type: 'success', title: 'Com som', sound: true });
    expect(playNotificationSound).toHaveBeenLastCalledWith(true);
  });
});
