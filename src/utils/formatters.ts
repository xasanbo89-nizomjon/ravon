export function formatUzbekSum(amount: number): string {
  if (isNaN(amount)) return "0 so'm";
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

export function formatPhoneNumber(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('998')) {
    const rest = digits.slice(3);
    let formatted = '+998';
    if (rest.length > 0) formatted += ' (' + rest.slice(0, 2);
    if (rest.length >= 2) formatted += ') ' + rest.slice(2, 5);
    if (rest.length >= 5) formatted += '-' + rest.slice(5, 7);
    if (rest.length >= 7) formatted += '-' + rest.slice(7, 9);
    return formatted;
  }
  return val;
}
