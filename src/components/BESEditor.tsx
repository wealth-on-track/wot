"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, ChevronDown } from 'lucide-react';
import { BESMetadata, BESContract, BESFund, COMMON_BES_FUNDS, validateFundPercentages, calculateBESTotals } from '@/lib/besTypes';

interface BESEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: BESMetadata | null;
  onSave: (data: BESMetadata) => Promise<void>;
}

export function BESEditor({ isOpen, onClose, initialData, onSave }: BESEditorProps) {
  const [contracts, setContracts] = useState<BESContract[]>([]);
  const [funds, setFunds] = useState<BESFund[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from props
  useEffect(() => {
    if (initialData) {
      setContracts(initialData.contracts);
      setFunds(initialData.katkiPayiFunds);
    } else {
      // Default empty state with sample funds
      setContracts([]);
      setFunds([
        { code: 'AH2', name: 'PPF', percentage: 60 },
        { code: 'AH5', name: 'Hisse Fonu', percentage: 10 },
        { code: 'BGL', name: 'Altin Fonu', percentage: 15 },
        { code: 'AEA', name: 'Altin Katilim', percentage: 15 },
      ]);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const totalPercentage = funds.reduce((sum, f) => sum + f.percentage, 0);
  const isValidPercentage = Math.abs(totalPercentage - 100) < 0.01;

  const totals = calculateBESTotals({
    contracts,
    katkiPayiFunds: funds,
    lastUpdated: new Date().toISOString()
  });

  // Format number with Turkish locale
  const formatTRY = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Parse Turkish formatted number
  const parseTRY = (value: string): number => {
    // Remove dots (thousand separators) and replace comma with dot for decimal
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Add new contract
  const addContract = () => {
    const newId = `Kontrat${contracts.length + 1}`;
    setContracts([...contracts, {
      id: newId,
      name: newId,
      katkiPayi: 0,
      devletKatkisi: 0
    }]);
  };

  // Remove contract
  const removeContract = (index: number) => {
    setContracts(contracts.filter((_, i) => i !== index));
  };

  // Update contract field
  const updateContract = (index: number, field: keyof BESContract, value: string | number) => {
    const updated = [...contracts];
    if (field === 'katkiPayi' || field === 'devletKatkisi') {
      updated[index][field] = typeof value === 'string' ? parseTRY(value) : value;
    } else {
      (updated[index] as any)[field] = value;
    }
    setContracts(updated);
  };

  // Add new fund
  const addFund = () => {
    setFunds([...funds, { code: '', name: '', percentage: 0 }]);
  };

  // Remove fund
  const removeFund = (index: number) => {
    setFunds(funds.filter((_, i) => i !== index));
  };

  // Update fund field
  const updateFund = (index: number, field: keyof BESFund, value: string | number) => {
    const updated = [...funds];
    if (field === 'percentage') {
      updated[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else {
      (updated[index] as any)[field] = value;
    }
    setFunds(updated);
  };

  // Select fund from common list
  const selectCommonFund = (index: number, code: string) => {
    const commonFund = COMMON_BES_FUNDS.find(f => f.code === code);
    if (commonFund) {
      const updated = [...funds];
      updated[index] = { ...updated[index], code: commonFund.code, name: commonFund.name };
      setFunds(updated);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!isValidPercentage) {
      setError('Fon yuzdeleri toplami %100 olmali');
      return;
    }

    if (contracts.length === 0) {
      setError('En az bir kontrat eklemelisiniz');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data: BESMetadata = {
        contracts,
        katkiPayiFunds: funds,
        lastUpdated: new Date().toISOString()
      };
      await onSave(data);
      onClose();
    } catch (err) {
      setError('Kaydetme sirasinda hata olustu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              BES Emeklilik Ayarlari
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Kontrat ve fon bilgilerinizi girin
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: 'var(--text-muted)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Fund Allocation Section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Fon Dagilimi (Katki Payi)
              </h3>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isValidPercentage ? 'var(--success)' : 'var(--danger)'
              }}>
                Toplam: %{totalPercentage.toFixed(0)} {isValidPercentage ? '✓' : ''}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {funds.map((fund, index) => (
                <div key={index} style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  {/* Fund Code Selector */}
                  <div style={{ position: 'relative', width: '140px' }}>
                    <select
                      value={fund.code}
                      onChange={(e) => selectCommonFund(index, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        appearance: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Fon Sec...</option>
                      {COMMON_BES_FUNDS.map(f => (
                        <option key={f.code} value={f.code}>{f.code}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'var(--text-muted)'
                    }} />
                  </div>

                  {/* Fund Name */}
                  <input
                    type="text"
                    value={fund.name}
                    onChange={(e) => updateFund(index, 'name', e.target.value)}
                    placeholder="Fon Adi"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />

                  {/* Percentage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100px' }}>
                    <input
                      type="number"
                      value={fund.percentage}
                      onChange={(e) => updateFund(index, 'percentage', e.target.value)}
                      min="0"
                      max="100"
                      style={{
                        width: '70px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textAlign: 'right'
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>%</span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFund(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      color: 'var(--danger)',
                      opacity: 0.7
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              <button
                onClick={addFund}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                <Plus size={16} /> Fon Ekle
              </button>
            </div>

            {/* Devlet Katkisi Note */}
            <p style={{
              marginTop: '12px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              fontStyle: 'italic'
            }}>
              * Devlet Katkisi otomatik olarak %100 AET (Katki Fonu) olarak hesaplanir.
            </p>
          </div>

          {/* Contracts Section */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Kontratlar
              </h3>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                {contracts.length} kontrat
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {/* Header Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr 40px',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)'
              }}>
                <div>Kontrat Adi</div>
                <div>Sozlesme No</div>
                <div style={{ textAlign: 'right' }}>Katki Payi (₺)</div>
                <div style={{ textAlign: 'right' }}>Devlet Katkisi (₺)</div>
                <div></div>
              </div>

              {/* Contract Rows */}
              {contracts.map((contract, index) => (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 40px',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: index < contracts.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center'
                }}>
                  <input
                    type="text"
                    value={contract.name}
                    onChange={(e) => updateContract(index, 'name', e.target.value)}
                    placeholder="Kontrat adi"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="text"
                    value={contract.contractNo || ''}
                    onChange={(e) => updateContract(index, 'contractNo', e.target.value)}
                    placeholder="9055567"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="text"
                    value={formatTRY(contract.katkiPayi)}
                    onChange={(e) => updateContract(index, 'katkiPayi', e.target.value)}
                    placeholder="0"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      textAlign: 'right'
                    }}
                  />
                  <input
                    type="text"
                    value={formatTRY(contract.devletKatkisi)}
                    onChange={(e) => updateContract(index, 'devletKatkisi', e.target.value)}
                    placeholder="0"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      textAlign: 'right'
                    }}
                  />
                  <button
                    onClick={() => removeContract(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      color: 'var(--danger)',
                      opacity: 0.7
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {/* Add Contract Button */}
              <div style={{ padding: '12px 16px' }}>
                <button
                  onClick={addContract}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={16} /> Kontrat Ekle
                </button>
              </div>
            </div>
          </div>

          {/* Summary */}
          {contracts.length > 0 && (
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'var(--accent-muted)',
              borderRadius: '12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Toplam Katki Payi
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatTRY(totals.totalKatkiPayi)} ₺
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Toplam Devlet Katkisi
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatTRY(totals.totalDevletKatkisi)} ₺
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Genel Toplam
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
                  {formatTRY(totals.grandTotal)} ₺
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--danger)',
              fontSize: '14px'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Iptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isValidPercentage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: isValidPercentage ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isValidPercentage ? 'white' : 'var(--text-muted)',
                cursor: isValidPercentage ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              <Save size={16} />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
