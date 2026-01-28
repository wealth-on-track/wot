"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, Plus, RefreshCw, Ban, ChevronDown, ChevronUp, Download, FileText, Cloud, Lock, Zap, Database, ArrowRight, Briefcase } from "lucide-react";
import { parseFile, ParseResult, ParsedRow, ParsedTransaction } from "@/lib/importParser";
import { resolveImportSymbols, executeImport, ResolvedAsset, ImportAsset } from "@/app/actions/import";
import { getUserPortfolios } from "@/app/actions/portfolio";
import { useRouter } from "next/navigation";

type ImportStep = 'upload' | 'analyzing' | 'preview' | 'resolving' | 'review' | 'importing' | 'done';

interface ImportModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<ImportStep>('upload');
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [resolvedAssets, setResolvedAssets] = useState<ResolvedAsset[]>([]);
    const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
    const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [analyzeProgress, setAnalyzeProgress] = useState(0);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
    const [targetPortfolioName, setTargetPortfolioName] = useState<string>('Main');
    const [availablePortfolios, setAvailablePortfolios] = useState<{ id: string; name: string; isDefault?: boolean }[]>([]);
    const [platformOverride, setPlatformOverride] = useState<string | null>(null);

    useEffect(() => {
        const loadPortfolios = async () => {
            const result = await getUserPortfolios();
            if (result.success && result.portfolios) {
                setAvailablePortfolios(result.portfolios);
                // Pre-select the default or first portfolio
                if (result.portfolios.length > 0) {
                    const defaultP = result.portfolios.find(p => p.isDefault) || result.portfolios[0];
                    setSelectedPortfolioId(defaultP.id);
                }
            }
        };
        loadPortfolios();
    }, []);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setError(null);
        const file = acceptedFiles[0];

        // Start analysis animation
        setStep('analyzing');
        setAnalyzeProgress(0);

        // Simulate analysis phases
        const phases = [10, 30, 45, 60, 80, 90];
        for (const p of phases) {
            setAnalyzeProgress(p);
            await new Promise(r => setTimeout(r, 150));
        }

        try {
            const result = await parseFile(file);
            setAnalyzeProgress(100);
            await new Promise(r => setTimeout(r, 300)); // Final pause

            setParseResult(result);
            if (result.transactions) {
                setTransactions(result.transactions);
            }

            if (result.success && result.rows.length > 0) {
                setStep('preview'); // Go directly to preview (portfolio selection will be in review step)
            } else if (result.errors.length > 0) {
                setError(result.errors.join('\n'));
                setStep('upload'); // Go back to fix error state
            } else {
                setError('No valid data found in file');
                setStep('upload');
            }
        } catch (e) {
            setError(`Failed to parse file: ${e}`);
            setStep('upload');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive, isDragAccept } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/plain': ['.txt']
        },
        maxFiles: 1
    });

    const handleProceedToResolve = async () => {
        console.log('[DEBUG] handleProceedToResolve called');
        console.log('[DEBUG] parseResult:', parseResult ? 'Present' : 'Null', 'Rows:', parseResult?.rows?.length);
        console.log('[DEBUG] transactions:', transactions ? 'Present' : 'Null', 'Length:', transactions?.length);

        // if ((!parseResult?.rows || parseResult.rows.length === 0) && (!transactions || transactions.length === 0)) {
        //     console.warn('[DEBUG] Early return triggered - No data');
        //     return;
        // }

        setStep('resolving');
        setError(null);

        try {
            // Check if this is a DeGiro Account Statement (detectedFormat === 'degiro')
            // Note: Parser returns 'degiro' for both, but we can check if rows contain non-trade types like DEPOSIT
            const isAccountStatement = transactions.some(t =>
                ['DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'INTEREST', 'FEE'].includes(t.type as string)
            );

            // 1. Get Open Positions from Rows (Trades aggregation)
            const importAssets: ImportAsset[] = (parseResult?.rows || []).map(row => ({
                symbol: row.symbol,
                isin: row.isin,  // Pass ISIN for resolution
                name: row.name,
                quantity: row.quantity,
                buyPrice: row.buyPrice,
                currency: row.currency as 'USD' | 'EUR' | 'TRY',
                type: row.type,
                platform: platformOverride || row.platform
            }));

            // 2. Add Closed Positions and Special Items from Transactions
            const existingSymbols = new Set(importAssets.map(a => a.symbol));

            if (transactions) {
                transactions.forEach(tx => {
                    const isSpecialType = ['DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'INTEREST', 'FEE', 'FX'].includes(tx.type as string);

                    if (isSpecialType || !existingSymbols.has(tx.symbol)) {
                        // For special types, we might want unique entries if symbol is generic (like EUR or FEES)
                        // But importing multiple "EUR" assets isn't right. We just need one "EUR" asset to attach history to.
                        // However, user said "show in closed positions". 
                        // Actually, for Cash/Fees, we usually attach to a 'CASH' or system asset. 
                        // But here we just ensure the symbol is in the list so it passes to `executeImport`.

                        // Prevent duplicates in `importAssets` list
                        if (!existingSymbols.has(tx.symbol)) {
                            importAssets.push({
                                symbol: tx.symbol, // EUR, FEES, or Asset Symbol
                                isin: tx.isin,     // Pass ISIN for resolution
                                name: tx.name || tx.symbol,
                                quantity: 0, // Closed/History only
                                buyPrice: 0,
                                currency: tx.currency as any,
                                type: isSpecialType ? 'CASH' : undefined,
                                platform: platformOverride || tx.platform
                            });
                            existingSymbols.add(tx.symbol);
                        }
                    }
                });
            }

            const result = await resolveImportSymbols(importAssets);

            console.log('[DEBUG UI] Resolved Assets:', result.resolved);

            if (result.success) {
                // Determine action
                const processed = result.resolved.map(a => {
                    // Logic:
                    // 1. If Quantity > 0 -> Add/Update (Open Position)
                    // 2. If Quantity = 0 -> Close (Closed Position)
                    //    Using 'close' instead of 'skip' ensures an Asset record is created
                    //    with the correct customGroup (portfolio name), so getClosedPositions
                    //    can display the portfolio name correctly.

                    const isClosedOrHistory = a.quantity === 0 && !a.existingAsset;
                    if (isClosedOrHistory) {
                        return { ...a, action: 'close' as const };
                    }
                    return a;
                });

                setResolvedAssets(processed);
                setStep('review');
            } else {
                setError(result.errors.join('\n'));
                setStep('preview');
            }
        } catch (e) {
            setError(`Failed to resolve symbols: ${e}`);
            setStep('preview');
        }
    };

    const handleActionChange = (index: number, action: 'add' | 'update' | 'skip') => {
        setResolvedAssets(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], action };
            return updated;
        });
    };

    const handleImport = async () => {
        setStep('importing');
        setError(null);

        try {
            const result = await executeImport(resolvedAssets, transactions, selectedPortfolioId || undefined, targetPortfolioName);
            setImportResult(result);
            setStep('done');

            // Refresh the page data
            router.refresh();
            if (onSuccess) onSuccess();
        } catch (e) {
            setError(`Import failed: ${e}`);
            setStep('review');
        }
    };

    const toggleRowExpand = (index: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    // Calculate stats for review
    const addCount = resolvedAssets.filter(a => a.action === 'add').length;
    const updateCount = resolvedAssets.filter(a => a.action === 'update').length;
    const skipCount = resolvedAssets.filter(a => a.action === 'skip').length;

    const handleDownloadTemplate = () => {
        const headers = ['Symbol', 'Quantity', 'Buy Price', 'Currency', 'Name', 'Type', 'Platform'];
        const sampleRow = ['AAPL', '10', '150.50', 'USD', 'Apple Inc.', 'STOCK', 'Interactive Brokers'];
        const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'portfolio_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper for Broker Logos (Text badges for now as per instructions)
    const brokers = ['Degiro', 'IBKR', 'Binance', 'Revolut', 'Trading212', 'Midas', 'Coinbase'];

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(10px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="neo-card"
                style={{
                    width: '100%',
                    maxWidth: (step === 'upload' || step === 'analyzing') ? '600px' : '1000px',
                    borderRadius: '24px',
                    padding: '0', // Full bleed
                    position: 'relative',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-xl)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Minimalist Header */}
                <div style={{
                    padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-primary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            <Database size={16} color="white" />
                        </div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
                            Data Terminal
                        </h2>
                    </div>

                    {/* Minimalist Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {['Upload', 'Map', 'Success'].map((s, i) => {
                            const currentStepIdx = ['upload', 'analyzing', 'preview', 'resolving', 'review', 'importing', 'done'].indexOf(step);
                            // const stepMap = [0, 1, 3]; // Simplified mapping

                            let isActive = false;
                            if (i === 0 && currentStepIdx <= 1) isActive = true;
                            if (i === 1 && currentStepIdx > 1 && currentStepIdx < 6) isActive = true;
                            if (i === 2 && currentStepIdx === 6) isActive = true;

                            return (
                                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                        transition: 'color 0.3s'
                                    }}>
                                        {s}
                                    </span>
                                    {i < 2 && <span style={{ width: '20px', height: '1px', background: 'var(--border)' }} />}
                                </div>
                            )
                        })}
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '50%',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '2rem' }}>

                    {/* Step 1: Magnetic Drop Zone */}
                    {(step === 'upload' || step === 'analyzing') && (
                        <div className="animate-in fade-in duration-500">
                            {step === 'upload' ? (
                                <div
                                    {...getRootProps()}
                                    style={{
                                        position: 'relative',
                                        height: '320px', // Slightly reduced height
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--bg-card)',
                                        border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`, // Dashed border is better for dropzones
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        boxShadow: isDragActive ? 'var(--shadow-lg)' : 'none',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <input {...getInputProps()} />

                                    {/* Animated Cloud Icon */}
                                    {/* Animated Cloud Icon */}
                                    <div style={{
                                        width: '60px', height: '60px', borderRadius: '50%',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: '1.5rem',
                                        animation: isDragActive ? 'bounce 1s infinite' : 'pulse 3s infinite ease-in-out',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}>
                                        <Cloud size={24} color={isDragActive ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth={2} />
                                    </div>

                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', letterSpacing: '-0.02em', textAlign: 'center' }}>
                                        {isDragActive ? 'Release to upload' : 'Drop your transaction history here'}
                                    </h3>

                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                                        Supports CSV, Excel, TXT from major brokers
                                    </p>

                                    <div style={{ marginTop: '1rem' }}>
                                        <span style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 600 }}>Browse files</span>
                                    </div>

                                    {/* Safety Note */}
                                    <div style={{ position: 'absolute', bottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                                        <Lock size={12} color="var(--text-muted)" />
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Processed locally. Raw files are never stored.</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{ width: '300px', marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60A5FA' }}>Analyzing Data Structures...</span>
                                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{analyzeProgress}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${analyzeProgress}%`, height: '100%', background: '#60A5FA', transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                    <div style={{ opacity: 0.5, fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                                        {analyzeProgress < 30 ? '> Reading CSV stream...' :
                                            analyzeProgress < 60 ? '> Detecting delimiter...' :
                                                analyzeProgress < 80 ? '> Mapping columns...' :
                                                    '> Validating types...'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Smart Mapping & Preview */}
                    {(step === 'preview' || step === 'resolving') && parseResult && (
                        <div className="animate-in slide-in-from-bottom-8 duration-500">
                            {/* Mapping Visualization */}

                            <div
                                className="flex flex-col bg-card border border-border/40 rounded-2xl overflow-hidden"
                                style={{ height: '560px', boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.02)' }}
                            >
                                {/* Single Toolbar Header */}
                                {/* Ultra Compact Toolbar */}
                                <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '64px' }}>

                                    {/* Mappings (Main Center) */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', scrollbarWidth: 'none', paddingRight: '1rem', height: '100%' }}>
                                        {Object.entries(parseResult.detectedColumns).map(([field, col]) => (
                                            <div key={field} className="flex flex-col items-start justify-center bg-muted/30 rounded-lg px-2.5 py-1.5 min-w-[65px] shrink-0 transition-all duration-150 hover:bg-muted/50 cursor-default group">
                                                <span className="text-[0.55rem] uppercase text-muted-foreground/70 font-semibold leading-none mb-1.5 tracking-wide">{field.substring(0, 10)}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[0.7rem] font-semibold text-foreground leading-none whitespace-nowrap max-w-[75px] overflow-hidden text-ellipsis">{col}</span>
                                                    <Check size={7} className="text-emerald-600 opacity-60" strokeWidth={2.5} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Source (Right) - Aligned */}
                                    <div style={{ flexShrink: 0, paddingLeft: '1.5rem', borderLeft: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', height: '100%' }}>
                                        <span style={{ fontSize: '0.55rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.7, letterSpacing: '0.05em', lineHeight: 1 }}>SOURCE</span>
                                        <select
                                            value={platformOverride || (parseResult.rows[0]?.platform) || 'Unknown'}
                                            onChange={(e) => setPlatformOverride(e.target.value)}
                                            className="px-2.5 py-1 rounded-lg bg-muted/30 border-0 text-foreground font-semibold text-xs outline-none cursor-pointer text-right h-7 hover:bg-muted/50 transition-all"
                                        >
                                            <option value="Degiro">Degiro</option>
                                            <option value="Interactive Brokers">IBKR</option>
                                            <option value="Binance">Binance</option>
                                            <option value="Midas">Midas</option>
                                            <option value="Trading212">T212</option>
                                            <option value="Revolut">Revolut</option>
                                            <option value="Coinbase">Coinbase</option>
                                            <option value="Kraken">Kraken</option>
                                            <option value="Custom">Custom</option>
                                        </select>
                                        {platformOverride === 'Custom' && (
                                            <input
                                                type="text"
                                                placeholder="Enter platform..."
                                                onChange={(e) => setPlatformOverride(e.target.value || 'Custom')}
                                                className="px-2.5 py-1 rounded-lg bg-muted/30 border border-border text-foreground font-medium text-xs outline-none h-7 w-28 mt-1"
                                                autoFocus
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Table */}
                                <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-card)' }}>
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
                                            <tr>
                                                <th className="pl-6 py-4 text-left font-semibold text-foreground/90 text-sm tracking-tight border-b border-border/30">
                                                    Data Preview <span className="text-muted-foreground/60 font-medium text-[0.7rem] ml-2">Top 50</span>
                                                </th>
                                                {['Qty', 'Price', 'Currency', 'Type'].map(h => (
                                                    <th key={h} className="px-3 py-4 text-right font-medium text-muted-foreground/60 text-[0.7rem] uppercase tracking-wide border-b border-border/30">{h}</th>
                                                ))}
                                                <th className="px-3 py-4 text-right font-medium text-muted-foreground/60 text-[0.7rem] uppercase tracking-wide border-b border-border/30">Conf.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parseResult.rows.slice(0, 50).map((row, idx) => (
                                                <tr key={idx} className="border-b border-border/20 hover:bg-muted/20 transition-colors group">
                                                    <td style={{ padding: '0.8rem 1.5rem' }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.symbol}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.name?.substring(0, 25)}</div>
                                                    </td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)' }}>
                                                        {Number.isInteger(row.quantity) ? row.quantity.toLocaleString('de-DE') : row.quantity.toLocaleString('de-DE', { maximumFractionDigits: 5 })}
                                                    </td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                                        {row.buyPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.currency}</td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.type || '-'}</td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                                                        <span style={{ color: row.confidence >= 80 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>{row.confidence}%</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem' }}>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-foreground font-semibold text-base tabular-nums">{parseResult.transactions?.length || 0}</span>
                                        <span className="text-muted-foreground/60 font-medium text-[0.7rem] uppercase tracking-wider">Transactions</span>
                                    </div>
                                    <div className="w-px h-4 bg-border/40"></div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-foreground font-semibold text-base tabular-nums">{parseResult.rows.length}</span>
                                        <span className="text-muted-foreground/60 font-medium text-[0.7rem] uppercase tracking-wider">Records</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => setStep('upload')} className="text-muted-foreground/70 bg-transparent border-0 cursor-pointer font-medium text-sm hover:text-foreground/90 transition-colors">Cancel</button>
                                    <button
                                        onClick={(e) => {
                                            console.log('[DEBUG-INLINE] Button Clicked');
                                            handleProceedToResolve();
                                        }}
                                        className="px-6 py-2.5 bg-foreground text-background font-semibold rounded-xl border-0 cursor-pointer flex items-center gap-2 hover:opacity-90 transition-opacity"
                                        style={{ boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.12)' }}
                                    >
                                        <span>Run Import (Debug)</span> <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step: Resolving Indicator */}
                    {step === 'resolving' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 17, 21, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <div style={{ textAlign: 'center' }}>
                                <Loader2 size={48} className="animate-spin" color="#60A5FA" style={{ marginBottom: '1rem', marginInline: 'auto' }} />
                                <h3 style={{ color: 'white' }}>Matching Assets...</h3>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review & Commit */}
                    {step === 'review' && (
                        <div className="animate-in fade-in duration-500">
                            {/* Portfolio Selection + Stats - Ultra Compact */}
                            <div style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {/* Left: Icon + Title + Input */}
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent)/20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Briefcase size={16} style={{ color: 'var(--accent)' }} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Target Portfolio</h3>
                                            <input
                                                type="text"
                                                value={targetPortfolioName}
                                                onChange={(e) => setTargetPortfolioName(e.target.value)}
                                                placeholder="e.g. Main, Long Term..."
                                                style={{
                                                    width: '200px', padding: '0.5rem 0.7rem', borderRadius: '6px',
                                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                                    color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {/* Right: Stats */}
                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginLeft: 'auto' }}>
                                        {[
                                            { label: 'Open', val: resolvedAssets.filter(a => a.quantity > 0).length, color: 'var(--success)' },
                                            { label: 'Closed', val: resolvedAssets.filter(a => a.quantity === 0).length, color: 'var(--accent)' }
                                        ].map(s => (
                                            <div key={s.label} style={{ padding: '0.4rem 0.65rem', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center', minWidth: '55px' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Hidden select to maintain ID logic if multiple DB portfolios are supported in future */}
                                <div style={{ display: 'none' }}>
                                    <select
                                        value={selectedPortfolioId}
                                        onChange={(e) => setSelectedPortfolioId(e.target.value)}
                                    >
                                        {availablePortfolios.map(p => (
                                            <option key={p.id} value={p.id}>{p.id}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                {/* Asset List for review */}
                                {resolvedAssets.map((a, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem 1.5rem', borderBottom: i < resolvedAssets.length - 1 ? '1px solid var(--border)' : 'none',
                                        background: a.action === 'skip' ? 'var(--bg-surface)' : 'transparent'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {/* Logo */}
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: 'var(--bg-surface)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)',
                                                border: '1px solid var(--border)',
                                                overflow: 'hidden'
                                            }}>
                                                {a.logoUrl ? (
                                                    <img
                                                        src={a.logoUrl}
                                                        alt={a.resolvedSymbol}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement!.textContent = a.resolvedSymbol.substring(0, 2);
                                                        }}
                                                    />
                                                ) : (
                                                    a.resolvedSymbol.substring(0, 2)
                                                )}
                                            </div>
                                            {/* Name + Ticker + ISIN */}
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                                        {a.resolvedName || a.name}
                                                    </span>
                                                    {/* Ticker Badge - always show */}
                                                    {a.resolvedSymbol && (
                                                        <span style={{
                                                            background: a.resolvedSymbol !== a.isin ? 'var(--accent)' : 'var(--bg-surface)',
                                                            color: a.resolvedSymbol !== a.isin ? 'white' : 'var(--text-muted)',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            letterSpacing: '0.5px',
                                                            border: a.resolvedSymbol === a.isin ? '1px solid var(--border)' : 'none'
                                                        }}>
                                                            {a.resolvedSymbol}
                                                        </span>
                                                    )}
                                                    {/* Verification Status */}
                                                    {a.matchSource === 'MEMORY' && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 600 }}>✓</span>
                                                    )}
                                                    {a.matchSource === 'SEARCH' && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--warning)', fontWeight: 600 }}>?</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {/* ISIN - only show if different from resolvedSymbol */}
                                                    {a.isin && a.isin !== a.resolvedSymbol && (
                                                        <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{a.isin}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {Number.isInteger(a.quantity) ? a.quantity.toLocaleString('de-DE') : a.quantity.toLocaleString('de-DE', { maximumFractionDigits: 5 })}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    @ {a.buyPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <select
                                                value={a.action}
                                                onChange={(e) => handleActionChange(i, e.target.value as any)}
                                                className="bg-background border border-border text-foreground px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:border-primary/50 transition-colors"
                                                style={{ minWidth: '180px' }}
                                            >
                                                {a.quantity > 0 ? (
                                                    <>
                                                        <option value="add">Add to Open Positions</option>
                                                        {a.existingAsset && <option value="update">Update Position</option>}
                                                        <option value="close">Add to Closed Positions</option>
                                                        <option value="skip">Skip</option>
                                                    </>
                                                ) : (
                                                    <option value="skip">Add to Closed Positions</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setStep('preview')} className="text-muted-foreground/70 bg-transparent border-0 cursor-pointer font-medium text-sm hover:text-foreground/90 transition-colors px-4 py-2">Back</button>
                                <button
                                    onClick={handleImport}
                                    disabled={!selectedPortfolioId}
                                    className="px-8 py-3 font-semibold rounded-xl border-0 cursor-pointer flex items-center gap-2 transition-all"
                                    style={{
                                        background: selectedPortfolioId ? 'var(--accent)' : 'var(--bg-surface)',
                                        color: selectedPortfolioId ? 'white' : 'var(--text-muted)',
                                        cursor: selectedPortfolioId ? 'pointer' : 'not-allowed',
                                        boxShadow: selectedPortfolioId ? '0 4px 12px -2px rgba(96, 165, 250, 0.3)' : 'none',
                                        opacity: selectedPortfolioId ? 1 : 0.5
                                    }}
                                >
                                    Complete Import
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Importing Spinner */}
                    {step === 'importing' && (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>
                            <div className="animate-spin" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#60A5FA', margin: '0 auto 2rem' }} />
                            <h3 style={{ fontSize: '1.5rem', color: 'white' }}>Importing your wealth...</h3>
                            <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '1rem' }}>
                                Processing transactions for trades, dividends, and cash flow...
                            </p>
                        </div>
                    )}

                    {/* Step 4: Success */}
                    {step === 'done' && importResult && (
                        <div className="animate-in zoom-in duration-500" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{
                                width: '100px', height: '100px', borderRadius: '50%',
                                background: '#10B981', margin: '0 auto 2rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 50px rgba(16, 185, 129, 0.4)'
                            }}>
                                <Check size={50} color="black" strokeWidth={3} />
                            </div>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem', letterSpacing: '-0.03em' }}>
                                Import Complete
                            </h2>
                            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem' }}>
                                {importResult.added} assets added, {importResult.updated} updated.
                                {(importResult as any).txAdded !== undefined && (importResult as any).txAdded > 0 && (
                                    <span style={{ display: 'block', marginTop: '0.5rem', color: '#60A5FA', fontWeight: 600 }}>
                                        ✓ {(importResult as any).txAdded} transactions saved to history.
                                    </span>
                                )}
                                {importResult.errors && importResult.errors.length > 0 && (
                                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'left' }}>
                                        <div style={{ color: '#F87171', fontWeight: 700, marginBottom: '0.5rem' }}>Import Issues ({importResult.errors.length}):</div>
                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#FCA5A5', fontSize: '0.9rem', maxHeight: '100px', overflowY: 'auto' }}>
                                            {importResult.errors.slice(0, 5).map((err: string, i: number) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                            {importResult.errors.length > 5 && <li>...and {importResult.errors.length - 5} more</li>}
                                        </ul>
                                    </div>
                                )}
                            </p>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '1rem 4rem', background: 'white', color: 'black', fontWeight: 700, borderRadius: '100px',
                                    border: 'none', cursor: 'pointer', fontSize: '1.1rem',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                Launch Dashboard
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* Global Style for animations */}
            <style jsx global>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.1); transform: scale(1); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); transform: scale(1.02); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); transform: scale(1); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
        </div >
    );
}

