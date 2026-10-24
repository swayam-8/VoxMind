/** User searches are literal strings, never executable regular expressions. */
export function escapeSearch(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
