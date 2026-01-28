import React from 'react';
import { BENCHMARK_ASSETS } from '@/lib/benchmarkApi';
import { getCurrencySymbol } from '@/lib/currency';

interface ChartTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
    activeView: 'performance' | 'insights' | 'vision' | 'share';
    currencySym: string;
    simulatedImpact: number;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, activeView, currencySym, simulatedImpact }) => {
    if (!active || !payload || payload.length === 0) return null;

    const fmtCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    };

    const formatTooltipDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        // Check if future
        if (date > new Date()) {
            return `${month} ${year} (Vision)`;
        }
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${day} ${month} ${year} - ${weekday}`;
    };

    // --- VISION MODE TOOLTIP ---
    if (activeView === 'vision') {
        const dataPoint = payload[0]?.payload;
        const projectedVal = dataPoint?._actualValue || 0;
        const impactVal = dataPoint?._impactActualValue || 0;
        const impactDiff = impactVal - projectedVal;

        // Lifestyle / Freedom Calc
        const freedomDays = Math.floor(projectedVal / 50);
        const rentYears = (projectedVal / 12000).toFixed(1);

        return (
            <div className="bg-slate-900/90 backdrop-blur-md border border-violet-500/30 rounded-xl p-4 shadow-2xl text-white min-w-[220px]">
                <p className="text-sm text-slate-400 mb-3 font-semibold border-b border-white/10 pb-2">
                    {formatTooltipDate(label || '')}
                </p>

                {/* Main Projection */}
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-200">Estimated Value</span>
                    <span className="text-base font-extrabold text-emerald-500">
                        {currencySym}{fmtCurrency(projectedVal)}
                    </span>
                </div>

                {/* Impact / Ghost Line */}
                {simulatedImpact !== 0 && (
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-amber-400">With Impact</span>
                        <span className="text-base font-extrabold text-amber-400">
                            {currencySym}{fmtCurrency(impactVal)}
                        </span>
                    </div>
                )}

                {/* Impact Delta */}
                {simulatedImpact !== 0 && (
                    <div className="flex justify-between items-center mb-3 bg-amber-400/10 px-2 py-1.5 rounded-md">
                        <span className="text-xs text-amber-400 font-semibold">Effect</span>
                        <span className="text-sm font-extrabold text-amber-400">
                            +{currencySym}{fmtCurrency(impactDiff)}
                        </span>
                    </div>
                )}

                {/* Lifestyle Box */}
                <div className="mt-3 bg-white/5 p-2.5 rounded-lg">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">
                        Lifestyle Power
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm text-slate-200">
                            <span>🏠</span> <strong>{rentYears} Years</strong> of Rent
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-200">
                            <span>🏄</span> <strong>{freedomDays} Days</strong> of Freedom
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- STANDARD HISTORY MODE TOOLTIP ---
    // Sort payload by value (highest to lowest)
    const sortedPayload = [...payload].sort((a, b) => {
        const valA = Number(a.value) || 0;
        const valB = Number(b.value) || 0;
        return valB - valA; // Descending order (highest first)
    });

    return (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl text-white min-w-[200px]">
            <p className="text-xs text-slate-400 mb-2 font-medium">
                {formatTooltipDate(label || '')}
            </p>
            <div className="flex flex-col gap-1">
                {sortedPayload.map((entry: any) => {
                    const isPortfolio = entry.dataKey === 'portfolio';
                    const benchmark = BENCHMARK_ASSETS.find(b => b.id === entry.dataKey);
                    const name = isPortfolio ? 'My Portfolio' : (benchmark?.name || entry.dataKey);
                    const color = isPortfolio ? '#6366f1' : (benchmark?.color || entry.color);
                    const val = Number(entry.value);

                    return (
                        <div key={entry.dataKey || entry.name} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                                <span className="text-sm text-slate-200">{name}</span>
                            </div>
                            <span style={{ color: val >= 0 ? '#4ade80' : '#f87171' }} className="text-sm font-bold">
                                {val > 0 ? '+' : ''}{val.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
