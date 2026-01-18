import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, Zap, DollarSign, TrendingUp, Target, Award, Download, Share2, Smartphone, Monitor } from 'lucide-react';
import { GlobalStrategist, SectorMaster, CurrencyGuard, HeavyHitter, TheJourney, TheMilestone, ShareData } from './Templates';
import { generateImage } from './utils';

type TemplateType = 'global' | 'sector' | 'currency' | 'heavy_hitter' | 'journey' | 'milestone';

interface ShareHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTemplate?: TemplateType;
    data: ShareData; // Data to populate templates
}

const TEMPLATES = [
    { id: 'global', name: 'Global', icon: Globe },
    { id: 'sector', name: 'Sector', icon: Zap },
    { id: 'currency', name: 'Currency', icon: DollarSign },
    { id: 'heavy_hitter', name: 'Top Asset', icon: Award },
    { id: 'journey', name: 'Performance', icon: TrendingUp },
    { id: 'milestone', name: 'Milestone', icon: Target },
] as const;

export function ShareHubModal({ isOpen, onClose, initialTemplate = 'journey', data }: ShareHubModalProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(initialTemplate);
    const [maskAmounts, setMaskAmounts] = useState(true);
    const [showName, setShowName] = useState(true);
    const [aspectRatio, setAspectRatio] = useState<'story' | 'post'>('story');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(initialTemplate);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, initialTemplate]);

    if (!isOpen) return null;

    const handleShare = async (method: 'download' | 'share') => {
        setIsGenerating(true);
        try {
            // Render specific ID for capture
            const elementId = 'capture-target';
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
                    // Fallback to download if Web Share API not supported (e.g. Desktop)
                    alert("Web Share API not supported on this device. Downloading image instead.");
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

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                width: '100%', maxWidth: '1000px', height: '90vh',
                background: '#0f172a', borderRadius: '24px',
                border: '1px solid #1e293b', overflow: 'hidden',
                display: 'flex', flexDirection: 'row'
            }}>

                {/* LEFT COLUMN - CONFIGURATOR */}
                <div style={{
                    width: '350px', borderRight: '1px solid #1e293b',
                    display: 'flex', flexDirection: 'column', background: '#020617'
                }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Creation Studio</h2>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* 1. Presets */}
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Template</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {TEMPLATES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t.id as TemplateType)}
                                        style={{
                                            padding: '12px', borderRadius: '12px',
                                            background: selectedTemplate === t.id ? '#6366f1' : '#1e293b',
                                            border: 'none', color: selectedTemplate === t.id ? '#fff' : '#94a3b8',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        <t.icon size={20} />
                                        <span style={{ fontSize: '10px', fontWeight: 600 }}>{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Privacy */}
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Privacy Filters</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#e2e8f0', fontSize: '14px' }}>Mask Amounts</span>
                                    <PrivacyToggle checked={maskAmounts} onChange={setMaskAmounts} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#e2e8f0', fontSize: '14px' }}>Show Username</span>
                                    <PrivacyToggle checked={showName} onChange={setShowName} />
                                </div>
                            </div>
                        </div>

                        {/* 3. Format */}
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Format</label>
                            <div style={{ display: 'flex', gap: '8px', background: '#1e293b', padding: '4px', borderRadius: '8px' }}>
                                <button
                                    onClick={() => setAspectRatio('story')}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px',
                                        background: aspectRatio === 'story' ? '#334155' : 'transparent',
                                        color: aspectRatio === 'story' ? '#fff' : '#94a3b8',
                                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <Smartphone size={14} /> Story (9:16)
                                </button>
                                <button
                                    onClick={() => setAspectRatio('post')}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px',
                                        background: aspectRatio === 'post' ? '#334155' : 'transparent',
                                        color: aspectRatio === 'post' ? '#fff' : '#94a3b8',
                                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <Monitor size={14} /> Post (1:1)
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT COLUMN - PREVIEW */}
                <div style={{
                    flex: 1, background: '#0f172a',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '24px 24px'
                }}>
                    <div style={{
                        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)',
                        border: '8px solid #334155', borderRadius: aspectRatio === 'story' ? '32px' : '4px',
                        overflow: 'hidden'
                    }}>
                        {/* Hidden render target for clean capture */}
                        <div id="capture-target" style={{ display: 'flex' }}>
                            {renderTemplate()}
                        </div>
                    </div>

                    {/* ACTIONS - FLOATING BOTTOM */}
                    <div style={{
                        position: 'absolute', bottom: '32px',
                        background: '#1e293b', padding: '8px', borderRadius: '16px',
                        display: 'flex', gap: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                        border: '1px solid #334155'
                    }}>
                        <button
                            onClick={() => handleShare('download')}
                            disabled={isGenerating}
                            style={{
                                padding: '12px 24px', borderRadius: '12px',
                                background: '#334155', color: '#fff',
                                border: 'none', fontWeight: 700, fontSize: '14px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <Download size={18} /> {isGenerating ? 'Generating...' : 'Save Image'}
                        </button>
                        <button
                            onClick={() => handleShare('share')}
                            disabled={isGenerating}
                            style={{
                                padding: '12px 24px', borderRadius: '12px',
                                background: '#6366f1', color: '#fff',
                                border: 'none', fontWeight: 700, fontSize: '14px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <Share2 size={18} /> {isGenerating ? 'Sharing...' : 'Share Now'}
                        </button>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
}

const PrivacyToggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        style={{
            width: '40px', height: '24px', borderRadius: '12px',
            background: checked ? '#6366f1' : '#334155',
            position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
        }}
    >
        <div style={{
            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
            transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
    </button>
);
