"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Pencil, Building2, RefreshCw } from 'lucide-react';
import { BESMetadata, calculateBESTotals, BESFundWithPrice } from '@/lib/besTypes';
import { getBESFundPrices } from '@/app/actions/marketData';

interface BESPortfolioItemProps {
  metadata: BESMetadata;
  onEdit: () => void;
  isOwner: boolean;
  displayCurrency: string;
  exchangeRate: number; // TRY to displayCurrency rate
}

export function BESPortfolioItem({
  metadata,
  onEdit,
  isOwner,
  displayCurrency,
  exchangeRate
}: BESPortfolioItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [fundPrices, setFundPrices] = useState<Record<string, BESFundWithPrice>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  const totals = calculateBESTotals(metadata);

  // Fetch fund prices when expanded
  useEffect(() => {
    if (isExpanded && Object.keys(fundPrices).length === 0) {
      fetchFundPrices();
    }
  }, [isExpanded]);

  const fetchFundPrices = async () => {
    setIsLoadingPrices(true);
    try {
      // Get all unique fund codes (katkiPayi funds + AET for devlet katkisi)
      const fundCodes = [...new Set([
        ...metadata.katkiPayiFunds.map(f => f.code),
        'AET' // Devlet Katkisi fund
      ])];

      const prices = await getBESFundPrices(fundCodes);
      setFundPrices(prices);
    } catch (error) {
      console.error('[BES] Failed to fetch fund prices:', error);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Format currency
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

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      {/* Main Row - Clickable to expand */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 120px 100px 40px',
          alignItems: 'center',
          padding: '16px 20px',
          cursor: 'pointer',
          transition: 'background 0.15s',
          gap: '16px'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Expand Icon */}
        <div style={{ color: 'var(--text-muted)' }}>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>

        {/* Name & Info */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '14px'
            }}>
              BES
            </div>
            <div style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              BES
            </div>
          </div>
        </div>

        {/* Total Value */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {formatValue(totals.grandTotal)}
          </div>
          {displayCurrency !== 'TRY' && (
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              {formatValue(totals.grandTotal, true)}
            </div>
          )}
        </div>

        {/* Placeholder for weight column */}
        <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '14px' }}>
          -
        </div>

        {/* Edit Button */}
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-muted)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '20px',
          background: 'var(--bg-secondary)'
        }}>
          {/* Katki Payi Funds */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div>
                  Katki Payi Fonlari
                  <span style={{
                    marginLeft: '8px',
                    fontWeight: 400,
                    textTransform: 'none',
                    letterSpacing: 'normal'
                  }}>
                    ({formatValue(totals.totalKatkiPayi)})
                  </span>
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  marginTop: '4px',
                  color: 'var(--success)'
                }}>
                  + Devlet Katkisi: {formatValue(totals.totalDevletKatkisi)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchFundPrices();
                }}
                disabled={isLoadingPrices}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isLoadingPrices ? 'wait' : 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <RefreshCw size={14} style={{ animation: isLoadingPrices ? 'spin 1s linear infinite' : 'none' }} />
                {isLoadingPrices ? 'Yukleniyor...' : 'Fiyatlari Guncelle'}
              </button>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {totals.katkiPayiFundBreakdown.map((fund, index) => {
                const priceData = fundPrices[fund.code];
                return (
                  <div key={index} style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 80px 100px 120px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    background: 'var(--surface)',
                    borderRadius: '8px',
                    gap: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--accent)'
                    }}>
                      {fund.code}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text-primary)'
                    }}>
                      {priceData?.name || fund.name}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text-muted)',
                      textAlign: 'right'
                    }}>
                      {formatPercentage(fund.percentage)}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: priceData?.currentPrice ? 'var(--text-primary)' : 'var(--text-muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {priceData?.currentPrice
                        ? `₺${priceData.currentPrice.toFixed(6)}`
                        : isLoadingPrices ? '...' : '-'
                      }
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {formatValue(fund.value)}
                    </div>
                  </div>
                );
              })}

              {/* Devlet Katkisi - AET Fund */}
              {(() => {
                const aetPrice = fundPrices['AET'];
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 80px 100px 120px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    background: 'var(--surface)',
                    borderRadius: '8px',
                    gap: '12px',
                    borderLeft: '3px solid var(--success)'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--success)'
                    }}>
                      AET
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text-primary)'
                    }}>
                      <span>{aetPrice?.name || 'Devlet Katkisi Fonu'}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: 'var(--success)',
                        background: 'var(--success-muted)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        DK
                      </span>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text-muted)',
                      textAlign: 'right'
                    }}>
                      100%
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: aetPrice?.currentPrice ? 'var(--text-primary)' : 'var(--text-muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {aetPrice?.currentPrice
                        ? `₺${aetPrice.currentPrice.toFixed(6)}`
                        : isLoadingPrices ? '...' : '-'
                      }
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {formatValue(totals.totalDevletKatkisi)}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Contracts Toggle */}
          <div>
            <button
              onClick={() => setShowContracts(!showContracts)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <Building2 size={16} />
              {showContracts ? 'Kontratlari Gizle' : 'Kontratlari Goster'}
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
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    borderRadius: '8px',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {contract.name}
                      </div>
                      {contract.contractNo && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          #{contract.contractNo}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Katki P.</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {formatValue(contract.katkiPayi, true)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Devlet K.</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {formatValue(contract.devletKatkisi, true)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Toplam</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
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
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'right'
          }}>
            Son guncelleme: {new Date(metadata.lastUpdated).toLocaleDateString('tr-TR')}
          </div>
        </div>
      )}
    </div>
  );
}
