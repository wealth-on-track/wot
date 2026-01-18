import React, { useState, useRef, useEffect } from 'react';
import { Globe, Zap, DollarSign, Award, TrendingUp, Target, Download, Share2, Smartphone, Monitor } from 'lucide-react';
import { GlobalStrategist, SectorMaster, CurrencyGuard, HeavyHitter, TheJourney, TheMilestone, ShareData } from './Templates';
import { generateImage } from './utils';

// Reusing types from previous impl
type TemplateType = 'global' | 'sector' | 'currency' | 'heavy_hitter' | 'journey' | 'milestone';

const TEMPLATES = [
    { id: 'global', name: 'Global', icon: Globe },
    { id: 'sector', name: 'Sector', icon: Zap },
    { id: 'currency', name: 'Currency', icon: DollarSign },
    { id: 'heavy_hitter', name: 'Top Asset', icon: Award },
    { id: 'journey', name: 'Performance', icon: TrendingUp },
    { id: 'milestone', name: 'Milestone', icon: Target },
] as const;

interface ShareHubProps {
    initialData?: ShareData;
    initialTemplate?: TemplateType;
}

export function ShareHub({ initialData, initialTemplate = 'journey' }: ShareHubProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(initialTemplate);
    const [maskAmounts, setMaskAmounts] = useState(true);
    const [showName, setShowName] = useState(true);
    const [aspectRatio, setAspectRatio] = useState<'story' | 'post'>('story');
    const [isGenerating, setIsGenerating] = useState(false);

    // Default dummy data if nothing passed (e.g. user clicked tab directly)
    const data: ShareData = initialData || {
        username: 'Investor',
        totalValue: 125000,
        currency: 'EUR',
        distribution: [
            { name: 'Technology', value: 45000 },
            { name: 'Finance', value: 30000 },
            { name: 'Energy', value: 15000 },
        ],
        performance: Array.from({ length: 20 }, (_, i) => ({ date: `2023-${i}`, value: 100 + i + Math.random() * 10 }))
    };

    // Update state if props change (e.g. redirected from another tab)
    useEffect(() => {
        if (initialTemplate) setSelectedTemplate(initialTemplate);
    }, [initialTemplate]);


    const handleShare = async (method: 'download' | 'share') => {
        setIsGenerating(true);
        try {
            const elementId = 'share-hub-capture-target';
            const dataUrl = await generateImage(elementId);

            if (method === 'download') {
                const link = document.createElement('a');
                link.download = `wot-share-${selectedTemplate}-${Date.now()}.png`;
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
                    link.download = `wot-share-${selectedTemplate}-${Date.now()}.png`;
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
        switch (selectedTemplate) {
            case 'global': return <GlobalStrategist {...props} />;
            case 'sector': return <SectorMaster {...props} />;
            case 'currency': return <CurrencyGuard {...props} />;
            case 'heavy_hitter': return <HeavyHitter {...props} />;
            case 'journey': return <TheJourney {...props} />;
            case 'milestone': return <TheMilestone {...props} />;
            default: return <TheJourney {...props} />;
        }
    };

    return (
        <div className="share-hub-container" style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '24px',
            height: 'calc(100vh - 200px)', // Adjust based on layout
            minHeight: '600px',
            background: 'var(--surface)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
        }}>

            {/* CONFIGURATION PANEL (Left) */}
            <div style={{
                width: '320px',
                padding: '24px',
                borderRight: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '32px'
            }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Studio</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customize your snapshot</p>
                </div>

                {/* Templates Grid */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block', letterSpacing: '0.05em' }}>
                        Select Template
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {TEMPLATES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTemplate(t.id as TemplateType)}
                                style={{
                                    padding: '12px 8px', borderRadius: '12px',
                                    background: selectedTemplate === t.id ? 'var(--accent)' : 'var(--surface)',
                                    border: selectedTemplate === t.id ? 'none' : '1px solid var(--border)',
                                    color: selectedTemplate === t.id ? '#fff' : 'var(--text-muted)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: selectedTemplate === t.id ? 'var(--shadow-md)' : 'none'
                                }}
                            >
                                <t.icon size={18} />
                                <span style={{ fontSize: '10px', fontWeight: 600 }}>{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Privacy Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mask Amounts</span>
                        <Toggle checked={maskAmounts} onChange={setMaskAmounts} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Show Username</span>
                        <Toggle checked={showName} onChange={setShowName} />
                    </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block', letterSpacing: '0.05em' }}>Format</label>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setAspectRatio('story')}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '8px',
                                background: aspectRatio === 'story' ? 'var(--bg-secondary)' : 'transparent',
                                color: aspectRatio === 'story' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Smartphone size={14} /> Story (9:16)
                        </button>
                        <button
                            onClick={() => setAspectRatio('post')}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '8px',
                                background: aspectRatio === 'post' ? 'var(--bg-secondary)' : 'transparent',
                                color: aspectRatio === 'post' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Monitor size={14} /> Post (1:1)
                        </button>
                    </div>
                </div>
            </div>

            {/* PREVIEW PANEL (Center/Right) */}
            <div style={{
                flex: 1,
                background: '#0f172a', // Always dark for preview contrast
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}>
                {/* Canvas Container */}
                <div style={{
                    transform: 'scale(0.85)', // Slight scale down to fit comfortably
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

                {/* Floating Action Buttons */}
                <div style={{
                    position: 'absolute',
                    bottom: '32px',
                    display: 'flex',
                    gap: '12px',
                    zIndex: 20
                }}>
                    <button
                        onClick={() => handleShare('download')}
                        disabled={isGenerating}
                        style={{
                            padding: '12px 24px', borderRadius: '12px',
                            background: '#1e293b', color: '#fff',
                            border: '1px solid #334155', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <Download size={18} /> {isGenerating ? 'Wait...' : 'Download'}
                    </button>
                    <button
                        onClick={() => handleShare('share')}
                        disabled={isGenerating}
                        style={{
                            padding: '12px 24px', borderRadius: '12px',
                            background: '#6366f1', color: '#fff',
                            border: 'none', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                    >
                        <Share2 size={18} /> {isGenerating ? 'Sharing...' : 'Share Now'}
                    </button>
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
            width: '40px', height: '22px', borderRadius: '11px',
            background: checked ? 'var(--accent)' : 'var(--border)',
            position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
        }}
    >
        <div style={{
            width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }} />
    </button>
);
