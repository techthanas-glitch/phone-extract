export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCountryFlag(countryCode: string | null): string {
  const flags: Record<string, string> = {
    '+1': '🇺🇸',
    '+91': '🇮🇳',
    '+44': '🇬🇧',
    '+61': '🇦🇺',
    '+971': '🇦🇪',
    '+92': '🇵🇰',
    '+880': '🇧🇩',
    '+86': '🇨🇳',
    '+81': '🇯🇵',
    '+49': '🇩🇪',
    '+33': '🇫🇷',
    '+39': '🇮🇹',
    '+7': '🇷🇺',
    '+55': '🇧🇷',
    '+52': '🇲🇽',
    '+966': '🇸🇦',
    '+27': '🇿🇦',
    '+234': '🇳🇬',
    '+254': '🇰🇪',
    '+63': '🇵🇭',
    '+84': '🇻🇳',
    '+62': '🇮🇩',
    '+60': '🇲🇾',
    '+65': '🇸🇬',
    '+66': '🇹🇭',
  };
  return countryCode ? flags[countryCode] || '🌍' : '🌍';
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
