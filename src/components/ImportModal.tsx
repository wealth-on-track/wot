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
}

export function ImportModal({ onClose }: ImportModalProps) {
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
    const [availablePortfolios, setAvailablePortfolios] = useState<{ id: string; name: string; isDefault?: boolean }[]>([]);

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
        if ((!parseResult?.rows || parseResult.rows.length === 0) && (!transactions || transactions.length === 0)) return;

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
                name: row.name,
                quantity: row.quantity,
                buyPrice: row.buyPrice,
                currency: row.currency as 'USD' | 'EUR' | 'TRY',
                type: row.type,
                platform: row.platform
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
                                name: tx.name || tx.symbol,
                                quantity: 0, // Closed/History only
                                buyPrice: 0,
                                currency: tx.currency as any,
                                type: isSpecialType ? 'CASH' : undefined,
                                platform: tx.platform
                            });
                            existingSymbols.add(tx.symbol);
                        }
                    }
                });
            }

            const result = await resolveImportSymbols(importAssets);

            if (result.success) {
                // Determine action
                const processed = result.resolved.map(a => {
                    // Logic:
                    // 1. If Quantity > 0 -> Add/Update (Open Position)
                    // 2. If Quantity = 0 -> Skip (Closed Position / History Only)
                    //    BUT for Account Statement, user wants to ensuring they are "imported". 
                    //    Our system interprets "skip" as "don't create Asset record if not exists", 
                    //    BUT "executeImport" WILL process transactions for skipped assets.
                    //    So "skip" is the correct action for history-only items.

                    const isClosedOrHistory = a.quantity === 0 && !a.existingAsset;
                    if (isClosedOrHistory) {
                        return { ...a, action: 'skip' as const };
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
            const result = await executeImport(resolvedAssets, transactions, selectedPortfolioId || undefined);
            setImportResult(result);
            setStep('done');

            // Refresh the page data
            router.refresh();
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
                    background: '#0F1115',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.6)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Minimalist Header */}
                <div style={{
                    padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.01)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Database size={16} color="white" />
                        </div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', letterSpacing: '-0.01em', margin: 0 }}>
                            Data Terminal
                        </h2>
                    </div>

                    {/* Minimalist Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {['Upload', 'Map', 'Success'].map((s, i) => {
                            const currentStepIdx = ['upload', 'analyzing', 'preview', 'resolving', 'review', 'importing', 'done'].indexOf(step);
                            const stepMap = [0, 1, 3]; // Simplified mapping: Upload=0-1, Map=2-5, Success=6

                            let isActive = false;
                            if (i === 0 && currentStepIdx <= 1) isActive = true;
                            if (i === 1 && currentStepIdx > 1 && currentStepIdx < 6) isActive = true;
                            if (i === 2 && currentStepIdx === 6) isActive = true;

                            return (
                                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? 'white' : 'rgba(255,255,255,0.3)',
                                        transition: 'color 0.3s'
                                    }}>
                                        {s}
                                    </span>
                                    {i < 2 && <span style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.1)' }} />}
                                </div>
                            )
                        })}
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '50%',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
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
                                        height: '400px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${isDragActive ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: '20px',
                                        backdropFilter: 'blur(20px)',
                                        cursor: 'pointer',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        boxShadow: isDragActive ? '0 0 30px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.1)' : 'none',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <input {...getInputProps()} />

                                    {/* Animated Cloud Icon */}
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: '2rem',
                                        animation: isDragActive ? 'bounce 1s infinite' : 'pulse 3s infinite ease-in-out'
                                    }}>
                                        <Cloud size={32} color={isDragActive ? '#60A5FA' : 'rgba(255,255,255,0.8)'} strokeWidth={1.5} />
                                    </div>

                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                                        {isDragActive ? 'Release to upload' : 'Drop your transaction history here'}
                                    </h3>

                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                        or <span style={{ color: '#60A5FA', textDecoration: 'underline' }}>Browse files</span>
                                    </p>

                                    {/* Supported Brokers Ticker */}
                                    <div style={{
                                        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
                                        maxWidth: '400px', opacity: 0.6
                                    }}>
                                        {brokers.map(b => (
                                            <span key={b} style={{
                                                fontSize: '0.75rem', padding: '0.3rem 0.8rem',
                                                borderRadius: '100px', background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                color: 'rgba(255,255,255,0.7)'
                                            }}>
                                                {b}
                                            </span>
                                        ))}
                                        <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', color: 'rgba(255,255,255,0.4)' }}>+ more</span>
                                    </div>

                                    {/* Safety Note */}
                                    <div style={{ position: 'absolute', bottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.4 }}>
                                        <Lock size={12} />
                                        <span style={{ fontSize: '0.7rem' }}>Processed locally. Raw files are never stored.</span>
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
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Zap size={16} className="text-amber-400" /> Smart Column Mapping
                                </h3>
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
                                    background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {Object.entries(parseResult.detectedColumns).map(([field, col]) => (
                                        <div key={field} style={{
                                            display: 'flex', flexDirection: 'column', gap: '2px',
                                            padding: '0.5rem 0.8rem', borderRadius: '8px',
                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{field}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#A7F3D0' }}>{col}</span>
                                                <Check size={12} color="#A7F3D0" />
                                            </div>
                                        </div>
                                    ))}
                                    {/* Show unmapped or potential issues if needed */}
                                </div>
                            </div>

                            {/* Data Preview Table */}
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '0.2rem' }}>Data Preview</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>First 50 rows of {parseResult.rows.length} records</p>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59,130,246,0.1)', padding: '0.3rem 0.8rem', borderRadius: '6px' }}>
                                    {parseResult.transactions?.length || 0} Transactions Found
                                </div>
                            </div>

                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
                                        <tr>
                                            {['Symbol', 'Name', 'Qty', 'Price', 'Currency', 'Type', 'Confidence'].map(h => (
                                                <th key={h} style={{ padding: '0.8rem', textAlign: h === 'Symbol' || h === 'Name' ? 'left' : 'right', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parseResult.rows.slice(0, 50).map((row, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.8rem', fontWeight: 600, color: 'white' }}>{row.symbol}</td>
                                                <td style={{ padding: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{row.name?.substring(0, 20)}...</td>
                                                <td style={{ padding: '0.8rem', textAlign: 'right', fontFamily: 'monospace', color: '#A7F3D0' }}>
                                                    {Number.isInteger(row.quantity) ? row.quantity.toLocaleString('de-DE') : row.quantity.toLocaleString('de-DE', { maximumFractionDigits: 5 })}
                                                </td>
                                                <td style={{ padding: '0.8rem', textAlign: 'right', fontFamily: 'monospace', color: 'white' }}>
                                                    {row.buyPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '0.8rem', textAlign: 'right' }}>{row.currency}</td>
                                                <td style={{ padding: '0.8rem', textAlign: 'right' }}>{row.type || '-'}</td>
                                                <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                                                    <span style={{
                                                        color: row.confidence >= 80 ? '#4ADE80' : '#FBBF24',
                                                        fontWeight: 700
                                                    }}>{row.confidence}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setStep('upload')} style={{ color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                <button
                                    onClick={handleProceedToResolve}
                                    style={{
                                        padding: '0.8rem 2rem', background: 'white', color: 'black', fontWeight: 700, borderRadius: '12px',
                                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                                    }}
                                >
                                    Run Import <ArrowRight size={18} />
                                </button>
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
                            {/* Portfolio Selection */}
                            <div style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Briefcase size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Target Portfolio</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Where should these assets be imported?</p>
                                    </div>
                                </div>

                                <select
                                    value={selectedPortfolioId}
                                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.8rem 1rem', borderRadius: '10px',
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: '0.95rem', cursor: 'pointer', outline: 'none'
                                    }}
                                >
                                    {availablePortfolios.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
                                    ))}
                                    {availablePortfolios.length === 0 && <option value="" disabled>Loading portfolios...</option>}
                                </select>
                            </div>

                            {/* Reuse existing Review UI logic but styled better */}
                            {/* Keeping this simple for brevity as user focused on DropZone/Mapping steps */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                {[
                                    { label: 'Open Positions', val: resolvedAssets.filter(a => a.quantity > 0).length, color: '#4ADE80' },
                                    { label: 'Closed Positions', val: resolvedAssets.filter(a => a.quantity === 0).length, color: '#60A5FA' }
                                ].map(s => (
                                    <div key={s.label} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {/* Simplified List for review */}
                                {resolvedAssets.map((a, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: a.action === 'skip' ? 'rgba(0,0,0,0.2)' : 'transparent'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                {a.resolvedSymbol.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'white' }}>{a.resolvedSymbol}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{a.resolvedName}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: 'white', fontFamily: 'monospace' }}>
                                                    {Number.isInteger(a.quantity) ? a.quantity.toLocaleString('de-DE') : a.quantity.toLocaleString('de-DE', { maximumFractionDigits: 5 })}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                                    @ {a.buyPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <select
                                                value={a.action}
                                                onChange={(e) => handleActionChange(i, e.target.value as any)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem',
                                                    width: 'auto', minWidth: '160px', cursor: 'pointer'
                                                }}
                                            >
                                                {a.quantity > 0 ? (
                                                    <>
                                                        <option value="add">Add to Open Positions</option>
                                                        {a.existingAsset && <option value="update">Update Position</option>}
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
                                <button onClick={() => setStep('preview')} style={{ color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Back</button>
                                <button
                                    onClick={handleImport}
                                    disabled={!selectedPortfolioId}
                                    style={{
                                        padding: '0.8rem 3rem', background: selectedPortfolioId ? '#4ADE80' : 'rgba(255,255,255,0.1)',
                                        color: selectedPortfolioId ? 'black' : 'rgba(255,255,255,0.3)', fontWeight: 800, borderRadius: '12px',
                                        border: 'none', cursor: selectedPortfolioId ? 'pointer' : 'not-allowed',
                                        boxShadow: selectedPortfolioId ? '0 0 30px rgba(74, 222, 128, 0.2)' : 'none'
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
        </div>
    );
}

