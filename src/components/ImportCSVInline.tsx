"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Check, Loader2, ArrowRight, Lock, Cloud, Database, AlertCircle } from "lucide-react";
import { parseFile, ParseResult, ParsedTransaction } from "@/lib/importParser";
import { resolveImportSymbols, executeImport, ResolvedAsset, ImportAsset } from "@/app/actions/import";
import { getUserPortfolios } from "@/app/actions/portfolio";
import { useRouter } from "next/navigation";

type ImportStep = 'upload' | 'analyzing' | 'preview' | 'resolving' | 'review' | 'importing' | 'done';

interface ImportCSVInlineProps {
    onSuccess?: (stats?: { open: number; closed: number; statement: number }) => void;
    onCancel?: () => void;
}

export function ImportCSVInline({ onSuccess, onCancel }: ImportCSVInlineProps) {
    const router = useRouter();
    const [step, setStep] = useState<ImportStep>('upload');
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [resolvedAssets, setResolvedAssets] = useState<ResolvedAsset[]>([]);
    const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
    // Map to store resolved tickers for preview display (symbol/isin -> ticker, name, logoUrl)
    const [tickerMap, setTickerMap] = useState<Map<string, { ticker: string; name: string; logoUrl?: string }>>(new Map());
    const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [analyzeProgress, setAnalyzeProgress] = useState(0);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
    const [targetPortfolioName, setTargetPortfolioName] = useState<string>('Main');
    const [availablePortfolios, setAvailablePortfolios] = useState<{ id: string; name: string; isDefault?: boolean }[]>([]);
    const [platformOverride, setPlatformOverride] = useState<string | null>(null);
    const [customPlatformName, setCustomPlatformName] = useState<string>('');

    useEffect(() => {
        const loadPortfolios = async () => {
            const result = await getUserPortfolios();
            if (result.success && result.portfolios) {
                setAvailablePortfolios(result.portfolios);
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

        setStep('analyzing');
        setAnalyzeProgress(0);

        const phases = [10, 30, 45, 60, 80, 90];
        for (const p of phases) {
            setAnalyzeProgress(p);
            await new Promise(r => setTimeout(r, 150));
        }

        try {
            const result = await parseFile(file);
            setAnalyzeProgress(100);
            await new Promise(r => setTimeout(r, 300));

            setParseResult(result);
            if (result.transactions) {
                setTransactions(result.transactions);
            }

            if (result.success && result.rows.length > 0) {
                setStep('preview');

                // Start background Yahoo resolution to get tickers for preview
                const importAssets: ImportAsset[] = result.rows.map(row => ({
                    symbol: row.symbol,
                    isin: row.isin,
                    name: row.name,
                    quantity: row.quantity,
                    buyPrice: row.buyPrice,
                    currency: row.currency as 'USD' | 'EUR' | 'TRY',
                    type: row.type,
                    platform: row.platform
                }));

                // Fire and forget - resolve in background
                resolveImportSymbols(importAssets).then(resolveResult => {
                    if (resolveResult.success) {
                        const newTickerMap = new Map<string, { ticker: string; name: string; logoUrl?: string }>();
                        resolveResult.resolved.forEach(asset => {
                            const data = {
                                ticker: asset.resolvedSymbol,
                                name: asset.resolvedName,
                                logoUrl: asset.logoUrl
                            };
                            // Map by ISIN (primary key for matching)
                            if (asset.isin) {
                                newTickerMap.set(asset.isin, data);
                            }
                            // Also map by original symbol
                            if (asset.symbol) {
                                newTickerMap.set(asset.symbol, data);
                            }
                        });
                        setTickerMap(newTickerMap);
                    }
                }).catch(err => {
                    console.warn('[ImportCSV] Background ticker resolution failed:', err);
                });
            } else if (result.errors.length > 0) {
                setError(result.errors.join('\n'));
                setStep('upload');
            } else {
                setError('No valid data found in file');
                setStep('upload');
            }
        } catch (e) {
            setError(`Failed to parse file: ${e}`);
            setStep('upload');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/plain': ['.txt']
        },
        maxFiles: 1
    });

    // Auto-trigger import when Review step is reached (skip manual review)
    useEffect(() => {
        if (step === 'review' && resolvedAssets.length > 0 && selectedPortfolioId) {
            handleImport();
        }
    }, [step, resolvedAssets.length, selectedPortfolioId]);

    const handleProceedToResolve = async () => {
        console.log('[DEBUG-INLINE] handleProceedToResolve called');
        console.log('[DEBUG-INLINE] parseResult:', parseResult ? 'Present' : 'Null', 'Rows:', parseResult?.rows?.length);
        console.log('[DEBUG-INLINE] transactions:', transactions ? 'Present' : 'Null', 'Length:', transactions?.length);

        // if ((!parseResult?.rows || parseResult.rows.length === 0) && (!transactions || transactions.length === 0)) return;

        setStep('resolving');
        setError(null);

        try {
            const importAssets: ImportAsset[] = (parseResult?.rows || []).map(row => ({
                symbol: row.symbol,
                isin: row.isin,
                name: row.name,
                quantity: row.quantity,
                buyPrice: row.buyPrice,
                currency: row.currency as 'USD' | 'EUR' | 'TRY',
                type: row.type,
                platform: platformOverride === 'Custom' ? customPlatformName : (platformOverride || row.platform)
            }));

            const existingSymbols = new Set(importAssets.map(a => a.symbol));

            // Transactions loop removed - parser now handles all asset types (including CASH) via balance column
            // This prevents duplication of assets and ensures consistency with parser's balance logic

            const result = await resolveImportSymbols(importAssets);

            if (result.success) {
                const processed = result.resolved.map(a => {
                    // For closed positions (quantity === 0), use 'close' action instead of 'skip'
                    // This ensures an Asset record is created with the correct customGroup (portfolio name)
                    // so that getClosedPositions can display the portfolio name correctly
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

            router.refresh();
            if (onSuccess) {
                const openCount = resolvedAssets.filter(r => categorizeRow(r) === 'open').length;
                const closedCount = resolvedAssets.filter(r => categorizeRow(r) === 'closed').length;
                const statementCount = resolvedAssets.filter(r => categorizeRow(r) === 'statement').length;

                onSuccess({ open: openCount, closed: closedCount, statement: statementCount });
            }
        } catch (e) {
            setError(`Import failed: ${e}`);
            setStep('review');
        }
    };

    const categorizeRow = (row: any): 'open' | 'closed' | 'statement' => {
        // CASH type always → Statement (EUR, USD, etc.)
        if (row.type && row.type.toUpperCase() === 'CASH') {
            return 'statement';
        }

        // Special transaction types → Statement
        const statementTypes = ['DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'FEE', 'COUPON'];
        if (row.type && statementTypes.includes(row.type.toUpperCase())) {
            return 'statement';
        }

        // Positions with quantity > 0 → Open
        if (row.quantity > 0.00001) {
            return 'open';
        }

        // Zero quantity positions → Closed
        return 'closed';
    };

    const formatNumber = (num: number, decimals: number = 2): string => {
        if (decimals === -1) {
            // Flexible decimals: integer if whole, otherwise up to 4 decimals
            if (num % 1 === 0) return num.toLocaleString('de-DE'); // Use German locale for dots as thousands separator

            // Format with max 4 decimals, removing trailing zeros if needed
            return num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
        }

        const [integer, decimal] = num.toFixed(decimals).split('.');
        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimal ? `${formattedInteger},${decimal}` : formattedInteger;
    };

    return (
        <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <Database size={16} color="white" />
                    </div>
                    <h2 style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0
                    }}>
                        Import CSV
                    </h2>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {['Upload', 'Map', 'Success'].map((s, i) => {
                        const currentStepIdx = ['upload', 'analyzing', 'preview', 'resolving', 'review', 'importing', 'done'].indexOf(step);
                        let isActive = false;
                        if (i === 0 && currentStepIdx <= 1) isActive = true;
                        if (i === 1 && currentStepIdx > 1 && currentStepIdx < 6) isActive = true;
                        if (i === 2 && currentStepIdx === 6) isActive = true;

                        return (
                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                    transition: 'color 0.3s'
                                }}>
                                    {s}
                                </span>
                                {i < 2 && <span style={{ width: '20px', height: '1px', background: 'var(--border)' }} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
                {/* Upload Step */}
                {(step === 'upload' || step === 'analyzing') && (
                    <div>
                        {step === 'upload' ? (
                            <div
                                {...getRootProps()}
                                style={{
                                    height: '320px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-card)',
                                    border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: isDragActive ? 'var(--shadow-lg)' : 'none'
                                }}
                            >
                                <input {...getInputProps()} />

                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '24px',
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <Cloud size={24} color={isDragActive ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth={2} />
                                </div>

                                <h3 style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    marginBottom: '12px',
                                    textAlign: 'center'
                                }}>
                                    {isDragActive ? 'Release to upload' : 'Drop your transaction history here'}
                                </h3>

                                <p style={{
                                    color: 'var(--text-muted)',
                                    fontSize: '14px',
                                    marginBottom: '16px',
                                    textAlign: 'center'
                                }}>
                                    Supports CSV, Excel, TXT from major brokers
                                </p>

                                <div style={{ marginTop: '16px' }}>
                                    <span style={{
                                        color: 'var(--accent)',
                                        textDecoration: 'underline',
                                        fontWeight: 600
                                    }}>
                                        Browse files
                                    </span>
                                </div>

                                <div style={{
                                    position: 'absolute',
                                    bottom: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: 0.6
                                }}>
                                    <Lock size={12} color="var(--text-muted)" />
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Processed locally. Raw files are never stored.
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                height: '320px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'var(--bg-card)',
                                borderRadius: '16px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ width: '300px', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                                            Analyzing Data Structures...
                                        </span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {analyzeProgress}%
                                        </span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '4px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${analyzeProgress}%`,
                                            height: '100%',
                                            background: 'var(--accent)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>
                                <div style={{
                                    opacity: 0.7,
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-muted)'
                                }}>
                                    {analyzeProgress < 30 ? '> Reading CSV stream...' :
                                        analyzeProgress < 60 ? '> Detecting delimiter...' :
                                            analyzeProgress < 80 ? '> Mapping columns...' :
                                                '> Validating types...'}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Preview Step */}
                {(step === 'preview' || step === 'resolving') && parseResult && (
                    <div>
                        <div style={{
                            background: 'var(--bg-primary)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 20px',
                            borderRadius: '12px 12px 0 0',
                            marginBottom: '16px'
                        }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
                                {Object.entries(parseResult.detectedColumns).map(([field, col]) => (
                                    <div key={field} style={{
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        padding: '6px 12px',
                                        minWidth: '80px'
                                    }}>
                                        <div style={{
                                            fontSize: '9px',
                                            textTransform: 'uppercase',
                                            color: 'var(--text-muted)',
                                            fontWeight: 700,
                                            marginBottom: '4px'
                                        }}>
                                            {field.substring(0, 10)}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {col}
                                            <Check size={10} color="var(--success)" strokeWidth={3} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                paddingLeft: '20px',
                                borderLeft: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: 'var(--text-muted)'
                                    }}>
                                        PORTFOLIO:
                                    </span>
                                    <input
                                        type="text"
                                        value={targetPortfolioName}
                                        onChange={(e) => setTargetPortfolioName(e.target.value)}
                                        placeholder="Main"
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            width: '120px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ width: '1px', height: '20px', background: 'var(--border)' }}></div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: 'var(--text-muted)'
                                    }}>
                                        PLATFORM:
                                    </span>
                                    {platformOverride === 'Custom' ? (
                                        <input
                                            type="text"
                                            placeholder="Enter platform name"
                                            value={customPlatformName}
                                            autoFocus
                                            onChange={(e) => setCustomPlatformName(e.target.value)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--accent)',
                                                color: 'var(--text-primary)',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                width: '100px',
                                                outline: 'none'
                                            }}
                                        />
                                    ) : (
                                        <select
                                            value={platformOverride || (parseResult.rows[0]?.platform) || 'Unknown'}
                                            onChange={(e) => {
                                                setPlatformOverride(e.target.value);
                                                if (e.target.value === 'Custom') {
                                                    setCustomPlatformName('');
                                                }
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                width: '100px'
                                            }}
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
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Ticker Resolution Status Bar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            marginBottom: '12px',
                            borderRadius: '8px',
                            background: tickerMap.size > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            border: `1px solid ${tickerMap.size > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            transition: 'all 0.3s ease'
                        }}>
                            {tickerMap.size === 0 ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                                    <span style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--accent)'
                                    }}>
                                        Resolving tickers & fetching logos from Yahoo Finance...
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} style={{ color: 'var(--success)' }} strokeWidth={3} />
                                    <span style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--success)'
                                    }}>
                                        {tickerMap.size} assets resolved
                                    </span>
                                </>
                            )}
                        </div>

                        <div style={{
                            maxHeight: '400px',
                            overflow: 'auto',
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{
                                            padding: '12px 20px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid var(--border)',
                                            width: '100px'
                                        }}>
                                            Category
                                        </th>
                                        <th style={{
                                            padding: '12px 20px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid var(--border)'
                                        }}>
                                            Data Preview
                                        </th>
                                        {['Qty', 'Price', 'Currency', 'Type', 'Conf.'].map(h => (
                                            <th key={h} style={{
                                                padding: '12px',
                                                textAlign: 'right',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                borderBottom: '1px solid var(--border)'
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>

                                </thead>
                                <tbody>
                                    {parseResult.rows
                                        .slice(0, 50)
                                        .map((row, idx) => ({ ...row, category: categorizeRow(row), originalIndex: idx }))
                                        .sort((a, b) => {
                                            // Sort by category: Open (0), Closed (1), Statement (2)
                                            const order = { open: 0, closed: 1, statement: 2 };
                                            return order[a.category] - order[b.category];
                                        })
                                        .map((row, idx) => {
                                            const category = row.category;
                                            const categoryColors = {
                                                open: { bg: 'rgba(34, 197, 94, 0.08)', badge: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Open' },
                                                closed: { bg: 'rgba(100, 116, 139, 0.05)', badge: 'rgba(100, 116, 139, 0.15)', text: '#64748b', label: 'Closed' },
                                                statement: { bg: 'rgba(59, 130, 246, 0.08)', badge: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Statement' }
                                            };
                                            const colors = categoryColors[category];

                                            // User Request: "Just write whatever the ticker is"
                                            // Row 1: Asset Name
                                            // Row 2: Ticker

                                            return (
                                                <tr key={idx} style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    background: colors.bg,
                                                    transition: 'background 0.2s'
                                                }}>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{
                                                            display: 'inline-block',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            background: colors.badge,
                                                            color: colors.text,
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {colors.label}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            {/* Logo */}
                                                            {(() => {
                                                                const resolved = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);
                                                                const logoUrl = resolved?.logoUrl;
                                                                const ticker = resolved?.ticker;

                                                                return (
                                                                    <div style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '50%',
                                                                        background: 'var(--bg-secondary)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '10px',
                                                                        fontWeight: 700,
                                                                        color: 'var(--text-muted)',
                                                                        border: '1px solid var(--border)',
                                                                        overflow: 'hidden',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        {logoUrl ? (
                                                                            <img
                                                                                src={logoUrl}
                                                                                alt={ticker || row.symbol}
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                                onError={(e) => {
                                                                                    e.currentTarget.style.display = 'none';
                                                                                    e.currentTarget.parentElement!.textContent = (ticker || row.symbol).substring(0, 2).toUpperCase();
                                                                                }}
                                                                            />
                                                                        ) : tickerMap.size === 0 ? (
                                                                            <Loader2 size={12} className="animate-spin" style={{ opacity: 0.4 }} />
                                                                        ) : (
                                                                            (ticker || row.symbol).substring(0, 2).toUpperCase()
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {/* Name + Ticker | ISIN */}
                                                            <div>
                                                                {/* Row 1: Asset Name */}
                                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px' }}>
                                                                    {row.name || row.symbol}
                                                                </div>
                                                                {/* Row 2: Ticker | ISIN */}
                                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {/* Ticker from Yahoo */}
                                                                    {(() => {
                                                                        const resolved = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);
                                                                        if (resolved && resolved.ticker && resolved.ticker !== row.isin && resolved.ticker !== row.symbol) {
                                                                            return (
                                                                                <>
                                                                                    <span>{resolved.ticker}</span>
                                                                                    <span style={{ opacity: 0.4 }}>|</span>
                                                                                </>
                                                                            );
                                                                        }
                                                                        // Show loading indicator if not resolved yet
                                                                        if (tickerMap.size === 0) {
                                                                            return (
                                                                                <>
                                                                                    <Loader2 size={10} className="animate-spin" style={{ opacity: 0.5 }} />
                                                                                    <span style={{ opacity: 0.4 }}>|</span>
                                                                                </>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                    {/* ISIN */}
                                                                    <span>{row.isin || row.symbol}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{
                                                        padding: '12px',
                                                        textAlign: 'right',
                                                        fontFamily: 'monospace',
                                                        color: 'var(--accent)',
                                                        fontSize: '13px'
                                                    }}>
                                                        {category === 'closed' ? '-' : formatNumber(row.quantity, -1)}
                                                    </td>
                                                    <td style={{
                                                        padding: '12px',
                                                        textAlign: 'right',
                                                        fontFamily: 'monospace',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '13px'
                                                    }}>
                                                        {formatNumber(row.buyPrice, 2)}
                                                    </td>
                                                    <td style={{
                                                        padding: '12px',
                                                        textAlign: 'right',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '12px'
                                                    }}>
                                                        {row.currency}
                                                    </td>
                                                    <td style={{
                                                        padding: '12px',
                                                        textAlign: 'right',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '12px'
                                                    }}>
                                                        {row.type || '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <span style={{
                                                            color: row.confidence >= 80 ? 'var(--success)' : 'var(--warning)',
                                                            fontWeight: 700,
                                                            fontSize: '12px'
                                                        }}>
                                                            {row.confidence}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        <div style={{
                            marginTop: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Open Positions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Open Positions
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({parseResult.rows.filter(r => categorizeRow(r) === 'open').length})
                                    </span>
                                </div>
                                <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />

                                {/* Closed Positions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Closed Positions
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({parseResult.rows.filter(r => categorizeRow(r) === 'closed').length})
                                    </span>
                                </div>
                                <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />

                                {/* Account Statement */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Account Statement
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({parseResult.rows.filter(r => categorizeRow(r) === 'statement').length})
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setStep('upload')}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        borderRadius: '10px',
                                        color: 'var(--text-muted)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={(e) => {
                                        console.log('[DEBUG-INLINE] Button Clicked');
                                        handleProceedToResolve();
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        background: 'var(--accent)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: 'var(--shadow-md)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Run Import (Debug) <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>

                        {step === 'resolving' && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                backdropFilter: 'blur(5px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '16px',
                                zIndex: 10
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Loader2 size={48} className="animate-spin" color="var(--accent)" style={{ marginBottom: '16px' }} />
                                    <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700 }}>
                                        Matching Assets...
                                    </h3>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Review Step */}
                {step === 'review' && (
                    <div>


                        <div style={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            marginBottom: '20px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)'
                        }}>
                            {resolvedAssets.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 20px',
                                    borderBottom: i < resolvedAssets.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: a.action === 'skip' ? 'var(--bg-secondary)' : 'transparent'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: 'var(--bg-secondary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: 'var(--text-primary)',
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
                                        <div>
                                            {/* Row 1: Name + Ticker Badge */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginBottom: '2px'
                                            }}>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)',
                                                    fontSize: '14px'
                                                }}>
                                                    {a.resolvedName || a.name}
                                                </span>
                                                {/* Ticker Badge - always show resolvedSymbol */}
                                                {a.resolvedSymbol && (
                                                    <span style={{
                                                        background: a.resolvedSymbol !== a.isin ? 'var(--accent)' : 'var(--bg-secondary)',
                                                        color: a.resolvedSymbol !== a.isin ? 'white' : 'var(--text-muted)',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px',
                                                        border: a.resolvedSymbol === a.isin ? '1px solid var(--border)' : 'none'
                                                    }}>
                                                        {a.resolvedSymbol}
                                                    </span>
                                                )}
                                                {/* Verification Status */}
                                                {a.matchSource === 'MEMORY' && (
                                                    <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>✓</span>
                                                )}
                                                {a.matchSource === 'SEARCH' && (
                                                    <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600 }}>?</span>
                                                )}
                                            </div>
                                            {/* Row 2: ISIN (only if different from resolvedSymbol) */}
                                            <div style={{
                                                fontSize: '11px',
                                                color: 'var(--text-muted)',
                                                fontFamily: 'monospace',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                {a.isin && a.isin !== a.resolvedSymbol && (
                                                    <span style={{ opacity: 0.7 }}>{a.isin}</span>
                                                )}
                                            </div>
                                            {a.warnings && a.warnings.length > 0 && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginTop: '4px',
                                                    color: 'var(--warning)',
                                                    fontSize: '10px',
                                                    fontWeight: 600
                                                }}>
                                                    <AlertCircle size={10} />
                                                    {a.warnings[0]}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                color: 'var(--text-primary)',
                                                fontFamily: 'monospace',
                                                fontWeight: 600,
                                                fontSize: '13px'
                                            }}>
                                                {formatNumber(a.quantity, 5)}
                                            </div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: 'var(--text-muted)'
                                            }}>
                                                @ {formatNumber(a.buyPrice, 2)}
                                            </div>
                                        </div>
                                        <select
                                            value={a.action}
                                            onChange={(e) => handleActionChange(i, e.target.value as any)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                minWidth: '180px'
                                            }}
                                        >
                                            {a.quantity > 0 ? (
                                                <>
                                                    <option value="add">Add to Open Positions</option>
                                                    {a.existingAsset && <option value="update">Update Position</option>}
                                                    <option value="close">Add to Closed Positions</option>
                                                    <option value="skip">Skip</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="close">Add to Closed Positions</option>
                                                    <option value="skip">Skip</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '20px',
                            marginBottom: '10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Open Positions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Open Positions
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({resolvedAssets.filter(a => a.quantity > 0).length})
                                    </span>
                                </div>
                                <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />

                                {/* Closed Positions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Closed Positions
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({resolvedAssets.filter(a => a.quantity <= 0).length})
                                    </span>
                                </div>
                                <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />

                                {/* Account Statement */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Account Statement
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ({resolvedAssets.length})
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setStep('preview')}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        borderRadius: '10px',
                                        color: 'var(--text-muted)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!selectedPortfolioId}
                                    style={{
                                        padding: '12px 32px',
                                        background: selectedPortfolioId ? 'var(--accent)' : 'var(--bg-secondary)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: selectedPortfolioId ? '#fff' : 'var(--text-muted)',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: selectedPortfolioId ? 'pointer' : 'not-allowed',
                                        boxShadow: selectedPortfolioId ? 'var(--shadow-md)' : 'none',
                                        opacity: selectedPortfolioId ? 1 : 0.5,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Complete Import
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Importing Step */}
                {step === 'importing' && (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 40px'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            border: '4px solid var(--border)',
                            borderTopColor: 'var(--accent)',
                            margin: '0 auto 32px',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '12px'
                        }}>
                            Importing your wealth...
                        </h3>
                        <p style={{
                            color: 'var(--text-muted)',
                            fontSize: '14px'
                        }}>
                            Processing transactions for trades, dividends, and cash flow...
                        </p>
                    </div>
                )}

                {/* Done Step */}
                {step === 'done' && importResult && (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 40px'
                    }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'var(--success)',
                            margin: '0 auto 32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 50px rgba(16, 185, 129, 0.4)'
                        }}>
                            <Check size={50} color="white" strokeWidth={3} />
                        </div>
                        <h2 style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            marginBottom: '16px'
                        }}>
                            Import Complete
                        </h2>
                        <p style={{
                            fontSize: '16px',
                            color: 'var(--text-muted)',
                            marginBottom: '32px'
                        }}>
                            {importResult.added} assets added, {importResult.updated} updated.
                            {(importResult as any).txAdded !== undefined && (importResult as any).txAdded > 0 && (
                                <span style={{
                                    display: 'block',
                                    marginTop: '8px',
                                    color: 'var(--accent)',
                                    fontWeight: 600
                                }}>
                                    ✓ {(importResult as any).txAdded} transactions saved to history.
                                </span>
                            )}
                        </p>
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '12px 48px',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontWeight: 700,
                                borderRadius: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                boxShadow: 'var(--shadow-md)',
                                transition: 'transform 0.2s'
                            }}
                        >
                            Back to Positions
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
}
