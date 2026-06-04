export function formatCreditBalance(
  credits: number | null | undefined,
  isOwner: boolean,
  options: { compact?: boolean } = {},
) {
  if (isOwner) return options.compact ? "∞ cr" : "Unlimited";

  const value = credits ?? 0;
  if (options.compact) {
    return `${new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)} cr`;
  }

  return value.toLocaleString();
}

export function creditBalanceTitle(credits: number | null | undefined, isOwner: boolean) {
  return isOwner ? "Owner account: unlimited credits" : `${credits ?? 0} credits`;
}
