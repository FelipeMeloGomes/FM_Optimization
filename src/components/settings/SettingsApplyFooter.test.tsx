// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsApplyFooter } from './SettingsApplyFooter';

function baseProps() {
  return {
    isDirty: true,
    onApply: vi.fn(),
    onDiscard: vi.fn(),
    onRestoreDefault: vi.fn(),
    onFillDefaults: vi.fn(),
  };
}

describe('SettingsApplyFooter', () => {
  it('desabilita aplicar e cancelar sem alterações e esconde botões opcionais', () => {
    const required = {
      isDirty: false,
      onApply: vi.fn(),
      onDiscard: vi.fn(),
    };
    render(<SettingsApplyFooter {...required} />);

    expect(screen.getByRole('button', { name: 'Aplicar' }).hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancelar alterações' }).hasAttribute('disabled')
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Restaurar padrão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preencher com padrões' })).toBeNull();
  });

  it('desabilita as ações enquanto aplica', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} busy />);

    expect(screen.getByRole('button', { name: 'Aplicar' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Restaurar padrão' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(
      screen.getByRole('button', { name: 'Preencher com padrões' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('liga cada botão ao seu callback', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    expect(props.onRestoreDefault).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alterações' }));
    expect(props.onDiscard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Preencher com padrões' }));
    expect(props.onFillDefaults).toHaveBeenCalledTimes(1);

    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('mostra a confirmação padrão quando appliedAt é informado', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} appliedAt="10:00" />);

    const confirmation = screen.getByText('Ajustes aplicados');
    expect(confirmation.tagName).toBe('P');
    expect(confirmation.className).toContain('text-primary');
  });

  it('usa appliedLabel para a confirmação de operações pontuais', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} applied appliedLabel="Concluído" />);

    expect(screen.getByText('Concluído').tagName).toBe('P');
    expect(screen.queryByText('Ajustes aplicados')).toBeNull();
  });

  it('coloca appliedInline na mesma linha dos botões', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} appliedInline="Concluído" />);

    const inline = screen.getByText('Concluído');
    expect(inline.tagName).toBe('SPAN');
    expect(inline.parentElement?.contains(screen.getByRole('button', { name: 'Aplicar' }))).toBe(
      true
    );
    expect(screen.queryByText('Ajustes aplicados')).toBeNull();
  });

  it('mostra o erro padrão com separador, sem ícone e com tokens de erro', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props} applyError="falha ao aplicar" />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Não foi possível aplicar os ajustes: falha ao aplicar');
    expect(alert.className).toContain('mt-2 border-0 bg-transparent p-0');
    expect(alert.querySelector('svg')).toBeNull();
    expect(alert.querySelector('p')?.className).toContain('text-destructive');
  });

  it('aceita título customizado para o erro', () => {
    const props = baseProps();
    render(
      <SettingsApplyFooter
        {...props}
        applyError="falha na limpeza"
        applyErrorTitle="Não foi possível concluir"
      />
    );

    expect(screen.getByRole('alert').textContent).toBe(
      'Não foi possível concluir: falha na limpeza'
    );
  });

  it('renderiza nodes extras junto ao rodapé', () => {
    const props = baseProps();
    render(<SettingsApplyFooter {...props}>Detalhes da aplicação</SettingsApplyFooter>);

    expect(screen.getByText('Detalhes da aplicação')).not.toBeNull();
  });

  it('aceita um rodapé apenas com ações customizadas', () => {
    render(
      <SettingsApplyFooter isDirty={false} appliedInline="Concluído">
        <button type="button">Limpeza de disco</button>
      </SettingsApplyFooter>
    );

    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar alterações' })).toBeNull();
    const cleanup = screen.getByRole('button', { name: 'Limpeza de disco' });
    expect(cleanup.parentElement?.className).toBe('flex flex-wrap items-center gap-2');
    expect(screen.getByText('Concluído').tagName).toBe('SPAN');
  });
});
