"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Pencil, Building2, RefreshCw, TrendingUp, Shield, Coins, Landmark, PiggyBank } from 'lucide-react';
import { BESMetadata, calculateBESTotals, BESFundWithPrice, getFundAllocation } from '@/lib/besTypes';
import { getBESFundPrices } from '@/app/actions/marketData';

interface BESPortfolioItemProps {
  metadata: BESMetadata;
  onEdit: () => void;
  isOwner: boolean;
  displayCurrency: string;
  exchangeRate: number; // TRY to displayCurrency rate
}

// Asset class icons and colors
const ASSET_CLASS_CONFIG = {
  STOCK: { icon: TrendingUp, color: '#10b981', label: 'Hisse', bgColor: 'rgba(16, 185, 129, 0.1)' },
  BOND: { icon: Landmark, color: '#6366f1', label: 'Tahvil', bgColor: 'rgba(99, 102, 241, 0.1)' },
  GOLD: { icon: Coins, color: '#f59e0b', label: 'Altın', bgColor: 'rgba(245, 158, 11, 0.1)' },
  CASH: { icon: PiggyBank, color: '#8b5cf6', label: 'Nakit', bgColor: 'rgba(139, 92, 246, 0.1)' },
};

export function BESPortfolioItem({
  metadata,
  onEdit,
  isOwner,
  displayCurrency,
  exchangeRate
}: BESPortfolioItemProps) {
  // Default expanded to show funds
  const [isExpanded, setIsExpanded] = useState(true);
  const [showContracts, setShowContracts] = useState(false);
  const [fundPrices, setFundPrices] = useState<Record<string, BESFundWithPrice>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  const totals = calculateBESTotals(metadata);

  // Fetch fund prices on mount (since default is expanded)
  useEffect(() => {
    fetchFundPrices();
  }, []);

  const fetchFundPrices = async () => {
    setIsLoadingPrices(true);
    try {
      const fundCodes = [...new Set([
        ...metadata.katkiPayiFunds.map(f => f.code),
        'AET'
      ])];

      const prices = await getBESFundPrices(fundCodes);
      setFundPrices(prices);
    } catch (error) {
      console.error('[BES] Failed to fetch fund prices:', error);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const formatValue = (valueTRY: number, showTRY = false) => {
    if (showTRY || displayCurrency === 'TRY') {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(valueTRY);
    }

    const converted = valueTRY * exchangeRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(converted);
  };

  const formatPercentage = (value: number) => `${value.toFixed(0)}%`;

  // Get fund asset class info
  const getFundAssetClass = (code: string, name: string) => {
    const allocation = getFundAllocation(code, name);
    const primary = Object.entries(allocation).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
    if (!primary || !primary[1]) return null;
    const classKey = primary[0] as keyof typeof ASSET_CLASS_CONFIG;
    return ASSET_CLASS_CONFIG[classKey] || null;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg-secondary) 100%)',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)'
    }}>
      {/* Premium Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          cursor: 'pointer',
          transition: 'background 0.2s',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(167, 139, 250, 0.04) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Premium BES Badge */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            position: 'relative'
          }}>
            <Shield size={24} color="white" strokeWidth={2.5} />
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'var(--success)',
              border: '2px solid var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'white' }}>✓</span>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Bireysel Emeklilik
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#8B5CF6',
                background: 'rgba(139, 92, 246, 0.12)',
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px'
              }}>
                BES
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '2px'
            }}>
              {metadata.contracts.length} kontrat • {metadata.katkiPayiFunds.length} fon
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Total Value */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em'
            }}>
              {formatValue(totals.grandTotal)}
            </div>
            {displayCurrency !== 'TRY' && (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {formatValue(totals.grandTotal, true)}
              </div>
            )}
          </div>

          {/* Expand/Collapse */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transition: 'all 0.2s'
          }}>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>

          {/* Edit Button */}
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                padding: '8px',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-muted)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content - Fund Cards */}
      {isExpanded && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Summary Bar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Katkı Payı
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatValue(totals.totalKatkiPayi)}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Devlet Katkısı
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                {formatValue(totals.totalDevletKatkisi)}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchFundPrices();
              }}
              disabled={isLoadingPrices}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: isLoadingPrices ? 'wait' : 'pointer',
                padding: '8px 12px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <RefreshCw size={14} style={{ animation: isLoadingPrices ? 'spin 1s linear infinite' : 'none' }} />
              {isLoadingPrices ? '...' : 'Güncelle'}
            </button>
          </div>

          {/* Fund Cards Grid */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {totals.katkiPayiFundBreakdown.map((fund, index) => {
              const priceData = fundPrices[fund.code];
              const assetClass = getFundAssetClass(fund.code, fund.name);
              const allocation = getFundAllocation(fund.code, fund.name);

              return (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  gap: '16px',
                  transition: 'all 0.15s'
                }}>
                  {/* Fund Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {/* Asset Class Icon */}
                    {assetClass && (
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: assetClass.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <assetClass.icon size={18} color={assetClass.color} strokeWidth={2} />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--accent)'
                        }}>
                          {fund.code}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {priceData?.name || fund.name}
                        </span>
                      </div>
                      {/* Asset Class Tags */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {Object.entries(allocation).map(([cls, pct]) => {
                          if (!pct) return null;
                          const config = ASSET_CLASS_CONFIG[cls as keyof typeof ASSET_CLASS_CONFIG];
                          if (!config) return null;
                          return (
                            <span key={cls} style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color: config.color,
                              background: config.bgColor,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {config.label} {pct}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Percentage & Price */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}>
                      {formatPercentage(fund.percentage)}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: priceData?.currentPrice ? 'var(--text-muted)' : 'var(--text-disabled)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {priceData?.currentPrice
                        ? `₺${priceData.currentPrice.toFixed(4)}`
                        : isLoadingPrices ? '...' : '-'
                      }
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '100px'
                  }}>
                    {formatValue(fund.value)}
                  </div>
                </div>
              );
            })}

            {/* Devlet Katkısı - AET Fund (Special Card) */}
            {(() => {
              const aetPrice = fundPrices['AET'];
              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  gap: '16px'
                }}>
                  {/* Fund Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Landmark size={18} color="#10b981" strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--success)'
                        }}>
                          AET
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text-primary)'
                        }}>
                          {aetPrice?.name || 'Devlet Katkısı Fonu'}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: 'white',
                          background: 'var(--success)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px'
                        }}>
                          DEVLET KATKISI
                        </span>
                      </div>
                      {/* Asset Class Tags for AET: 50% Stocks, 50% Bonds */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: ASSET_CLASS_CONFIG.STOCK.color,
                          background: ASSET_CLASS_CONFIG.STOCK.bgColor,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Hisse 50%
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: ASSET_CLASS_CONFIG.BOND.color,
                          background: ASSET_CLASS_CONFIG.BOND.bgColor,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Tahvil 50%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}>
                      100%
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: aetPrice?.currentPrice ? 'var(--text-muted)' : 'var(--text-disabled)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {aetPrice?.currentPrice
                        ? `₺${aetPrice.currentPrice.toFixed(4)}`
                        : isLoadingPrices ? '...' : '-'
                      }
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--success)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '100px'
                  }}>
                    {formatValue(totals.totalDevletKatkisi)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Contracts Toggle */}
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowContracts(!showContracts)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                width: '100%',
                transition: 'all 0.15s'
              }}
            >
              <Building2 size={16} />
              {showContracts ? 'Kontratları Gizle' : 'Kontratları Göster'}
              {showContracts ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {showContracts && (
              <div style={{
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {metadata.contracts.map((contract, index) => (
                  <div key={index} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    alignItems: 'center',
                    padding: '14px 16px',
                    background: 'var(--surface)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {contract.name}
                      </div>
                      {contract.contractNo && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          #{contract.contractNo}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Katkı P.</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(contract.katkiPayi, true)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 500 }}>Devlet K.</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(contract.devletKatkisi, true)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Toplam</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(contract.katkiPayi + contract.devletKatkisi, true)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last Updated */}
          <div style={{
            marginTop: '16px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'right'
          }}>
            Son güncelleme: {new Date(metadata.lastUpdated).toLocaleDateString('tr-TR')}
          </div>
        </div>
      )}
    </div>
  );
}
