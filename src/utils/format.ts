/**
 * Format currency in Argentine peso format
 * @param cents - Amount in cents
 * @returns Formatted string like "$15.000"
 */
export function formatCurrency(cents: number | undefined): string {
  if (cents === undefined || cents === null) {
    return '$0';
  }

  // Convert cents to pesos (divide by 100)
  const pesos = Math.round(cents / 100);

  // Format with thousands separator (dot) and no decimals
  return `$${pesos.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format number with thousands separator
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "15.000" or "15.000,50"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
