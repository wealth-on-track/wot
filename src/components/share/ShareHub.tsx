import React, { useState, useRef, useEffect } from 'react';
import {
    Globe, Zap, DollarSign, Award, TrendingUp, Target, Download, Share2,
    Smartphone, Monitor, Building2, MapPin, Briefcase, Layers, TrendingDown
} from 'lucide-react';
import { DistributionTemplate, PerformanceTemplate, ShareData } from './Templates';
import { generateImage } from './utils';

// Distribution breakdown types
type BreakdownType = 'portfolio' | 'type' | 'exchange' | 'currency' | 'country' | 'sector' | 'platform' | 'positions';

// Time period for performance comparison
type TimePeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const BREAKDOWN_OPTIONS = [
    { id: 'portfolio', name: 'Portfolio', icon: Briefcase },
    { id: 'type', name: 'Type', icon: Layers },
    { id: 'exchange', name: 'Exchange', icon: Building2 },
    { id: 'currency', name: 'Currency', icon: DollarSign },
    { id: 'country', name: 'Country', icon: MapPin },
    { id: 'sector', name: 'Sector', icon: Zap },
    { id: 'platform', name: 'Platform', icon: Globe },
    { id: 'positions', name: 'Positions', icon: Award },
] as const;

const TIME_PERIODS = [
    { id: '1M', name: '1M' },
    { id: '3M', name: '3M' },
    { id: '6M', name: '6M' },
    { id: '1Y', name: '1Y' },
    { id: 'ALL', name: 'All' },
] as const;

interface ShareHubProps {
    initialData?: ShareData;
    initialTemplate?: 'distribution' | 'performance';
    assets?: any[];
    username?: string;
    totalValueEUR?: number;
}

export function ShareHub({ initialData, initialTemplate = 'distribution', assets = [], username = 'Investor', totalValueEUR = 0 }: ShareHubProps) {
    const [templateType, setTemplateType] = useState<'distribution' | 'performance'>(initialTemplate);
    const [breakdownType, setBreakdownType] = useState<BreakdownType>('portfolio');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('1M');
    const [selectedBenchmark, setSelectedBenchmark] = useState('GOLD');
    const [maskAmounts, setMaskAmounts] = useState(true);
    const [showName, setShowName] = useState(true);
    const [aspectRatio, setAspectRatio] = useState<'story' | 'post'>('story');
    const [isGenerating, setIsGenerating] = useState(false);

    // Generate distribution data based on breakdown type
    const generateDistribution = React.useCallback((type: BreakdownType): { name: string; value: number; color?: string }[] => {
        if (!assets || assets.length === 0) {
            // Fallback to dummy data
            return [
                { name: 'Technology', value: 45000, color: '#6366f1' },
                { name: 'Finance', value: 30000, color: '#8b5cf6' },
                { name: 'Energy', value: 25000, color: '#ec4899' },
                { name: 'Healthcare', value: 15000, color: '#f59e0b' },
                { name: 'Real Estate', value: 10000, color: '#10b981' },
            ];
        }

        const grouped: Record<string, number> = {};

        assets.forEach(asset => {
            const value = asset.currentValue || asset.value || 0;
            let key = '';

            switch (type) {
                case 'portfolio':
                    key = asset.portfolio || 'Main';
                    break;
                case 'type':
                    key = asset.type || 'Unknown';
                    break;
                case 'exchange':
                    key = asset.exchange || 'Unknown';
                    break;
                case 'currency':
                    key = asset.currency || 'EUR';
                    break;
                case 'country':
                    key = asset.country || 'Unknown';
                    break;
                case 'sector':
                    key = asset.sector || 'Unknown';
                    break;
                case 'platform':
                    key = asset.platform || 'Unknown';
                    break;
                case 'positions':
                    key = asset.name || asset.symbol || 'Unknown';
                    break;
            }

            grouped[key] = (grouped[key] || 0) + value;
        });

        // Convert to array and sort by value
        const distribution = Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        // Assign colors
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
        return distribution.map((item, i) => ({
            ...item,
            color: colors[i % colors.length]
        }));
    }, [assets]);

    // Recalculate data when breakdownType changes
    const data: ShareData = React.useMemo(() => {
        return initialData || {
            username,
            totalValue: totalValueEUR,
            currency: 'EUR',
            distribution: generateDistribution(breakdownType),
            performance: Array.from({ length: 30 }, (_, i) => ({
                date: `2024-${i}`,
                value: 100 + i * 2 + Math.random() * 5
            })),
            benchmarkPerformance: Array.from({ length: 30 }, (_, i) => ({
                date: `2024-${i}`,
                value: 100 + i * 1.5 + Math.random() * 3
            }))
        };
    }, [breakdownType, initialData, username, totalValueEUR, generateDistribution]);

    useEffect(() => {
        if (initialTemplate) setTemplateType(initialTemplate);
    }, [initialTemplate]);

    const handleShare = async (method: 'download' | 'share') => {
        setIsGenerating(true);
        try {
            const elementId = 'share-hub-capture-target';
            const dataUrl = await generateImage(elementId);

            if (method === 'download') {
                const link = document.createElement('a');
                link.download = `wot-${templateType}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
            } else if (method === 'share') {
                if (navigator.share) {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], 'share.png', { type: 'image/png' });
                    await navigator.share({
                        title: 'My Wealth Journey',
                        text: 'Check out my progress on WOT!',
                        files: [file]
                    });
                } else {
                    alert("Web Share API not supported. Downloading image instead.");
                    const link = document.createElement('a');
                    link.download = `wot-${templateType}-${Date.now()}.png`;
                    link.href = dataUrl;
                    link.click();
                }
            }
        } catch (error) {
            console.error('Share failed:', error);
            alert('Failed to generate image. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const renderTemplate = () => {
        const props = { data, isMasked: maskAmounts, showName, aspectRatio };

        if (templateType === 'distribution') {
            return <DistributionTemplate {...props} breakdownType={breakdownType} />;
        } else {
            return <PerformanceTemplate {...props} timePeriod={timePeriod} benchmark={selectedBenchmark} />;
        }
    };

    return (
        <div className="share-hub-container" style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '20px',
            height: 'calc(100vh - 180px)',
            maxHeight: '800px',
            background: 'var(--surface)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
        }}>

            {/* CONFIGURATION PANEL (Left) */}
            <div style={{
                padding: '20px',
                borderRight: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                overflowY: 'auto'
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>Studio</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customize your snapshot</p>
                </div>

                {/* Template Type Toggle */}
                <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>
                        Template Type
                    </label>
                    <div style={{ display: 'flex', gap: '6px', background: 'var(--surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setTemplateType('distribution')}
                            style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                background: templateType === 'distribution' ? 'var(--accent)' : 'transparent',
                                color: templateType === 'distribution' ? '#fff' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '11px',
                                transition: 'all 0.2s'
                            }}
                        >
                            Distribution
                        </button>
                        <button
                            onClick={() => setTemplateType('performance')}
                            style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                background: templateType === 'performance' ? 'var(--accent)' : 'transparent',
                                color: templateType === 'performance' ? '#fff' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '11px',
                                transition: 'all 0.2s'
                            }}
                        >
                            Performance
                        </button>
                    </div>
                </div>

                {/* Distribution Options */}
                {templateType === 'distribution' && (
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>
                            Breakdown By
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            {BREAKDOWN_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setBreakdownType(opt.id as BreakdownType)}
                                    style={{
                                        padding: '8px 6px', borderRadius: '8px',
                                        background: breakdownType === opt.id ? 'var(--accent)' : 'var(--surface)',
                                        border: breakdownType === opt.id ? 'none' : '1px solid var(--border)',
                                        color: breakdownType === opt.id ? '#fff' : 'var(--text-muted)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: breakdownType === opt.id ? 'var(--shadow-md)' : 'none'
                                    }}
                                >
                                    <opt.icon size={14} />
                                    <span style={{ fontSize: '9px', fontWeight: 600 }}>{opt.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Performance Options */}
                {templateType === 'performance' && (
                    <>
                        <div>
                            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>
                                Time Period
                            </label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {TIME_PERIODS.map(period => (
                                    <button
                                        key={period.id}
                                        onClick={() => setTimePeriod(period.id as TimePeriod)}
                                        style={{
                                            flex: 1, padding: '6px', borderRadius: '6px',
                                            background: timePeriod === period.id ? 'var(--accent)' : 'var(--surface)',
                                            border: timePeriod === period.id ? 'none' : '1px solid var(--border)',
                                            color: timePeriod === period.id ? '#fff' : 'var(--text-muted)',
                                            cursor: 'pointer', fontWeight: 600, fontSize: '10px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {period.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>
                                Benchmark
                            </label>
                            <select
                                value={selectedBenchmark}
                                onChange={(e) => setSelectedBenchmark(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '8px',
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="GOLD">Gold (XAU)</option>
                                <option value="SP500">S&P 500</option>
                                <option value="BIST100">BIST 100</option>
                                <option value="EURUSD">EUR/USD</option>
                                <option value="BTC">Bitcoin</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Privacy Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Mask Amounts</span>
                        <Toggle checked={maskAmounts} onChange={setMaskAmounts} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Show Username</span>
                        <Toggle checked={showName} onChange={setShowName} />
                    </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>Format</label>
                    <div style={{ display: 'flex', gap: '6px', background: 'var(--surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setAspectRatio('story')}
                            style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                background: aspectRatio === 'story' ? 'var(--bg-secondary)' : 'transparent',
                                color: aspectRatio === 'story' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Smartphone size={12} /> Story
                        </button>
                        <button
                            onClick={() => setAspectRatio('post')}
                            style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                background: aspectRatio === 'post' ? 'var(--bg-secondary)' : 'transparent',
                                color: aspectRatio === 'post' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Monitor size={12} /> Post
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={() => handleShare('download')}
                        disabled={isGenerating}
                        style={{
                            padding: '10px', borderRadius: '10px',
                            background: 'var(--surface)', color: 'var(--text-primary)',
                            border: '1px solid var(--border)', fontWeight: 600, fontSize: '12px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Download size={16} /> {isGenerating ? 'Wait...' : 'Download'}
                    </button>
                    <button
                        onClick={() => handleShare('share')}
                        disabled={isGenerating}
                        style={{
                            padding: '10px', borderRadius: '10px',
                            background: 'var(--accent)', color: '#fff',
                            border: 'none', fontWeight: 600, fontSize: '12px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            boxShadow: 'var(--shadow-md)', transition: 'all 0.2s'
                        }}
                    >
                        <Share2 size={16} /> {isGenerating ? 'Sharing...' : 'Share Now'}
                    </button>
                </div>
            </div>

            {/* PREVIEW PANEL (Right) */}
            <div style={{
                background: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                borderRadius: '0 16px 16px 0'
            }}>
                {/* Canvas Container */}
                <div style={{
                    transform: aspectRatio === 'story' ? 'scale(0.7)' : 'scale(0.85)',
                    transformOrigin: 'center center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '8px solid #1e293b',
                    borderRadius: aspectRatio === 'story' ? '32px' : '4px',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div id="share-hub-capture-target" style={{ display: 'flex' }}>
                        {renderTemplate()}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple toggle component
const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        style={{
            width: '36px', height: '20px', borderRadius: '10px',
            background: checked ? 'var(--accent)' : 'var(--border)',
            position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
        }}
    >
        <div style={{
            width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }} />
    </button>
);
