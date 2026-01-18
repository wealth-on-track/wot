export const formatEUR = (num: number) => {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatNumber = (val: number, min = 2, max = 2) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }).format(val || 0);

export const formatPercent = (val: number) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0) + '%';
