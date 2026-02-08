"use client";

import { useQuery, useQueries } from '@tanstack/react-query';
import { BENCHMARK_ASSETS, fetchBenchmarkData, normalizeToPercentage, BenchmarkDataPoint } from '@/lib/benchmarkApi';

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface UseBenchmarkDataOptions {
    selectedBenchmarks: string[];
    period: TimePeriod;
    enabled?: boolean;
}

interface BenchmarkResult {
    id: string;
    data: BenchmarkDataPoint[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Custom hook for fetching and caching benchmark data
 * Uses React Query for automatic caching and deduplication
 */
export function useBenchmarkData({ selectedBenchmarks, period, enabled = true }: UseBenchmarkDataOptions) {
    // Fetch all selected benchmarks in parallel with individual caching
    const benchmarkQueries = useQueries({
        queries: selectedBenchmarks.map(benchmarkId => {
            const benchmark = BENCHMARK_ASSETS.find(b => b.id === benchmarkId);
            return {
                queryKey: ['benchmark', benchmarkId, period],
                queryFn: async () => {
                    if (!benchmark) return [];
                    const data = await fetchBenchmarkData(benchmark.symbol, period);
                    const sortedData = data.sort((a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                    return normalizeToPercentage(sortedData);
                },
                enabled: enabled && !!benchmark,
                staleTime: period === '1D' ? 60 * 1000 : 5 * 60 * 1000, // 1D = 1 min, others = 5 min
                placeholderData: (prev: BenchmarkDataPoint[] | undefined) => prev, // Keep previous data while loading
            };
        }),
    });

    // Combine results into a map
    const benchmarkData: Record<string, BenchmarkDataPoint[]> = {};
    const isLoading = benchmarkQueries.some(q => q.isLoading);
    const isFetching = benchmarkQueries.some(q => q.isFetching);

    selectedBenchmarks.forEach((id, index) => {
        const query = benchmarkQueries[index];
        if (query?.data) {
            benchmarkData[id] = query.data;
        }
    });

    return {
        benchmarkData,
        isLoading,
        isFetching,
        refetch: () => benchmarkQueries.forEach(q => q.refetch()),
    };
}

/**
 * Hook for fetching portfolio history data
 */
export function usePortfolioHistory(username: string, period: TimePeriod, enabled = true) {
    return useQuery({
        queryKey: ['portfolio-history', username, period],
        queryFn: async () => {
            const response = await fetch(`/api/portfolio/${username}/history?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch portfolio history');
            const data = await response.json();
            return data.data || [];
        },
        enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes
        placeholderData: (prev) => prev,
    });
}
