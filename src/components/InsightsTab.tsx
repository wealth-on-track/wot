"use client";

import React, { useEffect, useState } from 'react';
import { InsightCard } from './InsightCard';
import { Loader2, Sparkles, Info, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface InsightsTabProps {
    username: string;
    onShare?: (data: any, template?: string) => void;
    isFullScreen?: boolean;
}

interface ScoreCardData {
    title: string;
    description: string;
    impact_level: 'success' | 'warning' | 'danger' | 'info';
    value?: string;
    trend?: string;
    actionType?: 'view_asset' | 'add_asset' | 'general' | 'stop_loss';
    actionTarget?: string;
    actionLabel?: string;
    graphType?: 'pie' | 'area' | 'bar';
    graphData?: any[];
}

interface Recommendation {
    title: string;
    description: string;
    action_button_text: string;
    link: string;
}

interface InsightsData {
    health_score: number;
    health_score_delta: number;
    benchmark_comparison_text: string;
    performance_summary: string;
    score_cards: ScoreCardData[];
    recommendations: Recommendation[];
    cached: boolean;
    lastUpdated: string;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({ username, isFullScreen }) => {
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchInsights();
    }, [username]);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/insights/${username}`);
            if (!response.ok) throw new Error('Failed to fetch insights');
            const data = await response.json();
            setInsights(data);
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: '#3B82F6', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#64748B', fontWeight: 500, fontSize: '14px' }}>Hesaplanıyor...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <p style={{ color: '#EF4444', marginBottom: '12px', fontSize: '14px' }}>{error}</p>
                    <button onClick={fetchInsights} style={{ padding: '10px 20px', background: '#3B82F6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>Tekrar Dene</button>
                </div>
            </div>
        );
    }

    if (!insights) return null;

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#10B981';
        if (score >= 50) return '#F59E0B';
        return '#EF4444';
    };

    const scoreColor = getScoreColor(insights.health_score);

    return (
        <div style={{ paddingBottom: '24px' }}>

            {/* MAIN GRID WRAPPER */}
            <div style={isFullScreen ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' } : {}}>

                {/* HERO: Health Score - EXTREME COMPACT */}
                {/* HERO: Health Score - InsightCard Style */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ height: '100%' }}
                >
                    <InsightCard
                        title="PORTFÖY DURUMU"
                        description={insights.performance_summary}
                        value={insights.health_score.toString()}
                        impact_level={insights.health_score >= 80 ? 'success' : insights.health_score >= 50 ? 'warning' : 'danger'}
                    >
                        <div style={{ width: '100%', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginTop: '4px' }}>
                            <svg style={{ width: '100%', height: '100%', maxWidth: '100px', overflow: 'visible' }} viewBox="0 0 100 50">
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" strokeLinecap="round" />
                                <motion.path
                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                    fill="none"
                                    stroke={scoreColor}
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    initial={{ strokeDasharray: "0 126" }}
                                    animate={{ strokeDasharray: `${(insights.health_score / 100) * 126} 126` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                />
                                <text x="50" y="45" textAnchor="middle" fontSize="14" fontWeight="800" fill={scoreColor}>
                                    {insights.health_score}
                                </text>
                            </svg>
                        </div>
                    </InsightCard>
                </motion.div>


            {/* INSIGHT CARDS - COMPACT GRID (3 CARDS ONLY) */}
            {insights.score_cards.length > 0 && (
                <div style={isFullScreen ? { display: 'contents' } : {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px'
                }}>
                    {insights.score_cards.slice(0, 3).map((card, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                            <InsightCard
                                title={card.title}
                                description={card.description}
                                impact_level={card.impact_level}
                                value={card.value}
                                graphType={card.graphType as any}
                                graphData={card.graphData}
                            />
                        </motion.div>
                    ))}
                </div>
            )}

        </div> {/* End Main Grid Wrapper */ }

    {/* RECOMMENDATIONS - REVERSE SYMMETRY DESIGN */ }
    {
        insights.recommendations.length > 0 && (
            <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: '14px',
                background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(168, 85, 247, 0.02) 50%, rgba(99, 102, 241, 0.03) 100%)',
                padding: '14px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
                border: '1px solid rgba(99, 102, 241, 0.06)'
            }}>

                {/* Decorative blur - RIGHT SIDE (opposite of Health Score) */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '180px',
                    height: '180px',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                    pointerEvents: 'none'
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Header - REVERSED LAYOUT */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                                Gelişim Önerileri
                            </h2>
                            <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 500, margin: '1px 0 0 0' }}>
                                Portföyünüzü optimize edin
                            </p>
                        </div>

                        {/* Icon on RIGHT */}
                        <div style={{
                            padding: '8px', background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                            color: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                            flexShrink: 0
                        }}>
                            <Zap size={16} strokeWidth={2.5} />
                        </div>
                    </div>

                    {/* Recommendations - NUMBERS START FROM 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {insights.recommendations.map((rec, index) => (
                            <motion.div
                                key={index}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '10px', borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(6px)',
                                    border: '1px solid rgba(99, 102, 241, 0.06)',
                                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)',
                                    transition: 'all 0.2s ease', cursor: 'pointer'
                                }}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                whileHover={{
                                    borderColor: 'rgba(99, 102, 241, 0.15)',
                                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.05)',
                                    translateX: -2
                                }}
                            >
                                {/* Number - LEFT SIDE */}
                                <div style={{
                                    flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                                    color: 'white', fontWeight: 700, fontSize: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2)'
                                }}>
                                    {index + 1}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '3px', lineHeight: 1.3 }}>
                                        {rec.title}
                                    </h3>
                                    <p style={{ fontSize: '10px', lineHeight: 1.4, color: '#64748B', margin: 0 }}>
                                        {rec.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    {/* Footer - SMALLER */ }
    <div style={{ textAlign: 'center', paddingTop: '12px' }}>
        <p style={{ fontSize: '10px', color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
            Bu analizler piyasa verilerine dayalı simülasyonlardır. Yatırım tavsiyesi değildir.
        </p>
    </div>

        </div >
    );
};
