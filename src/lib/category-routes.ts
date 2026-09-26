export const CATEGORY_ROUTES: Record<string, string> = {
  Tweaks: '/tweaks',
  CPU: '/cpu',
  Cleaner: '/cleaner',
  Internet: '/rede',
  'DNS Manager': '/rede',
  'Input Lag': '/input-lag',
  Utilities: '/utilities',
  Apps: '/apps',
};

export function getCategoryRoute(category: string): string {
  return CATEGORY_ROUTES[category] || '/';
}
