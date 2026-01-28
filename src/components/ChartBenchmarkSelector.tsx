import React, { useState } from 'react';
import { Eye, EyeOff, LineChart as LineChartIcon } from 'lucide-react';
import { BENCHMARK_ASSETS } from '@/lib/benchmarkApi';
import { useLanguage } from '@/context/LanguageContext';

interface ChartBenchmarkSelectorProps {
    selectedBenchmarks: string[];
    onToggleBenchmark: (id: string) => void;
    isPortfolioVisible?: boolean;
    onTogglePortfolio?: () => void;
}

export const ChartBenchmarkSelector: React.FC<ChartBenchmarkSelectorProps> = ({
    selectedBenchmarks,
    onToggleBenchmark,
    isPortfolioVisible = true,
    onTogglePortfolio
}) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${selectedBenchmarks.length > 0
                        ? 'bg-indigo-500/10 text-indigo-500'
                        : 'bg-transparent text-[var(--text-secondary)]'
                    }`}
            >
                <LineChartIcon size={16} />
                <span>{t('benchmarks')}</span>
                {selectedBenchmarks.length > 0 && (
                    <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                        {selectedBenchmarks.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-[115%] left-0 w-[170px] bg-[var(--surface)] border border-[var(--border)] rounded-xl p-2 z-50 shadow-xl max-h-[300px] overflow-y-auto">
                        <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] px-2 py-1">
                            Overlay
                        </div>
                        {onTogglePortfolio && (
                            <div
                                onClick={onTogglePortfolio}
                                className={`flex justify-between p-2 rounded-md cursor-pointer ${isPortfolioVisible ? 'bg-indigo-500/10' : 'hover:bg-[var(--bg-secondary)]'
                                    }`}
                            >
                                <span className="text-sm font-medium text-[var(--text-primary)]">My Portfolio</span>
                                {isPortfolioVisible ? <Eye size={16} className="text-indigo-500" /> : <EyeOff size={16} className="text-slate-400" />}
                            </div>
                        )}
                        <div className="h-px bg-[var(--border)] my-1" />
                        {BENCHMARK_ASSETS.map(b => (
                            <div
                                key={b.id}
                                onClick={() => onToggleBenchmark(b.id)}
                                className={`flex justify-between p-2 rounded-md cursor-pointer ${selectedBenchmarks.includes(b.id) ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.color }} />
                                    <span className="text-sm text-[var(--text-primary)]">{b.name}</span>
                                </div>
                                {selectedBenchmarks.includes(b.id) && <Eye size={16} style={{ color: b.color }} />}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
