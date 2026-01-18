"use client";

import React, { useEffect, useState } from 'react';
import { InsightCard } from './InsightCard';
import { Loader2, Sparkles, Info, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface InsightsTabProps {
    username: string;
    onShare?: (data: any, template?: string) => void;
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

export const InsightsTab: React.FC<InsightsTabProps> = ({ username }) => {
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

            {/* HERO: Health Score - EXTREME COMPACT */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 50%, #FFFFFF 100%)',
                padding: '16px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                marginBottom: '12px'
            }}>

                {/* Decorative blur - MINIMAL */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '180px',
                    height: '180px',
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                    pointerEvents: 'none'
                }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>

                    {/* Gauge - TINY */}
                    <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
                        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <circle cx="45" cy="45" r="38" fill="transparent" stroke="#E5E7EB" strokeWidth="6" />
                            <motion.circle
                                cx="45" cy="45" r="38" fill="transparent" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                                initial={{ strokeDasharray: "0 1000" }}
                                animate={{ strokeDasharray: `${(insights.health_score / 100) * 239} 1000` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                style={{ filter: `drop-shadow(0 0 4px ${scoreColor}30)` }}
                            />
                        </svg>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <motion.div
                                style={{ fontSize: '32px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1 }}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                {insights.health_score}
                            </motion.div>
                            <div style={{ fontSize: '8px', fontWeight: 700, color: '#9CA3AF', marginTop: '1px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                SKOR
                            </div>
                        </div>
                    </div>

                    {/* Content - MINIMAL */}
                    <div style={{ flex: 1, minWidth: '220px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                                Portföy Durumu
                            </h1>
                            {insights.health_score_delta !== 0 && (
                                <motion.span
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                        backgroundColor: insights.health_score_delta > 0 ? '#D1FAE5' : '#FEE2E2',
                                        color: insights.health_score_delta > 0 ? '#047857' : '#B91C1C',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                                    }}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.3 }}
                                >
                                    {insights.health_score_delta > 0 ? '▲' : '▼'} {Math.abs(insights.health_score_delta)}
                                </motion.span>
                            )}
                        </div>

                        <p style={{ fontSize: '12px', lineHeight: 1.4, color: '#475569', fontWeight: 500, marginBottom: '8px', maxWidth: '600px' }}>
                            {insights.performance_summary}
                        </p>

                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '10px',
                            backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)',
                            fontSize: '11px', fontWeight: 600, color: '#1E40AF'
                        }}>
                            <Info size={12} style={{ color: '#3B82F6' }} />
                            {insights.benchmark_comparison_text}
                        </div>
                    </div>
                </div>
            </div>

            {/* INSIGHT CARDS - COMPACT GRID (3 CARDS ONLY) */}
            {insights.score_cards.length > 0 && (
                <div style={{
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

            {/* RECOMMENDATIONS - REVERSE SYMMETRY DESIGN */}
            {insights.recommendations.length > 0 && (
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
            )}

            {/* Footer - SMALLER */}
            <div style={{ textAlign: 'center', paddingTop: '12px' }}>
                <p style={{ fontSize: '10px', color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
                    Bu analizler piyasa verilerine dayalı simülasyonlardır. Yatırım tavsiyesi değildir.
                </p>
            </div>

        </div>
    );
};
