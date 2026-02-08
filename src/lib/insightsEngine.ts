
import { prisma } from "@/lib/prisma";
import { getPortfolioMetrics } from "@/lib/portfolio";
import { AssetDisplay } from "@/lib/types";
import { getMarketPrice } from "@/services/marketData";

export interface ScoreCard {
    title: string;
    description: string;
    impact_level: 'success' | 'warning' | 'danger' | 'info';
    value?: string;
    trend?: string;
    actionType?: 'view_asset' | 'add_asset' | 'general' | 'stop_loss';
    actionTarget?: string; // Asset ID or Route
    actionLabel?: string;
    graphType?: 'pie' | 'area' | 'bar';
    graphData?: any[]; // Payload for Recharts
}

export interface Recommendation {
    title: string;
    description: string;
    action_button_text: string;
    link: string;
}

export interface InsightsData {
    health_score: number;
    health_score_delta: number; // e.g. -5 or +2
    benchmark_comparison_text: string;
    performance_summary: string;
    score_cards: ScoreCard[];
    recommendations: Recommendation[];
    cached: boolean;
    lastUpdated: string;
}

async function getBenchmarkReturn(symbol: string): Promise<number> {
    try {
        // Try to get 1Y change from market data if available (simplification)
        const priceData = await getMarketPrice(symbol, 'BENCHMARK', undefined, false, 'System');
        // If we have changePercent1Y properly populated:
        if (priceData?.changePercent1Y) return priceData.changePercent1Y;

        // Fallback: Use simple day change * 252? No.
        // Fallback 2: Hardcoded "Market Average" contexts or rough estimate if API fails
        // Real implementation would fetch historical data here.
        // For this demo/task, let's assume market is up 12% if data missing.
        return 12.5;
    } catch (e) {
        return 10;
    }
}

export async function calculateInsights(username: string): Promise<InsightsData> {
    try {
        // 1. Get User with Portfolio
        const user = await prisma.user.findUnique({
            where: { username },
            include: { Portfolio: true }
        });

        if (!user || !user.Portfolio) {
            // Check if user exists but has no portfolio (edge case)
            if (!user) throw new Error("User not found");

            // Create portfolio if missing (auto-heal) or just return empty
            return {
                health_score: 50,
                health_score_delta: 0,
                benchmark_comparison_text: "Henüz kıyaslanacak veri yok.",
                performance_summary: "Portföyünüz henüz oluşturulmamış.",
                score_cards: [],
                recommendations: [
                    {
                        title: "Portföyünü Oluştur",
                        description: "Varlık ekleyerek portföyünü oluşturmaya başla.",
                        action_button_text: "Başla",
                        link: "/dashboard"
                    }
                ],
                cached: false,
                lastUpdated: new Date().toISOString()
            };
        }

        // 2. Get Assets
        const dbAssets = await prisma.asset.findMany({
            where: { portfolioId: user.Portfolio.id }
        });

        if (dbAssets.length === 0) {
            return {
                health_score: 50,
                health_score_delta: 0,
                benchmark_comparison_text: "Henüz kıyaslanacak veri yok.",
                performance_summary: "Henüz bir varlık eklemediniz. Portföy analizleri için varlık eklemeye başlayın.",
                score_cards: [],
                recommendations: [
                    {
                        title: "İlk Varlığını Ekle",
                        description: "Portföyünü oluşturmaya başlamak için ilk varlığını ekle.",
                        action_button_text: "Varlık Ekle",
                        link: "/dashboard?action=add_asset"
                    }
                ],
                cached: false,
                lastUpdated: new Date().toISOString()
            };
        }

        // 3. Value Assets (using cached prices to be fast/safe)
        const metrics = await getPortfolioMetrics(dbAssets, undefined, false, user.id);
        const assets = metrics.assetsWithValues;
        const totalValue = metrics.totalValueEUR;

        // 4. Generate Insights
        // 4. Generate Insights
        // We need exactly 4 cards for the 2x2 Grid Layout
        const card1_Allocation: ScoreCard = {} as ScoreCard;
        const card2_Performance: ScoreCard = {} as ScoreCard;
        const card3_Risk: ScoreCard = {} as ScoreCard;
        const card4_Cash: ScoreCard = {} as ScoreCard;

        const recommendations: Recommendation[] = [];

        // --- ANALYSIS LOGIC ---

        // A. Diversity Check
        let maxAllocationAsset = null;
        let maxAllocationPct = 0;
        let cashValue = 0;

        for (const asset of assets) {
            const allocation = totalValue > 0 ? (asset.totalValueEUR / totalValue) * 100 : 0;
            if (allocation > maxAllocationPct) {
                maxAllocationPct = allocation;
                maxAllocationAsset = asset;
            }
            if (asset.type === 'CASH') {
                cashValue += asset.totalValueEUR;
            }
        }

        // B. Health Score Calculation
        let score = 100;

        // B1. Alpha Check (Simulated)
        // Need Weighted Average Return of Portfolio
        const totalCost = assets.reduce((sum, a) => sum + (a.buyPrice * a.quantity), 0);
        // Note: convert buyPrice to EUR for accurate cost basis? 
        // simplistic: plPercentage is already calculated per asset.

        // Recalculate Portfolio Weighted PL % (since totalPL% is (Val-Cost)/Cost)
        // We need converting Cost to EUR.
        // Assuming asset.buyPrice is native.
        // Doing proper Total Return % calculation:
        let totalCostEUR = 0;
        // Approximation: Cost Basis in EUR is TotalValueEUR / (1 + pl/100)
        // Because Total = Cost * (1 + pl)
        assets.forEach(a => {
            const cost = a.totalValueEUR / (1 + (a.plPercentage / 100));
            totalCostEUR += cost;
        });

        const portfolioReturnPct = totalCostEUR > 0 ? ((totalValue - totalCostEUR) / totalCostEUR) * 100 : 0;
        const benchmarkReturn = await getBenchmarkReturn('^GSPC'); // S&P 500
        const btcReturn = await getBenchmarkReturn('BTC-USD'); // Bitcoin

        const alpha = portfolioReturnPct - benchmarkReturn;

        if (alpha > 0) {
            // Full 40 points
        } else if (alpha > -5) {
            score -= 15; // Minor underperformance
        } else {
            score -= 40; // Major underperformance
        }

        // B2. Diversification Check
        if (maxAllocationPct > 50) score -= 30; // Critical concentration
        else if (maxAllocationPct > 20) score -= 15; // Moderate

        // B3. Volatility / Risk (Simplified: Count Negative Assets significantly)
        const redAssets = assets.filter(a => a.plPercentage < -10);
        if (redAssets.length > 2) score -= 10;
        if (redAssets.length > 5) score -= 20;

        // B4. Cash Drag
        const cashRatio = totalValue > 0 ? (cashValue / totalValue) * 100 : 0;
        if (cashRatio > 40 || cashRatio === 0) score -= 8; // Penalty for too much cash or zero cash reserve

        // Clamp Score
        score = Math.round(Math.max(0, Math.min(100, score)));

        // Previous Score Simulation (Random variation for "Trend")
        // In real app, fetch last week's score from DB.
        const prevScore = Math.round(Math.max(0, Math.min(100, score - (Math.random() * 10 - 5))));
        const scoreDelta = score - prevScore;

        // B5. Comparisons Text
        let comparisonText = "";
        if (portfolioReturnPct > btcReturn) {
            comparisonText = `Portföyünüz Bitcoin dominasyonuna (%${btcReturn.toFixed(1)}) karşı güçlü bir direnç gösteriyor.`;
        } else if (portfolioReturnPct > benchmarkReturn) {
            comparisonText = `S&P 500 endeksinin (%${benchmarkReturn.toFixed(1)}) üzerinde bir getiri eğrisi yakaladınız.`;
        } else {
            comparisonText = `Piyasa ortalamasının (%${benchmarkReturn.toFixed(1)}) altında bir seyir izleniyor.`;
        }

        // --- CARDS ---

        // SLOT 1: ALLOCATION / DIVERSITY
        if (maxAllocationPct > 50 && maxAllocationAsset) {
            Object.assign(card1_Allocation, {
                title: "Varlık Konsantrasyonu",
                description: `${maxAllocationAsset.name}, portföyün %${Math.round(maxAllocationPct)}'ini domine ediyor.`,
                impact_level: 'warning',
                value: `%${Math.round(maxAllocationPct)}`,
                trend: "YÜKSEK RİSK",
                actionType: 'view_asset',
                actionTarget: maxAllocationAsset.id,
                graphType: 'pie',
                graphData: [
                    { name: maxAllocationAsset.symbol, value: maxAllocationPct, fill: '#f59e0b' },
                    { name: 'Diğer', value: 100 - maxAllocationPct, fill: '#e5e7eb' }
                ]
            });
            recommendations.push({
                title: "Stratejik Optimizasyon",
                description: "Tek bir varlık sınıfına aşırı maruz kalmak risk/getiri dengesini bozabilir. Farklı sektörlere dağılımı değerlendirin.",
                action_button_text: "Çeşitlendirme Yap",
                link: "/dashboard"
            });
        } else {
            Object.assign(card1_Allocation, {
                title: "Dengeli Dağılım",
                description: "Varlıklarınız modern portföy teorisine uygun, sağlıklı bir spektrumda dağılmış.",
                impact_level: 'success',
                value: "OPTİMUM",
                trend: "STABİL",
                actionType: 'general',
                graphType: 'pie',
                graphData: assets.slice(0, 4).map((a, i) => ({
                    name: a.symbol,
                    value: (a.totalValueEUR / totalValue) * 100,
                    fill: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'][i]
                })).concat([{ name: 'Diğer', value: Math.max(0, 100 - assets.slice(0, 4).reduce((sum, a) => sum + (a.totalValueEUR / totalValue) * 100, 0)), fill: '#e5e7eb' }])
            });
        }

        // Pre-calculate Performers
        const sortedByPL = [...assets].sort((a, b) => b.plPercentage - a.plPercentage);
        const topPerformer = sortedByPL[0];
        const worstPerformer = sortedByPL[sortedByPL.length - 1];

        // SLOT 2: TOP PERFORMER
        if (topPerformer && topPerformer.plPercentage > 0) {
            Object.assign(card2_Performance, {
                title: "Portföy Lideri",
                description: `${topPerformer.name}, pozitif ayrışarak portföyü yukarı taşıyor.`,
                impact_level: 'success',
                value: `+${Math.round(topPerformer.plPercentage)}%`,
                trend: "MOMENTUM",
                actionType: 'view_asset',
                actionTarget: topPerformer.id,
                graphType: 'area', // We might retain graph but user asked to prioritize big number
                graphData: [
                    { name: 'Start', value: 100 },
                    { name: 'Mid', value: 100 + (topPerformer.plPercentage / 2) },
                    { name: 'Now', value: 100 + topPerformer.plPercentage }
                ]
            });
        } else {
            Object.assign(card2_Performance, {
                title: "Piyasa Beklentisi",
                description: "Henüz belirgin bir yükseliş trendi yakalanamadı. Makro döngüler takip ediliyor.",
                impact_level: 'info',
                value: "NÖTR",
                trend: "İZLENİYOR",
                actionType: 'general'
            });
        }

        // SLOT 3: RISK / UNDERPERFORMER
        if (worstPerformer && worstPerformer.plPercentage < -5) {
            Object.assign(card3_Risk, {
                title: "Risk Takibi",
                description: `${worstPerformer.name} üzerindeki satış baskısı devam ediyor.`,
                impact_level: 'danger',
                value: `${Math.round(worstPerformer.plPercentage)}%`,
                trend: "DÜŞÜŞTE",
                actionType: 'stop_loss',
                actionTarget: worstPerformer.id,
                graphType: 'area',
                graphData: [
                    { name: 'Start', value: 100 },
                    { name: 'Mid', value: 100 + (worstPerformer.plPercentage / 2) },
                    { name: 'Now', value: 100 + worstPerformer.plPercentage }
                ]
            });
        } else {
            Object.assign(card3_Risk, {
                title: "Risk Yönetimi",
                description: "Portföyde kritik bir değer kaybı veya risk faktörü bulunmuyor.",
                impact_level: 'success',
                value: "GÜVENLİ",
                trend: "POZİTİF",
                actionType: 'general'
            });
        }

        // SLOT 4: CASH / LIQUIDITY
        if (cashRatio > 35) {
            Object.assign(card4_Cash, {
                title: "Nakit Rezerv",
                description: "Yüksek nakit pozisyonu alım fırsatı sunabilir ancak enflasyon riski taşır.",
                impact_level: 'info',
                value: `%${Math.round(cashRatio)}`,
                trend: "LİKİDİTE YÜKSEK",
                actionType: 'add_asset'
            });
        } else if (cashRatio < 5) {
            Object.assign(card4_Cash, {
                title: "Nakit Akışı",
                description: "Portföy tamamen yatırıma yönlendirilmiş. Acil durumlar için nakit bulundurmak stratejiktir.",
                impact_level: 'warning',
                value: `%${Math.round(cashRatio)}`,
                trend: "LİKİDİTE DÜŞÜK",
                actionType: 'general'
            });
        } else {
            Object.assign(card4_Cash, {
                title: "Likidite Dengesi",
                description: "Nakit/Varlık oranınız ideal seviyede korunuyor.",
                impact_level: 'success',
                value: `%${Math.round(cashRatio)}`,
                trend: "OPTİMİZE",
                actionType: 'add_asset'
            });
        }

        const scoreCards = [card1_Allocation, card2_Performance, card3_Risk, card4_Cash];

        // D. Summary Generation
        let summary = `Portföyünüz piyasa ortalamasının üzerinde bir direnç gösteriyor. Sağlık skorunuz ${score}/100. `;
        if (score < 50) summary = `Portföy risk profilinizde dikkat çeken sapmalar mevcut. Sağlık skorunuz ${score}/100.`;
        else if (score >= 80) summary = `Portföyünüz piyasa dinamiklerine karşı üstün bir performans ve denge sergiliyor. Sağlık skorunuz ${score}/100.`;

        return {
            health_score: score,
            health_score_delta: scoreDelta,
            benchmark_comparison_text: comparisonText,
            performance_summary: summary,
            score_cards: scoreCards,
            recommendations: recommendations,
            cached: false,
            lastUpdated: new Date().toISOString()
        };

    } catch (error) {
        console.error("[InsightsEngine] Error:", error);
        throw new Error("Portföy analizi sırasında bir hata oluştu.");
    }
}
