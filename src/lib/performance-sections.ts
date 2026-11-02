import type { AppSection } from './app-sections';

/**
 * Secoes da pagina Desempenho (rota `/cpu`).
 *
 * A pagina agrupa tres categorias do catalogo, cada uma com o seu proprio card:
 * ajustes de processador (AMD e Intel), ajustes de GPU AMD e ajustes do Windows
 * (energia, servicos e prioridade). Separar por categoria e o que impede um
 * tweak de GPU de aparecer como se fosse um ajuste universal de CPU.
 *
 * Diferente das outras paginas, a secao nao guarda `scriptIds`: a pagina monta a
 * lista a partir da categoria que o catalogo entregou, entao um script novo sem
 * card aparece na secao certa em vez de sumir.
 */
export type PerformanceSection = Omit<AppSection, 'scriptIds'> & {
  /** Categoria do catalogo que alimenta a secao. */
  category: string;
};

export const PERFORMANCE_SECTIONS: PerformanceSection[] = [
  {
    id: 'processor',
    name: 'Processador',
    description:
      'Ajustes de processador que valem para AMD e Intel. A detecção de fabricante apenas rotula a página — ela não filtra nem esconde nenhum script.',
    icon: 'cpu',
    category: 'CPU',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  {
    id: 'gpu',
    name: 'GPU AMD',
    description:
      'Reduz o frame pre-renderizado da placa de vídeo AMD para diminuir a latência de entrada. Não tem efeito em GPU NVIDIA ou Intel.',
    icon: 'monitor',
    category: 'GPU',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    warning:
      'Requer placa de vídeo AMD com driver instalado: escreve na chave de classe do adaptador e não faz nada em NVIDIA/Intel. Os scripts "Reverter" desfazem os dois ajustes.',
  },
  {
    id: 'windows',
    name: 'Windows e energia',
    description:
      'Energia, serviços, prioridade de CPU e modo de jogo. São ajustes do sistema operacional e independem do processador instalado.',
    icon: 'sliders',
    category: 'Windows',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
];
