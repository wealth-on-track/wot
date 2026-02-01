"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Check, Loader2, ArrowRight, Lock, Cloud, Database, AlertCircle, Pencil } from "lucide-react";
import { parseFile, ParseResult, ParsedTransaction } from "@/lib/importParser";
import { resolveImportSymbols, executeImport, ResolvedAsset, ImportAsset } from "@/app/actions/import";
import { getUserPortfolios } from "@/app/actions/portfolio";
import { useRouter } from "next/navigation";

// Unified threshold for quantity comparisons (positions with qty <= this are considered closed)
const QUANTITY_THRESHOLD = 0.000001;

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
    // Map to store resolved tickers for preview display (symbol/isin -> ticker, name, logoUrl, exchange, country, sector)
    const [tickerMap, setTickerMap] = useState<Map<string, { ticker: string; name: string; logoUrl?: string; exchange?: string; country?: string; sector?: string; category?: string }>>(new Map());
    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedRows, setEditedRows] = useState<Map<number, { name?: string; quantity?: number; exchange?: string; country?: string; sector?: string }>>(new Map());
    const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [analyzeProgress, setAnalyzeProgress] = useState(0);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
    const [targetPortfolioName, setTargetPortfolioName] = useState<string>('');
    const [availablePortfolios, setAvailablePortfolios] = useState<{ id: string; name: string; isDefault?: boolean }[]>([]);
    const [platformOverride, setPlatformOverride] = useState<string | null>(null);
    const [customPlatformName, setCustomPlatformName] = useState<string>('');
    const [importProgress, setImportProgress] = useState(0);
    const [importPhase, setImportPhase] = useState(0);
    const [resolveProgress, setResolveProgress] = useState(0);
    const [resolvePhase, setResolvePhase] = useState(0);
    const [hideResolveBar, setHideResolveBar] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ portfolio: boolean; platform: boolean }>({ portfolio: false, platform: false });
    const [showPlatformSuggestions, setShowPlatformSuggestions] = useState(false);
    const [showPortfolioSuggestions, setShowPortfolioSuggestions] = useState(false);
    const platformSuggestions = ['Interactive Brokers', 'DeGiro', 'Kraken', 'Binance', 'Coinbase', 'eToro', 'Trading212', 'Fidelity', 'Schwab'];
    const portfolioSuggestions = ['Main', 'Financial Independence', 'Alternative', 'Retirement', 'Kids', 'Speculative', 'Crypto', 'Stocks'];

    const RESOLVE_PHASES = [
        { progress: 15, message: "Searching Yahoo Finance...", icon: "🔍" },
        { progress: 35, message: "Matching tickers...", icon: "🎯" },
        { progress: 55, message: "Fetching logos...", icon: "🖼️" },
        { progress: 75, message: "Resolving symbols...", icon: "🔗" },
        { progress: 90, message: "Finalizing...", icon: "✨" },
    ];

    const IMPORT_PHASES = [
        { progress: 15, message: "Validating assets...", icon: "🔍" },
        { progress: 35, message: "Resolving symbols...", icon: "🔗" },
        { progress: 55, message: "Creating positions...", icon: "📊" },
        { progress: 75, message: "Processing transactions...", icon: "💰" },
        { progress: 100, message: "Installing...", icon: "✨" }, // Use "Installing" as final phase
    ];

    // ... (rest of component) ...



    useEffect(() => {
        const loadPortfolios = async () => {
            const result = await getUserPortfolios();
            if (result.success && result.portfolios) {
                setAvailablePortfolios(result.portfolios);
                if (result.portfolios.length > 0) {
                    const defaultP = result.portfolios.find(p => p.isDefault) || result.portfolios[0];
                    setSelectedPortfolioId(defaultP.id);
                    setTargetPortfolioName(defaultP.name);
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
            const result = await parseFile(file, customPlatformName);
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
                    platform: row.platform,
                    exchange: row.exchange // CSV exchange (e.g., Reference Exchange from Degiro)
                }));

                // Fire and forget - resolve in background
                resolveImportSymbols(importAssets).then(resolveResult => {
                    if (resolveResult.success) {
                        const newTickerMap = new Map<string, { ticker: string; name: string; logoUrl?: string; exchange?: string; country?: string; sector?: string; category?: string }>();
                        resolveResult.resolved.forEach(asset => {
                            const data = {
                                ticker: asset.resolvedSymbol,
                                name: asset.resolvedName,
                                logoUrl: asset.logoUrl,
                                exchange: asset.exchange,
                                country: asset.country,
                                sector: asset.sector,
                                category: asset.category
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

    // Resolve progress animation using ref to avoid re-render loops
    const resolveAnimationRef = useRef<NodeJS.Timeout | null>(null);
    const isResolvingRef = useRef(false);

    useEffect(() => {
        const shouldAnimate = step === 'preview' && tickerMap.size === 0;
        const isComplete = step === 'preview' && tickerMap.size > 0;

        // Completed - show 100%
        if (isComplete) {
            if (resolveAnimationRef.current) {
                clearInterval(resolveAnimationRef.current);
                resolveAnimationRef.current = null;
            }
            isResolvingRef.current = false;
            setResolveProgress(100);
            setResolvePhase(4);
            return;
        }

        // Should animate but already animating - skip
        if (shouldAnimate && isResolvingRef.current) {
            return;
        }

        // Should animate and not yet started
        if (shouldAnimate && !isResolvingRef.current) {
            isResolvingRef.current = true;
            setResolveProgress(0);
            setResolvePhase(0);

            let phase = 0;
            let progress = 0;
            const phaseTargets = [15, 35, 55, 75, 90, 95];

            resolveAnimationRef.current = setInterval(() => {
                const target = phaseTargets[phase] || 95;

                if (progress < target) {
                    progress += 0.6;
                    setResolveProgress(Math.min(progress, target));
                } else if (phase < 4) {
                    phase++;
                    setResolvePhase(phase);
                }
            }, 50);

            return;
        }

        // Not in preview or already has data - cleanup
        if (!shouldAnimate && resolveAnimationRef.current) {
            clearInterval(resolveAnimationRef.current);
            resolveAnimationRef.current = null;
            isResolvingRef.current = false;
        }
    }, [step, tickerMap.size]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resolveAnimationRef.current) {
                clearInterval(resolveAnimationRef.current);
            }
        };
    }, []);

    // Hide resolve bar after 3 seconds once resolved
    // Hide resolve bar logic removed to keep it persistent
    useEffect(() => {
        // Reset when going back to upload
        if (step === 'upload') {
            setHideResolveBar(false);
            setIsEditMode(false);
            setEditedRows(new Map());
        }
    }, [step]);

    // Import progress animation
    useEffect(() => {
        if (step !== 'importing') {
            setImportProgress(0);
            setImportPhase(0);
            return;
        }

        // Smooth progress animation
        const progressInterval = setInterval(() => {
            setImportProgress(prev => {
                const targetProgress = IMPORT_PHASES[importPhase]?.progress || 95;
                if (prev < targetProgress) {
                    const newProgress = Math.min(prev + 1, targetProgress);
                    return newProgress;
                }
                return prev;
            });
        }, 50);

        // Phase progression
        const phaseInterval = setInterval(() => {
            setImportPhase(prev => {
                if (prev < IMPORT_PHASES.length - 1) {
                    return prev + 1;
                }
                return prev;
            });
        }, 600);

        return () => {
            clearInterval(progressInterval);
            clearInterval(phaseInterval);
        };
    }, [step, importPhase]);

    const handleProceedToResolve = async () => {
        setStep('resolving');
        setError(null);

        try {
            const importAssets: ImportAsset[] = (parseResult?.rows || []).map((row, idx) => {
                const edited = editedRows.get(idx);
                return {
                    symbol: row.symbol,
                    isin: row.isin,
                    name: edited?.name ?? row.name,
                    quantity: edited?.quantity ?? row.quantity,
                    buyPrice: row.buyPrice,
                    currency: row.currency as 'USD' | 'EUR' | 'TRY',
                    type: row.type,
                    platform: platformOverride === 'Custom' ? customPlatformName : (platformOverride || row.platform),
                    exchange: edited?.exchange ?? row.exchange // CSV exchange, can be edited
                };
            });

            const existingSymbols = new Set(importAssets.map(a => a.symbol));

            // Transactions loop removed - parser now handles all asset types (including CASH) via balance column
            // This prevents duplication of assets and ensures consistency with parser's balance logic

            const result = await resolveImportSymbols(importAssets);

            if (result.success) {
                const processed = result.resolved.map((a, idx) => {
                    // Apply edited metadata (exchange, country, sector)
                    const edited = editedRows.get(idx);
                    const updatedAsset = {
                        ...a,
                        exchange: edited?.exchange ?? a.exchange,
                        country: edited?.country ?? a.country,
                        sector: edited?.sector ?? a.sector
                    };

                    // For closed positions (quantity === 0), use 'close' action
                    // This applies whether the asset exists or not:
                    // - If exists: Update to 0 quantity (mark as closed)
                    // - If new: Create with 0 quantity (historical closed position)
                    if (updatedAsset.quantity === 0 || updatedAsset.quantity <= QUANTITY_THRESHOLD) {
                        return { ...updatedAsset, action: 'close' as const };
                    }
                    return updatedAsset;
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
        console.log('[ImportCSVInline] handleImport called');
        console.log('[ImportCSVInline] parseResult:', parseResult);
        console.log('[ImportCSVInline] resolvedAssets.length:', resolvedAssets.length);
        console.log('[ImportCSVInline] targetPortfolioName:', targetPortfolioName);
        console.log('[ImportCSVInline] customPlatformName:', customPlatformName);
        console.log('[ImportCSVInline] selectedPortfolioId:', selectedPortfolioId);


        if (!parseResult) {
            console.log('[ImportCSVInline] No parseResult, returning early');
            return;
        }

        // Validation
        const isPortfolioEmpty = !targetPortfolioName || targetPortfolioName.trim() === '';
        const isPlatformEmpty = !customPlatformName || customPlatformName.trim() === '';

        console.log('[ImportCSVInline] isPortfolioEmpty:', isPortfolioEmpty);
        console.log('[ImportCSVInline] isPlatformEmpty:', isPlatformEmpty);

        if (isPortfolioEmpty || isPlatformEmpty) {
            console.log('[ImportCSVInline] Validation failed, setting errors');
            setValidationErrors({
                portfolio: isPortfolioEmpty,
                platform: isPlatformEmpty
            });

            // Auto-clear errors after 3 seconds
            setTimeout(() => {
                setValidationErrors({ portfolio: false, platform: false });
            }, 3000);

            return;
        }

        // Clear errors
        setValidationErrors({ portfolio: false, platform: false });

        setStep('importing');
        setError(null);

        try {
            // Fallback: If resolvedAssets is empty (e.g. running from Preview/Map step), construct it from tickerMap
            let assetsToImport = resolvedAssets;

            if (assetsToImport.length === 0 && tickerMap.size > 0 && parseResult?.rows) {
                console.log('[ImportCSVInline] resolvedAssets empty, constructing from tickerMap...');
                assetsToImport = parseResult.rows.map((row, idx) => {
                    const edited = editedRows.get(idx);
                    // Try resolving by ISIN first, then Symbol
                    const resolvedData = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);

                    // Determining resolved symbol/name
                    const resolvedSymbol = resolvedData?.ticker || row.symbol;
                    const resolvedName = resolvedData?.name || edited?.name || row.name || row.symbol;

                    // Determine effective quantity
                    const quantity = edited?.quantity ?? row.quantity;

                    // Determine action based on quantity
                    // Note: 'add' will be converted to 'update' in executeImport if asset exists
                    // Using 0.000001 threshold to match parser
                    const action = (quantity > 0.000001) ? 'add' : 'close';

                    return {
                        symbol: row.symbol,
                        resolvedSymbol: resolvedSymbol,
                        name: row.name || row.symbol,
                        resolvedName: resolvedName,
                        resolvedType: row.type || 'STOCK',
                        quantity: quantity,
                        buyPrice: row.buyPrice,
                        resolvedCurrency: (row.currency as any) || 'EUR',
                        exchange: edited?.exchange || resolvedData?.exchange || row.exchange,
                        country: edited?.country || resolvedData?.country,
                        sector: edited?.sector || resolvedData?.sector,
                        category: resolvedData?.category || 'UNKNOWN',
                        confidence: row.confidence || 80,
                        warnings: row.warnings || [],
                        action: action,
                        matchSource: 'SEARCH',
                        isin: row.isin,
                        logoUrl: resolvedData?.logoUrl,
                        platform: platformOverride === 'Custom' ? customPlatformName : (platformOverride || row.platform)
                    } as ResolvedAsset;
                });
                console.log('[ImportCSVInline] Constructed', assetsToImport.length, 'assets from tickerMap');
            }

            console.log('[ImportCSVInline] Sending assets to import:', assetsToImport.map(a => ({ symbol: a.resolvedSymbol, quantity: a.quantity, action: a.action })));
            console.log('[ImportCSVInline] Calling executeImport...');
            const result = await executeImport(assetsToImport, transactions, selectedPortfolioId || undefined, targetPortfolioName);
            console.log('[ImportCSVInline] executeImport result:', result);
            setImportResult(result);

            // Force progress to 100% and wait for animation
            setImportPhase(IMPORT_PHASES.length - 1); // Set to final phase ("Installing...")
            setImportProgress(100);

            // Wait for 100% to be visible and animation to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            router.refresh();
            if (onSuccess) {
                const openCount = resolvedAssets.filter(r => categorizeRow(r) === 'open').length;
                const closedCount = resolvedAssets.filter(r => categorizeRow(r) === 'closed').length;
                const statementCount = resolvedAssets.filter(r => categorizeRow(r) === 'statement').length;

                onSuccess({ open: openCount, closed: closedCount, statement: statementCount });
            }
        } catch (e) {
            console.error('[ImportCSVInline] Import error:', e);
            setError(`Import failed: ${e}`);
            setStep('review');
        }
    };

    const categorizeRow = (row: any): 'open' | 'closed' | 'statement' | 'dividend' => {
        // CASH type always → Statement (EUR, USD, etc.)
        if (row.type && row.type.toUpperCase() === 'CASH') {
            return 'statement';
        }

        // DIVIDEND type - categorize separately to group with closed positions later
        if (row.type && row.type.toUpperCase() === 'DIVIDEND') {
            return 'dividend';
        }

        // Special transaction types → Statement (excluding DIVIDEND which is handled above)
        const statementTypes = ['DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'FEE', 'COUPON'];
        if (row.type && statementTypes.includes(row.type.toUpperCase())) {
            return 'statement';
        }

        // Positions with quantity > 0 → Open
        if (row.quantity > QUANTITY_THRESHOLD) {
            return 'open';
        }

        // Zero quantity positions → Closed
        return 'closed';
    };

    // Helper to group rows: positions followed by their related dividends
    const groupRowsWithDividends = (rows: any[]) => {
        const categorizedRows = rows.map((row, idx) => ({
            ...row,
            category: categorizeRow(row),
            originalIndex: idx
        }));

        // Get positions and dividends
        const openPositions = categorizedRows.filter(r => r.category === 'open');
        const closedPositions = categorizedRows.filter(r => r.category === 'closed');
        const dividends = categorizedRows.filter(r => r.category === 'dividend');
        const statementRows = categorizedRows.filter(r => r.category === 'statement');

        // Build map of symbol -> dividends for both open and closed positions
        const dividendsBySymbolOpen = new Map<string, any[]>();
        const dividendsBySymbolClosed = new Map<string, any[]>();
        const unmatchedDividends: any[] = [];

        dividends.forEach(div => {
            const divSymbol = (div.symbol || div.isin || '').toUpperCase();

            // First check for matching open position
            const hasMatchingOpen = openPositions.some(open => {
                const openSymbol = (open.symbol || '').toUpperCase();
                const openIsin = (open.isin || '').toUpperCase();
                return divSymbol && (openSymbol === divSymbol || openIsin === divSymbol);
            });

            if (hasMatchingOpen) {
                const existing = dividendsBySymbolOpen.get(divSymbol) || [];
                existing.push({ ...div, isDividendSubrow: true });
                dividendsBySymbolOpen.set(divSymbol, existing);
                return;
            }

            // Then check for matching closed position
            const hasMatchingClosed = closedPositions.some(closed => {
                const closedSymbol = (closed.symbol || '').toUpperCase();
                const closedIsin = (closed.isin || '').toUpperCase();
                return divSymbol && (closedSymbol === divSymbol || closedIsin === divSymbol);
            });

            if (hasMatchingClosed) {
                const existing = dividendsBySymbolClosed.get(divSymbol) || [];
                existing.push({ ...div, isDividendSubrow: true });
                dividendsBySymbolClosed.set(divSymbol, existing);
            } else {
                // No matching position - show in statement
                unmatchedDividends.push({ ...div, category: 'statement' });
            }
        });

        // Build final sorted list: Open (with dividends), then Closed (with dividends), then Statement
        const result: any[] = [];

        // 1. Open positions with their dividends
        openPositions.forEach(open => {
            result.push(open);
            const openSymbol = (open.symbol || '').toUpperCase();
            const openIsin = (open.isin || '').toUpperCase();

            // Add matching dividends right after the open position
            const relatedDividends = dividendsBySymbolOpen.get(openSymbol) || dividendsBySymbolOpen.get(openIsin) || [];
            relatedDividends.forEach(div => result.push(div));
        });

        // 2. Closed positions with their dividends
        closedPositions.forEach(closed => {
            result.push(closed);
            const closedSymbol = (closed.symbol || '').toUpperCase();
            const closedIsin = (closed.isin || '').toUpperCase();

            // Add matching dividends right after the closed position
            const relatedDividends = dividendsBySymbolClosed.get(closedSymbol) || dividendsBySymbolClosed.get(closedIsin) || [];
            relatedDividends.forEach(div => result.push(div));
        });

        // 3. Statement rows (including unmatched dividends)
        statementRows.forEach(row => result.push(row));
        unmatchedDividends.forEach(row => result.push(row));

        return result;
    };

    // Helper to count rows for display (dividends with matching positions go to that position's count)
    const getRowCounts = (rows: any[]) => {
        const categorizedRows = rows.map(row => ({
            ...row,
            category: categorizeRow(row)
        }));

        const openPositions = categorizedRows.filter(r => r.category === 'open');
        const closedPositions = categorizedRows.filter(r => r.category === 'closed');
        const dividends = categorizedRows.filter(r => r.category === 'dividend');

        // Count dividends that have matching open or closed positions
        let openDividendCount = 0;
        let closedDividendCount = 0;

        dividends.forEach(div => {
            const divSymbol = (div.symbol || div.isin || '').toUpperCase();

            // Check open positions first
            const hasMatchingOpen = openPositions.some(open => {
                const openSymbol = (open.symbol || '').toUpperCase();
                const openIsin = (open.isin || '').toUpperCase();
                return divSymbol && (openSymbol === divSymbol || openIsin === divSymbol);
            });

            if (hasMatchingOpen) {
                openDividendCount++;
                return;
            }

            // Then check closed positions
            const hasMatchingClosed = closedPositions.some(closed => {
                const closedSymbol = (closed.symbol || '').toUpperCase();
                const closedIsin = (closed.isin || '').toUpperCase();
                return divSymbol && (closedSymbol === divSymbol || closedIsin === divSymbol);
            });

            if (hasMatchingClosed) {
                closedDividendCount++;
            }
        });

        const unmatchedDividendCount = dividends.length - openDividendCount - closedDividendCount;

        return {
            open: openPositions.length + openDividendCount,
            closed: closedPositions.length + closedDividendCount,
            statement: categorizedRows.filter(r => r.category === 'statement').length + unmatchedDividendCount
        };
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
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <Database size={14} color="white" />
                    </div>
                    <h2 style={{
                        fontSize: '14px',
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
            <div style={{ padding: '16px' }}>
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
                {(step === 'preview' || step === 'resolving' || step === 'importing') && parseResult && (
                    <div>
                        <div style={{
                            background: 'var(--bg-primary)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 16px',
                            borderRadius: '12px 12px 0 0',
                            marginBottom: '8px'
                        }}>
                            {/* Left side: Portfolio and Platform */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Portfolio Input */}
                                {/* Portfolio Input */}
                                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: '8px',
                                        border: `2px solid ${validationErrors.portfolio ? '#ef4444' : 'var(--border)'}`,
                                        background: 'var(--bg-primary)',
                                        animation: validationErrors.portfolio ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
                                        transition: 'all 0.2s',
                                        height: '32px',
                                        boxShadow: validationErrors.portfolio ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none'
                                    }}>
                                        <div style={{
                                            background: 'rgba(120, 120, 120, 0.08)',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0 10px',
                                            borderRight: '1px solid var(--border)',
                                            borderRadius: '7px 0 0 7px'
                                        }}>
                                            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                                                PORTFOLIO
                                            </label>
                                        </div>
                                        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                                            <input
                                                type="text"
                                                placeholder="Select..."
                                                value={targetPortfolioName}
                                                onFocus={() => setShowPortfolioSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowPortfolioSuggestions(false), 200)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const formatted = val.replace(/\b\w/g, c => c.toUpperCase());
                                                    setTargetPortfolioName(formatted);

                                                    // Find matching portfolio and set its ID
                                                    const matchingPortfolio = availablePortfolios.find(
                                                        p => p.name.toLowerCase() === formatted.toLowerCase()
                                                    );
                                                    if (matchingPortfolio) {
                                                        setSelectedPortfolioId(matchingPortfolio.id);
                                                    }

                                                    if (formatted.trim() !== '') {
                                                        setValidationErrors(prev => ({ ...prev, portfolio: false }));
                                                    }
                                                }}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    outline: 'none',
                                                    width: '120px'
                                                }}
                                            />
                                            {/* Portfolio Suggestions Dropdown */}
                                            {showPortfolioSuggestions && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    width: '180px',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    boxShadow: 'var(--shadow-md)',
                                                    zIndex: 50,
                                                    maxHeight: '200px',
                                                    overflowY: 'auto',
                                                    marginTop: '8px',
                                                    padding: '4px'
                                                }}>
                                                    {(() => {
                                                        const filteredUsed = availablePortfolios.filter(p => p.name.toLowerCase().includes(targetPortfolioName.toLowerCase()));
                                                        const filteredSugg = portfolioSuggestions.filter(p =>
                                                            p.toLowerCase().includes(targetPortfolioName.toLowerCase()) &&
                                                            !availablePortfolios.some(existing => existing.name.toLowerCase() === p.toLowerCase())
                                                        );

                                                        if (filteredUsed.length === 0 && filteredSugg.length === 0) return null;

                                                        return (
                                                            <>
                                                                {/* Previously Used (Existing Portfolios) */}
                                                                {filteredUsed.length > 0 && (
                                                                    <>
                                                                        <div style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Previously Used</div>
                                                                        {filteredUsed.map(p => (
                                                                            <div
                                                                                key={p.id}
                                                                                onClick={() => {
                                                                                    setTargetPortfolioName(p.name);
                                                                                    setSelectedPortfolioId(p.id);
                                                                                    setValidationErrors(prev => ({ ...prev, portfolio: false }));
                                                                                    setShowPortfolioSuggestions(false);
                                                                                }}
                                                                                style={{
                                                                                    padding: '6px 8px',
                                                                                    fontSize: '12px',
                                                                                    color: 'var(--text-primary)',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'background 0.2s',
                                                                                    marginBottom: '2px'
                                                                                }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                {p.name}
                                                                            </div>
                                                                        ))}
                                                                        {filteredSugg.length > 0 && <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0', opacity: 0.5 }}></div>}
                                                                    </>
                                                                )}

                                                                {/* Suggestions */}
                                                                {filteredSugg.length > 0 && (
                                                                    <>
                                                                        <div style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Suggestions</div>
                                                                        {filteredSugg.map(p => (
                                                                            <div
                                                                                key={p}
                                                                                onClick={() => {
                                                                                    setTargetPortfolioName(p);
                                                                                    setValidationErrors(prev => ({ ...prev, portfolio: false }));
                                                                                    setShowPortfolioSuggestions(false);
                                                                                }}
                                                                                style={{
                                                                                    padding: '6px 8px',
                                                                                    fontSize: '12px',
                                                                                    color: 'var(--text-primary)',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'background 0.2s'
                                                                                }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                {p}
                                                                            </div>
                                                                        ))}
                                                                    </>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                            {validationErrors.portfolio && <AlertCircle size={14} color="#ef4444" style={{ marginRight: '8px' }} />}
                                        </div>
                                        {/* Validation Error Message */}
                                        {validationErrors.portfolio && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-20px',
                                                left: 0,
                                                fontSize: '11px',
                                                color: '#ef4444',
                                                paddingLeft: '4px',
                                                animation: 'fadeIn 0.3s ease-in',
                                                fontWeight: 600,
                                                transition: 'opacity 0.3s ease-out',
                                                whiteSpace: 'nowrap',
                                                zIndex: 10
                                            }}>
                                                Please fill in Portfolio
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <span style={{ color: 'var(--border)', fontWeight: 300, opacity: 0.5 }}>|</span>

                                {/* Platform Input */}
                                {/* Platform Input */}
                                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: '8px',
                                        border: `2px solid ${validationErrors.platform ? '#ef4444' : 'var(--border)'}`,
                                        background: 'var(--bg-primary)',
                                        animation: validationErrors.platform ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
                                        transition: 'all 0.2s',
                                        height: '32px',
                                        boxShadow: validationErrors.platform ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none'
                                    }}>
                                        <div style={{
                                            background: 'rgba(120, 120, 120, 0.08)',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0 10px',
                                            borderRight: '1px solid var(--border)',
                                            borderRadius: '7px 0 0 7px'
                                        }}>
                                            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                                                PLATFORM
                                            </label>
                                        </div>
                                        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                                            <input
                                                type="text"
                                                placeholder="e.g. IBKR..."
                                                value={customPlatformName}
                                                onFocus={() => setShowPlatformSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowPlatformSuggestions(false), 200)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    // Auto-capitalize first letter of each word
                                                    const formatted = val.replace(/\b\w/g, c => c.toUpperCase());
                                                    setCustomPlatformName(formatted);
                                                    if (formatted.trim() !== '') {
                                                        setValidationErrors(prev => ({ ...prev, platform: false }));
                                                    }
                                                }}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    outline: 'none',
                                                    width: '120px'
                                                }}
                                            />
                                            {/* Custom Suggestions Dropdown */}
                                            {showPlatformSuggestions && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    width: '200px',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    boxShadow: 'var(--shadow-md)',
                                                    zIndex: 50,
                                                    maxHeight: '200px',
                                                    overflowY: 'auto',
                                                    marginTop: '8px',
                                                    padding: '4px'
                                                }}>
                                                    {(() => {
                                                        const filtered = platformSuggestions.filter(p => p.toLowerCase().includes(customPlatformName.toLowerCase()));
                                                        if (filtered.length === 0) return null;
                                                        return (
                                                            <>
                                                                <div style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Suggested</div>
                                                                {filtered.map(p => (
                                                                    <div
                                                                        key={p}
                                                                        onClick={() => {
                                                                            setCustomPlatformName(p);
                                                                            setValidationErrors(prev => ({ ...prev, platform: false }));
                                                                            setShowPlatformSuggestions(false);
                                                                        }}
                                                                        style={{
                                                                            padding: '6px 8px',
                                                                            fontSize: '12px',
                                                                            color: 'var(--text-primary)',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer',
                                                                            transition: 'background 0.2s',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                    >
                                                                        {p}
                                                                    </div>
                                                                ))}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        {validationErrors.platform && <AlertCircle size={14} color="#ef4444" style={{ marginRight: '8px' }} />}
                                    </div>
                                    {/* Validation Error Message */}
                                    {validationErrors.platform && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-20px',
                                            left: 0,
                                            fontSize: '11px',
                                            color: '#ef4444',
                                            paddingLeft: '4px',
                                            animation: 'fadeIn 0.3s ease-in',
                                            fontWeight: 600,
                                            transition: 'opacity 0.3s ease-out',
                                            whiteSpace: 'nowrap',
                                            zIndex: 10
                                        }}>
                                            Please fill in Platform
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right side: Cancel, Edit, and Run Import buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setStep('upload')}
                                    style={{
                                        padding: '6px 14px',
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-muted)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    style={{
                                        padding: '6px 14px',
                                        background: isEditMode ? 'var(--accent)' : 'transparent',
                                        border: isEditMode ? 'none' : '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: isEditMode ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Pencil size={12} />
                                    {isEditMode ? 'Done' : 'Edit'}
                                </button>
                                <button
                                    onClick={() => handleImport()}
                                    style={{
                                        padding: '6px 16px',
                                        background: 'var(--accent)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: 'var(--shadow-sm)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Run Import <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Ticker Resolution Progress Bar OR Installing Bar */}
                        {(!hideResolveBar || step === 'importing') && (
                            <div style={{
                                padding: '8px 12px',
                                marginBottom: '8px',
                                borderRadius: '8px',
                                background: (tickerMap.size > 0 || step === 'importing') ? 'rgba(34, 197, 94, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                border: `1px solid ${(tickerMap.size > 0 || step === 'importing') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                                transition: 'all 0.3s ease'
                            }}>
                                {step === 'importing' ? (
                                    /* Installing Bar - Same style as Resolve Bar */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '14px', animation: 'spin 1.5s linear infinite' }}>
                                                    {IMPORT_PHASES[importPhase]?.icon || "⏳"}
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Installing...
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                                                {Math.round(importProgress)}%
                                            </span>
                                        </div>
                                        {/* Progress Line */}
                                        <div style={{
                                            height: '4px',
                                            borderRadius: '2px',
                                            background: 'rgba(0,0,0,0.05)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${importProgress}%`,
                                                background: 'var(--accent)',
                                                borderRadius: '2px',
                                                transition: 'width 0.3s ease-out'
                                            }} />
                                        </div>
                                    </div>
                                ) : tickerMap.size === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Header with icon, message, and percentage */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '14px' }}>
                                                    {RESOLVE_PHASES[resolvePhase]?.icon || "🔍"}
                                                </span>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    color: 'var(--accent)',
                                                    transition: 'all 0.3s ease'
                                                }}>
                                                    {RESOLVE_PHASES[resolvePhase]?.message || "Resolving..."}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: 'var(--accent)',
                                                fontFamily: 'monospace'
                                            }}>
                                                {Math.round(resolveProgress)}%
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{
                                            width: '100%',
                                            height: '4px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${resolveProgress}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, var(--accent), var(--accent-hover, var(--accent)))',
                                                borderRadius: '2px',
                                                transition: 'width 0.15s ease-out'
                                            }} />
                                        </div>
                                    </div>
                                ) : (
                                    /* Resolution Complete Bar - Same style as Resolve/Install Bar */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '14px' }}>
                                                    <Check size={14} style={{ color: 'var(--success)' }} strokeWidth={3} />
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Resolution Complete
                                                </span>
                                            </div>
                                            {(() => {
                                                const counts = getRowCounts(parseResult.rows);
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            <span style={{ fontWeight: 800 }}>({tickerMap.size})</span> Assets
                                                        </span>
                                                        <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', opacity: 0.8 }}>
                                                            <span style={{ fontWeight: 700 }}>({counts.open})</span> Open Positions
                                                            <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                                            <span style={{ fontWeight: 700 }}>({counts.closed})</span> Closed Positions
                                                            <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                                            <span style={{ fontWeight: 700 }}>({counts.statement})</span> Account Statement
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        {/* Full Green Bar */}
                                        <div style={{
                                            height: '4px',
                                            borderRadius: '2px',
                                            background: 'rgba(34, 197, 94, 0.2)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: '100%',
                                                background: 'var(--success)',
                                                borderRadius: '2px'
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{
                            maxHeight: '320px',
                            overflow: 'auto',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid var(--border)',
                                            width: '80px'
                                        }}>
                                            Status
                                        </th>
                                        <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid var(--border)',
                                            maxWidth: '300px',
                                            width: '300px'
                                        }}>
                                            Asset
                                        </th>
                                        {['Qty', 'Price', 'Currency', 'Type', 'Exchange', 'Country', 'Sector', 'Category', 'Conf.'].map(h => (
                                            <th key={h} style={{
                                                padding: '8px',
                                                textAlign: 'right',
                                                fontSize: '10px',
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
                                    {groupRowsWithDividends(parseResult.rows.slice(0, 50))
                                        .map((row, idx) => {
                                            const category = row.isDividendSubrow ? 'dividend' : row.category;
                                            const categoryColors = {
                                                open: { bg: 'rgba(34, 197, 94, 0.08)', badge: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Open' },
                                                closed: { bg: 'rgba(100, 116, 139, 0.05)', badge: 'rgba(100, 116, 139, 0.15)', text: '#64748b', label: 'Closed' },
                                                statement: { bg: 'rgba(59, 130, 246, 0.08)', badge: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Statement' },
                                                dividend: { bg: 'rgba(99, 102, 241, 0.08)', badge: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', label: '↳ Dividend' }
                                            };
                                            const colors = categoryColors[category as keyof typeof categoryColors] || categoryColors.statement;

                                            // User Request: "Just write whatever the ticker is"
                                            // Row 1: Asset Name
                                            // Row 2: Ticker

                                            return (
                                                <tr key={idx} style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    background: colors.bg,
                                                    transition: 'background 0.2s'
                                                }}>
                                                    <td style={{ padding: '6px 12px' }}>
                                                        <div style={{
                                                            display: 'inline-block',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            background: colors.badge,
                                                            color: colors.text,
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {colors.label}
                                                        </div>
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px',
                                                        maxWidth: '300px',
                                                        width: '300px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {/* Logo */}
                                                            {(() => {
                                                                const resolved = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);
                                                                const logoUrl = resolved?.logoUrl;
                                                                const ticker = resolved?.ticker;

                                                                return (
                                                                    <div style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        minWidth: '28px',
                                                                        minHeight: '28px',
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
                                                                        flexShrink: 0,
                                                                        position: 'relative'
                                                                    }}>
                                                                        {logoUrl ? (
                                                                            <img
                                                                                src={logoUrl}
                                                                                alt={ticker || row.symbol}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    top: 0,
                                                                                    left: 0,
                                                                                    width: '100%',
                                                                                    height: '100%',
                                                                                    objectFit: 'cover',
                                                                                    borderRadius: '50%'
                                                                                }}
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
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                {/* Row 1: Asset Name - Editable in edit mode */}
                                                                {isEditMode && (category === 'open' || category === 'closed') ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editedRows.get(row.originalIndex)?.name ?? row.name ?? row.symbol}
                                                                        onChange={(e) => {
                                                                            const newEdited = new Map(editedRows);
                                                                            const current = newEdited.get(row.originalIndex) || {};
                                                                            newEdited.set(row.originalIndex, { ...current, name: e.target.value });
                                                                            setEditedRows(newEdited);
                                                                        }}
                                                                        style={{
                                                                            width: '280px',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid var(--accent)',
                                                                            background: 'var(--bg-secondary)',
                                                                            color: 'var(--text-primary)',
                                                                            fontSize: '12px',
                                                                            fontWeight: 600
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        fontWeight: 600,
                                                                        color: 'var(--text-primary)',
                                                                        fontSize: '12px',
                                                                        lineHeight: '1.3',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        maxWidth: '300px'
                                                                    }}>
                                                                        {editedRows.get(row.originalIndex)?.name ?? row.name ?? row.symbol}
                                                                    </div>
                                                                )}
                                                                {/* Row 2: Ticker | ISIN (dynamic - hide ISIN if not present) */}
                                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                                                    {(() => {
                                                                        // Custom Display for Kraken Cash
                                                                        if (row.name === 'Deposit-Withdrawal' && row.platform === 'Kraken') {
                                                                            return <span>Cash | Kraken</span>;
                                                                        }

                                                                        const resolved = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);
                                                                        const hasIsin = row.isin && row.isin.length > 0;

                                                                        // Still loading
                                                                        if (tickerMap.size === 0) {
                                                                            if (hasIsin) {
                                                                                return (
                                                                                    <>
                                                                                        <Loader2 size={10} className="animate-spin" style={{ opacity: 0.5 }} />
                                                                                        <span style={{ opacity: 0.4 }}>|</span>
                                                                                        <span>{row.isin}</span>
                                                                                    </>
                                                                                );
                                                                            } else {
                                                                                // No ISIN: Show symbol-currency while loading
                                                                                const showPair = row.currency && row.currency !== row.symbol;
                                                                                return <span>{row.symbol}{showPair ? `-${row.currency}` : ''}</span>;
                                                                            }
                                                                        }

                                                                        // Resolved - show ticker
                                                                        const ticker = resolved?.ticker || row.symbol;

                                                                        if (hasIsin) {
                                                                            // Has ISIN: Show "Ticker | ISIN"
                                                                            return (
                                                                                <>
                                                                                    <span>{ticker}</span>
                                                                                    <span style={{ opacity: 0.4 }}>|</span>
                                                                                    <span>{row.isin}</span>
                                                                                </>
                                                                            );
                                                                        } else {
                                                                            // No ISIN (Kraken etc.): Show "Ticker-Currency" (e.g., BTC-EUR)
                                                                            // Skip if ticker already contains currency suffix (resolved crypto like BTC-EUR)
                                                                            const alreadyHasSuffix = ticker.includes('-');
                                                                            const showPair = !alreadyHasSuffix && row.currency && row.currency !== ticker;
                                                                            return <span>{ticker}{showPair ? `-${row.currency}` : ''}</span>;
                                                                        }
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{
                                                        padding: '6px 8px',
                                                        textAlign: 'right',
                                                        fontFamily: 'monospace',
                                                        color: 'var(--accent)',
                                                        fontSize: '11px'
                                                    }}>
                                                        {isEditMode && (category === 'open' || category === 'closed') ? (
                                                            <input
                                                                type="number"
                                                                value={editedRows.get(row.originalIndex)?.quantity ?? row.quantity}
                                                                onChange={(e) => {
                                                                    const newEdited = new Map(editedRows);
                                                                    const current = newEdited.get(row.originalIndex) || {};
                                                                    newEdited.set(row.originalIndex, { ...current, quantity: parseFloat(e.target.value) || 0 });
                                                                    setEditedRows(newEdited);
                                                                }}
                                                                step="any"
                                                                style={{
                                                                    width: '80px',
                                                                    padding: '4px 6px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--accent)',
                                                                    background: 'var(--bg-secondary)',
                                                                    color: 'var(--accent)',
                                                                    fontSize: '11px',
                                                                    fontFamily: 'monospace',
                                                                    textAlign: 'right'
                                                                }}
                                                            />
                                                        ) : (
                                                            category === 'closed' ? '-' : formatNumber(editedRows.get(row.originalIndex)?.quantity ?? row.quantity, -1)
                                                        )}
                                                    </td>
                                                    <td style={{
                                                        padding: '6px 8px',
                                                        textAlign: 'right',
                                                        fontFamily: 'monospace',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '11px'
                                                    }}>
                                                        {formatNumber(row.buyPrice, 2)}
                                                    </td>
                                                    <td style={{
                                                        padding: '6px 8px',
                                                        textAlign: 'right',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '10px'
                                                    }}>
                                                        {row.currency}
                                                    </td>
                                                    <td style={{
                                                        padding: '6px 8px',
                                                        textAlign: 'right',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '10px'
                                                    }}>
                                                        {row.type || '-'}
                                                    </td>
                                                    {/* Exchange, Country, Sector columns */}
                                                    {(() => {
                                                        const resolved = (row.isin && tickerMap.get(row.isin)) || tickerMap.get(row.symbol);
                                                        const edited = editedRows.get(row.originalIndex);
                                                        // Priority: edited > CSV (row.exchange) > API (resolved.exchange)
                                                        const exchange = edited?.exchange ?? (row as any).exchange ?? resolved?.exchange ?? '-';
                                                        const country = edited?.country ?? resolved?.country ?? '-';
                                                        const sector = edited?.sector ?? resolved?.sector ?? '-';

                                                        if (isEditMode && (category === 'open' || category === 'closed')) {
                                                            return (
                                                                <>
                                                                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={edited?.exchange ?? exchange}
                                                                            onChange={(e) => {
                                                                                const newEdited = new Map(editedRows);
                                                                                const current = newEdited.get(row.originalIndex) || {};
                                                                                newEdited.set(row.originalIndex, { ...current, exchange: e.target.value });
                                                                                setEditedRows(newEdited);
                                                                            }}
                                                                            style={{
                                                                                width: '60px',
                                                                                padding: '4px 6px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid var(--accent)',
                                                                                background: 'var(--bg-secondary)',
                                                                                color: 'var(--text-primary)',
                                                                                fontSize: '10px',
                                                                                textAlign: 'right'
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={edited?.country ?? country}
                                                                            onChange={(e) => {
                                                                                const newEdited = new Map(editedRows);
                                                                                const current = newEdited.get(row.originalIndex) || {};
                                                                                newEdited.set(row.originalIndex, { ...current, country: e.target.value });
                                                                                setEditedRows(newEdited);
                                                                            }}
                                                                            style={{
                                                                                width: '50px',
                                                                                padding: '4px 6px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid var(--accent)',
                                                                                background: 'var(--bg-secondary)',
                                                                                color: 'var(--text-primary)',
                                                                                fontSize: '10px',
                                                                                textAlign: 'right'
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={edited?.sector ?? sector}
                                                                            onChange={(e) => {
                                                                                const newEdited = new Map(editedRows);
                                                                                const current = newEdited.get(row.originalIndex) || {};
                                                                                newEdited.set(row.originalIndex, { ...current, sector: e.target.value });
                                                                                setEditedRows(newEdited);
                                                                            }}
                                                                            style={{
                                                                                width: '70px',
                                                                                padding: '4px 6px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid var(--accent)',
                                                                                background: 'var(--bg-secondary)',
                                                                                color: 'var(--text-primary)',
                                                                                fontSize: '10px',
                                                                                textAlign: 'right'
                                                                            }}
                                                                        />
                                                                    </td>
                                                                </>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                <td style={{
                                                                    padding: '6px 8px',
                                                                    textAlign: 'right',
                                                                    color: 'var(--text-secondary)',
                                                                    fontSize: '10px',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {tickerMap.size === 0 ? <Loader2 size={10} className="animate-spin" style={{ opacity: 0.4 }} /> : exchange}
                                                                </td>
                                                                <td style={{
                                                                    padding: '6px 8px',
                                                                    textAlign: 'right',
                                                                    color: 'var(--text-secondary)',
                                                                    fontSize: '10px'
                                                                }}>
                                                                    {tickerMap.size === 0 ? <Loader2 size={10} className="animate-spin" style={{ opacity: 0.4 }} /> : country}
                                                                </td>
                                                                <td style={{
                                                                    padding: '6px 8px',
                                                                    textAlign: 'right',
                                                                    color: 'var(--text-secondary)',
                                                                    fontSize: '10px',
                                                                    whiteSpace: 'nowrap',
                                                                    maxWidth: '80px',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}>
                                                                    {tickerMap.size === 0 ? <Loader2 size={10} className="animate-spin" style={{ opacity: 0.4 }} /> : sector}
                                                                </td>
                                                                <td style={{
                                                                    padding: '6px 8px',
                                                                    textAlign: 'right',
                                                                    fontSize: '10px'
                                                                }}>
                                                                    {(() => {
                                                                        const resolved = tickerMap.get(row.symbol) || (row.isin ? tickerMap.get(row.isin) : undefined);
                                                                        const category = resolved?.category;
                                                                        if (!category || tickerMap.size === 0) {
                                                                            return <Loader2 size={10} className="animate-spin" style={{ opacity: 0.4 }} />;
                                                                        }
                                                                        return (
                                                                            <span style={{
                                                                                padding: '3px 6px',
                                                                                borderRadius: '4px',
                                                                                background: 'var(--bg-secondary)',
                                                                                color: 'var(--text-secondary)',
                                                                                fontSize: '9px',
                                                                                fontWeight: 600,
                                                                                textTransform: 'uppercase'
                                                                            }}>
                                                                                {category}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </td>
                                                            </>
                                                        );
                                                    })()}
                                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                        <span style={{
                                                            color: row.confidence >= 80 ? 'var(--success)' : 'var(--warning)',
                                                            fontWeight: 700,
                                                            fontSize: '10px'
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
                    </div>

                )
                }





                {/* Review Step */}
                {
                    step === 'review' && (
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
                                                    {/* Ticker Badge - show resolvedSymbol (crypto already has -EUR suffix) */}
                                                    {a.resolvedSymbol && (() => {
                                                        // Crypto symbols already resolved with currency suffix (e.g., BTC-EUR)
                                                        // No need to append currency again
                                                        const displaySymbol = a.resolvedSymbol;

                                                        return (
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
                                                                {displaySymbol}
                                                            </span>
                                                        );
                                                    })()}
                                                    {/* Verification Status */}
                                                    {a.matchSource === 'MEMORY' && (
                                                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>✓</span>
                                                    )}
                                                    {a.matchSource === 'SEARCH' && (
                                                        <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600 }}>?</span>
                                                    )}
                                                </div>
                                                {/* Row 2: ISIN (only show if present and different from resolvedSymbol) */}
                                                {a.isin && a.isin.length > 0 && a.isin !== a.resolvedSymbol && (
                                                    <div style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                        fontFamily: 'monospace',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}>
                                                        <span style={{ opacity: 0.7 }}>{a.isin}</span>
                                                    </div>
                                                )}
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

                    )
                }





                {/* Done Step */}
                {
                    step === 'done' && importResult && (
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
                    )
                }


                <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
            </div >
        </div >
    );
}
