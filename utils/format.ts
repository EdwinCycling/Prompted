export const getLocale = (): string => {
  try {
    const stored = localStorage.getItem('pv-locale');
    return stored || 'nl-NL';
  } catch {
    return 'nl-NL';
  }
};

export const formatDateTime = (value: string | number | Date): string => {
  const locale = getLocale();
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
  } catch {
    return d.toLocaleString('nl-NL');
  }
};
