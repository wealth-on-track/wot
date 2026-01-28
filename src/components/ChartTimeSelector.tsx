import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface ChartTimeSelectorProps {
    selectedPeriod: string;
    onPeriodChange: (period: TimePeriod) => void;
}

export const ChartTimeSelector: React.FC<ChartTimeSelectorProps> = ({
    selectedPeriod,
    onPeriodChange
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm font-semibold min-w-[80px] cursor-pointer"
            >
                <span>{selectedPeriod}</span>
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-[115%] right-0 w-[100px] bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 z-50 shadow-xl">
                        {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const).map((period) => (
                            <div
                                key={period}
                                onClick={() => {
                                    onPeriodChange(period);
                                    setIsOpen(false);
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer mb-0.5 ${selectedPeriod === period
                                        ? 'text-[var(--accent)] bg-indigo-500/10'
                                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                                    }`}
                            >
                                {period}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
