/** Лимит хранилища Supabase (1 GB для Free tier). В байтах. */
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/** Generate dynamic month options from Oct 2025 through next year. */
export const getMonthOptions = (): string[] => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const opts: string[] = [];
  // Start from Oct 2025 (project launch), extend to end of next year
  const startYear = 2025;
  const endYear = Math.max(currentYear + 1, 2026);
  for (let year = startYear; year <= endYear; year++) {
    const start = year === 2025 ? 9 : 0; // Oct 2025
    for (let i = start; i <= 11; i++) {
      opts.push(`${MONTH_NAMES[i]} ${year}`);
    }
  }
  return opts;
};