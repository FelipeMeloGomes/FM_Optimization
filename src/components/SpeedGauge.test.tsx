// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeedGauge } from './SpeedGauge';

const baseProps = {
  valueMbps: 42,
  maxMbps: 100,
  label: 'Download',
  phase: 'download' as const,
  active: true,
};

function scaleLabels(): Element[] {
  return [...screen.getByTestId('gauge-labels').querySelectorAll('g')].map(
    (group) => group.querySelector('text') as Element
  );
}

describe('SpeedGauge', () => {
  it('expõe o valor acessível com uma casa decimal', () => {
    render(<SpeedGauge {...baseProps} />);

    expect(screen.getByRole('img', { name: 'Download: 42.0 Mbps' })).toBeTruthy();
  });

  it('mostra o valor e a unidade, sem seta, fase ou percentual', () => {
    render(<SpeedGauge {...baseProps} />);
    const texts = [...screen.getByTestId('gauge-readout').querySelectorAll('text')];

    expect(texts.map((node) => node.textContent)).toEqual(['42.0', 'MBPS - Download']);
    expect(document.querySelector('.speed-gauge-icon')).toBeNull();
  });

  it('troca a unidade para Upload durante a fase de upload', () => {
    render(<SpeedGauge {...baseProps} phase="upload" label="Upload" />);

    expect(screen.getByTestId('gauge-readout').textContent).toContain('MBPS - Upload');
  });

  it('usa a escala não-linear do Speedtest.net para posicionar a agulha', () => {
    render(<SpeedGauge {...baseProps} />);

    // 42 de 100 fica entre os rótulos 25 (33,75°) e 50 (67,5°) → 56,7°.
    expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(56.7deg)');
  });

  it('desenha os nove rótulos da escala do Speedtest.net', () => {
    render(<SpeedGauge {...baseProps} maxMbps={1000} />);

    expect(scaleLabels().map((node) => node.textContent)).toEqual([
      '0',
      '5',
      '10',
      '50',
      '100',
      '250',
      '500',
      '750',
      '1000',
    ]);
  });

  it('preenche o arco com gradiente de download e troca no upload', () => {
    const { rerender } = render(<SpeedGauge {...baseProps} />);

    const fill = screen.getByTestId('gauge-fill');
    expect(fill.getAttribute('stroke')).toBe('url(#speed-gauge-download)');
    // 56,7° no arco de 270° → ~71% dos 612,6 de comprimento.
    expect(Number(fill.getAttribute('stroke-dasharray')?.split(' ')[0])).toBeGreaterThan(400);

    rerender(<SpeedGauge {...baseProps} phase="upload" label="Upload" />);
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke')).toBe(
      'url(#speed-gauge-upload)'
    );
  });

  it('não trava a agulha em 1000 Mbps', () => {
    render(<SpeedGauge {...baseProps} valueMbps={800} maxMbps={undefined} />);

    // 800 fica entre 750 (101,25°) e 1000 (135°) → 108°.
    expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(108deg)');
  });

  it('mantém arco, agulha e números visíveis e acompanha o valor entre fases', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<SpeedGauge {...baseProps} />);
      const firstMorph = screen.getByTestId('gauge-morph');

      // A troca de fase zera o Mbps no serviço; a agulha volta SEM apagar o
      // medidor — o "apagão" era o que parecia travamento na UI.
      rerender(<SpeedGauge {...baseProps} phase="upload" label="Upload" valueMbps={0} />);
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(-135deg)');
      expect(getComputedStyle(screen.getByTestId('gauge-content')).opacity).toBe('1');
      expect(getComputedStyle(screen.getByTestId('gauge-readout')).opacity).toBe('1');
      expect(screen.queryByTestId('gauge-connecting')).toBeNull();
      // A morph é só a entrada do teste: não pode piscar de novo na troca
      // de fase — a agulha volta ao início sozinha.
      expect(screen.getByTestId('gauge-morph')).toBe(firstMorph);

      // Depois da volta, cada nova amostra redireciona a agulha.
      rerender(
        <SpeedGauge {...baseProps} phase="upload" label="Upload" maxMbps={1000} valueMbps={100} />
      );
      act(() => vi.advanceTimersByTime(320));
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(0deg)');
      expect(screen.getByTestId('gauge-needle').style.transitionDuration).toBe('250ms');
    } finally {
      vi.useRealTimers();
    }
  });

  it('zera a agulha sem varredura quando um novo teste começa', () => {
    const { rerender } = render(
      <SpeedGauge {...baseProps} active={false} phase="done" maxMbps={1000} valueMbps={800} />
    );
    const oldNeedle = screen.getByTestId('gauge-needle');

    rerender(<SpeedGauge {...baseProps} phase="latency" maxMbps={1000} valueMbps={0} />);

    const needle = screen.getByTestId('gauge-needle');
    expect(needle.style.transform).toContain('rotate(-135deg)');
    // Elemento novo: não existe transição CSS a partir do resultado anterior.
    expect(needle).not.toBe(oldNeedle);
  });

  it('mantém a agulha no início até a morph da nova fase terminar', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<SpeedGauge {...baseProps} maxMbps={1000} valueMbps={800} />);

      rerender(
        <SpeedGauge {...baseProps} phase="upload" label="Upload" maxMbps={1000} valueMbps={0} />
      );
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(-135deg)');

      // As amostras do upload chegam antes da volta terminar: não podem
      // interromper o retorno, senão a agulha para no meio do arco.
      rerender(
        <SpeedGauge {...baseProps} phase="upload" label="Upload" maxMbps={1000} valueMbps={700} />
      );
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(-135deg)');

      act(() => vi.advanceTimersByTime(320));

      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(94.5deg)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('não repete o flash nem segura a agulha ao iniciar o download', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <SpeedGauge {...baseProps} phase="latency" valueMbps={0} maxMbps={1000} active />
      );
      const firstMorph = screen.getByTestId('gauge-morph');
      const firstLabels = screen.getByTestId('gauge-labels');

      rerender(
        <SpeedGauge {...baseProps} phase="download" valueMbps={100} maxMbps={1000} active />
      );

      // O disco→anel→arco é a entrada do teste: não pode reaparecer quando a
      // conexão termina e o download começa.
      expect(screen.getByTestId('gauge-morph')).toBe(firstMorph);
      expect(screen.getByTestId('gauge-labels')).toBe(firstLabels);

      // A agulha já está em -135° na latência; a primeira amostra do download
      // deve movê-la de imediato, sem a pausa de 250 ms do retorno.
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(0deg)');
      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(0deg)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('não devolve a agulha ao início quando o teste termina', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <SpeedGauge {...baseProps} phase="upload" label="Upload" maxMbps={1000} valueMbps={700} />
      );

      // No resultado o medidor mostra o download; não deve passar por -135°
      // antes de exibir o valor final.
      rerender(
        <SpeedGauge
          {...baseProps}
          active={false}
          phase="done"
          label="Download"
          maxMbps={1000}
          valueMbps={800}
        />
      );
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(108deg)');

      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(108deg)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('aplica morfologia de entrada e saída', () => {
    const { rerender } = render(<SpeedGauge {...baseProps} active={false} phase="latency" />);
    expect(screen.getByTestId('gauge-morph').getAttribute('class')).toBe('');

    rerender(<SpeedGauge {...baseProps} active />);
    expect(screen.getByTestId('gauge-morph').getAttribute('class')).toContain(
      'speed-gauge-morph-in'
    );

    rerender(<SpeedGauge {...baseProps} active={false} phase="done" />);
    expect(screen.getByTestId('gauge-morph').getAttribute('class')).toContain(
      'speed-gauge-morph-out'
    );
  });

  it('mantém o movimento reduzido mesmo quando inativo', () => {
    const { rerender } = render(<SpeedGauge {...baseProps} />);

    expect(screen.getByTestId('gauge-needle').getAttribute('class')).toContain(
      'motion-reduce:transition-none'
    );

    rerender(<SpeedGauge {...baseProps} active={false} />);

    expect(screen.getByTestId('gauge-needle').getAttribute('class')).toContain(
      'motion-reduce:transition-none'
    );
  });

  it('destaca e pisca os rótulos já alcançados pela agulha', () => {
    render(<SpeedGauge {...baseProps} valueMbps={100} maxMbps={1000} />);

    const labels = scaleLabels();
    expect(labels.slice(0, 5).every((node) => node.getAttribute('fill') === 'currentColor')).toBe(
      true
    );
    expect(labels.slice(5).every((node) => node.getAttribute('fill') !== 'currentColor')).toBe(
      true
    );
    expect(
      screen.getByTestId('gauge-labels').querySelectorAll('.speed-gauge-label-flash').length
    ).toBeGreaterThan(0);
  });
});
