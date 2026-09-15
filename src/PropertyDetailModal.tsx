import { useState, useEffect } from 'react';
import PropertyImage from './PropertyImage';
import { useTheme } from './theme';
import ThemeToggle from './ThemeToggle';

export interface PropertyDetailData {
  id?: number | string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  squareFeet?: number | string;
  lotSize?: number | string;
  yearBuilt?: number | string;
  stories?: number | string;
  garageSpaces?: number | string;
  apn?: string;

  // Financials
  estimatedValue?: number | string;
  valueRangeLow?: number | string;
  valueRangeHigh?: number | string;
  estimatedEquity?: number | string;
  equityPercent?: number | string;
  estimatedRent?: number | string;
  mortgageBalance?: number | string;
  taxAssessedValue?: number | string;
  lastSalePrice?: number | string;
  lastSaleDate?: string;

  // Distress
  isAbsenteeOwner?: boolean;
  isVacant?: boolean;
  taxDelinquent?: boolean;
  isPreForeclosure?: boolean;
  isForeclosure?: boolean;
  isProbate?: boolean;
  isBankruptcy?: boolean;
  hasLiens?: boolean;
  hasCodeViolations?: boolean;
  distressIndicators?: string[];

  // Intelligence & Ownership
  ownerName?: string;
  ownerOccupied?: string;
  opportunityScore?: number | null;
  opportunityReasons?: string[] | string;
  sourceProvider?: string;
  updatedAt?: string;
  stage?: string;
  loiStatus?: string;
}

interface PropertyDetailModalProps {
  property: PropertyDetailData;
  onClose: () => void;
  onExplainDeal?: () => void;
  onConvertToLead?: () => void;
  isConverting?: boolean;
  onOpenCreativeHub?: () => void;
  onToggleLoi?: () => void;
  loiStatus?: string;
  actionType?: 'search' | 'opportunity';
}

function parseNum(val: number | string | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  return Number(cleaned) || 0;
}

function formatCurrency(val: number | string | undefined): string {
  if (val === undefined || val === null || val === '') return '—';
  if (typeof val === 'string' && val.startsWith('$')) return val;
  const num = parseNum(val);
  if (num === 0 && val !== 0 && val !== '0') return '—';
  return `$${Math.round(num).toLocaleString()}`;
}

export default function PropertyDetailModal({
  property,
  onClose,
  onExplainDeal,
  onConvertToLead,
  isConverting = false,
  onOpenCreativeHub,
  onToggleLoi,
  loiStatus,
  actionType = 'search',
}: PropertyDetailModalProps) {
  const [theme] = useTheme();
  const isLight = theme === 'light';

  const [copied, setCopied] = useState(false);
  const [imgMode, setImgMode] = useState<'street' | 'satellite' | 'roadmap' | 'both'>('street');

  // Interactive Wholesale MAO calculator state
  const rawValue = parseNum(property.estimatedValue);
  const rawMortgage = parseNum(property.mortgageBalance);
  const [repairEstimate, setRepairEstimate] = useState<number>(25000);
  const [assignmentFee, setAssignmentFee] = useState<number>(15000);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Full address string
  const fullAddress = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');

  const handleCopyAddress = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddress
  )}`;

  // Calculate Wholesale MAO (70% Rule)
  const arv = rawValue;
  const mao = arv > 0 ? Math.max(0, Math.round(arv * 0.70 - repairEstimate - assignmentFee)) : 0;

  // Equity calculations
  const rawEquity = parseNum(property.estimatedEquity);
  let equityPct = 0;
  if (typeof property.equityPercent === 'number') {
    equityPct = Math.round(property.equityPercent);
  } else if (typeof property.equityPercent === 'string' && property.equityPercent) {
    equityPct = parseNum(property.equityPercent);
  } else if (arv > 0 && rawEquity > 0) {
    equityPct = Math.round((rawEquity / arv) * 100);
  }

  // Aggregate distress indicators
  const distressList: string[] = [];
  if (Array.isArray(property.distressIndicators)) {
    distressList.push(...property.distressIndicators);
  }
  if (property.isAbsenteeOwner && !distressList.some((d) => d.toLowerCase().includes('absentee'))) {
    distressList.push('Absentee Owner');
  }
  if (property.isVacant && !distressList.some((d) => d.toLowerCase().includes('vacant'))) {
    distressList.push('Vacant Property');
  }
  if (property.taxDelinquent && !distressList.some((d) => d.toLowerCase().includes('tax'))) {
    distressList.push('Tax Delinquent');
  }
  if (
    property.isPreForeclosure &&
    !distressList.some((d) => d.toLowerCase().includes('pre-foreclosure'))
  ) {
    distressList.push('Pre-Foreclosure');
  }
  if (property.isForeclosure && !distressList.some((d) => d.toLowerCase().includes('foreclosure'))) {
    distressList.push('Foreclosure');
  }
  if (property.isProbate && !distressList.some((d) => d.toLowerCase().includes('probate'))) {
    distressList.push('Probate');
  }
  if (property.isBankruptcy && !distressList.some((d) => d.toLowerCase().includes('bankruptcy'))) {
    distressList.push('Bankruptcy');
  }
  if (property.hasLiens && !distressList.some((d) => d.toLowerCase().includes('liens'))) {
    distressList.push('Open Liens');
  }
  if (
    property.hasCodeViolations &&
    !distressList.some((d) => d.toLowerCase().includes('violations'))
  ) {
    distressList.push('Code Violations');
  }

  // Opportunity score color formatting
  const score = property.opportunityScore;
  let scoreBg = isLight ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.2)';
  let scoreColor = isLight ? '#047857' : '#10b981';
  let scoreLabel = 'High Target';
  if (score != null) {
    if (score >= 90) {
      scoreBg = isLight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.25)';
      scoreColor = isLight ? '#047857' : '#10b981';
      scoreLabel = 'Prime Opportunity';
    } else if (score >= 75) {
      scoreBg = isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.2)';
      scoreColor = isLight ? '#0284c7' : '#38bdf8';
      scoreLabel = 'Strong Target';
    } else if (score >= 50) {
      scoreBg = isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(245, 158, 11, 0.2)';
      scoreColor = isLight ? '#b45309' : '#f59e0b';
      scoreLabel = 'Moderate Deal';
    } else {
      scoreBg = isLight ? 'rgba(100, 116, 139, 0.12)' : 'rgba(148, 163, 184, 0.2)';
      scoreColor = isLight ? '#475569' : '#94a3b8';
      scoreLabel = 'Standard Lead';
    }
  }

  // Theme-aware tokens
  const colors = {
    overlayBg: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(5, 10, 20, 0.85)',
    modalBg: isLight ? '#ffffff' : '#121216',
    border: isLight ? '#e2e8f0' : '#30363d',
    headerBg: isLight ? '#f8fafc' : '#16161b',
    footerBg: isLight ? '#f8fafc' : '#16161b',
    sectionBg: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
    boxBg: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.35)',
    boxBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
    inkPrimary: isLight ? '#0f172a' : '#f2f1ec',
    inkSecondary: isLight ? '#334155' : '#cbd5e1',
    inkMuted: isLight ? '#64748b' : '#94a3b8',
    pillBg: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
    pillBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
    accentBlue: isLight ? '#0284c7' : '#38bdf8',
    accentGreen: isLight ? '#047857' : '#10b981',
    accentGreenBg: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
    accentGreenBorder: isLight ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)',
    accentAmber: isLight ? '#b45309' : '#f59e0b',
    calcCardBg: isLight ? 'rgba(0, 168, 159, 0.06)' : 'rgba(0, 168, 159, 0.12)',
    calcCardBorder: isLight ? '1px solid rgba(0, 168, 159, 0.3)' : '1px solid rgba(0, 168, 159, 0.35)',
    calcTitle: isLight ? '#0f766e' : '#2dd4bf',
    distressBg: isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.18)',
    distressBorder: isLight ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(239, 68, 68, 0.4)',
    distressText: isLight ? '#b91c1c' : '#fca5a5',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.overlayBg,
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.modalBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isLight
            ? '0 20px 50px rgba(0, 0, 0, 0.15)'
            : '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          color: colors.inkPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: colors.headerBg,
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🏡</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  color: colors.inkPrimary,
                  letterSpacing: '-0.3px',
                }}
              >
                {property.address || 'Property Details'}
              </h2>
              <div style={{ fontSize: '13px', color: colors.inkMuted, marginTop: '2px' }}>
                {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
                {property.county ? ` · ${property.county} County` : ''}
                {property.apn ? ` · APN: ${property.apn}` : ''}
              </div>
            </div>
          </div>

          {/* Header Action Buttons & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <ThemeToggle />

            <button
              type="button"
              onClick={handleCopyAddress}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                border: `1px solid ${colors.border}`,
                color: colors.inkPrimary,
                background: colors.boxBg,
              }}
              title="Copy property address"
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied!' : 'Copy Address'}</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                border: `1px solid ${colors.border}`,
                textDecoration: 'none',
                color: colors.inkPrimary,
                background: colors.boxBg,
              }}
              title="View in Google Maps"
            >
              <span>📍</span>
              <span>Google Maps</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: colors.pillBg,
                border: `1px solid ${colors.border}`,
                color: colors.inkMuted,
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable Body Content ────────────────────────────────── */}
        <div
          style={{
            padding: '20px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            background: colors.modalBg,
          }}
        >
          {/* Status Chips Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {score != null && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    background: scoreBg,
                    border: `1px solid ${scoreColor}`,
                    color: scoreColor,
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  <span>★ Revzenta Score: {score}/100</span>
                  <span style={{ opacity: 0.85, fontSize: '11px' }}>({scoreLabel})</span>
                </div>
              )}

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: colors.pillBg,
                  color: colors.inkSecondary,
                  border: colors.pillBorder,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                {property.propertyType || 'Single Family'}
              </span>

              {property.stage && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.15)',
                    color: isLight ? '#0284c7' : '#38bdf8',
                    border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  Stage: {property.stage}
                </span>
              )}

              {loiStatus && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background:
                      loiStatus === 'Sent'
                        ? isLight
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(16, 185, 129, 0.15)'
                        : colors.pillBg,
                    color:
                      loiStatus === 'Sent'
                        ? isLight
                          ? '#047857'
                          : '#10b981'
                        : colors.inkMuted,
                    border:
                      loiStatus === 'Sent'
                        ? isLight
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : '1px solid rgba(16, 185, 129, 0.4)'
                        : `1px solid ${colors.border}`,
                  }}
                >
                  LOI: {loiStatus}
                </span>
              )}
            </div>

            {/* Photo mode selector tabs */}
            <div
              style={{
                display: 'inline-flex',
                background: colors.boxBg,
                padding: '3px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                gap: '2px',
              }}
            >
              {[
                { id: 'street', label: '📸 Street View' },
                { id: 'satellite', label: '🛰️ Satellite' },
                { id: 'roadmap', label: '🗺️ Map' },
                { id: 'both', label: '⊞ Split View' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setImgMode(tab.id as any)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background:
                      imgMode === tab.id
                        ? isLight
                          ? '#00a89f'
                          : 'var(--lime, #00a89f)'
                        : 'transparent',
                    color:
                      imgMode === tab.id
                        ? '#ffffff'
                        : colors.inkMuted,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Visual Imagery Banner: High-Resolution Property Picture ── */}
          <div
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: `1px solid ${colors.border}`,
              background: isLight ? '#f1f5f9' : '#0b1329',
              boxShadow: isLight
                ? '0 4px 12px rgba(0,0,0,0.06)'
                : '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <PropertyImage
              address={property.address}
              city={property.city}
              state={property.state}
              zip={property.zip}
              latitude={property.latitude}
              longitude={property.longitude}
              mode={imgMode}
              streetHeight={280}
              satelliteHeight={280}
            />
          </div>

          {/* ── SECTION 1: Financial Snapshot & Wholesale Calculator ─── */}
          <div
            style={{
              background: colors.sectionBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: colors.accentBlue,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>💰</span>
                <span>Financial Snapshot &amp; Valuation</span>
              </div>
              {property.updatedAt && (
                <span style={{ fontSize: '11px', color: colors.inkMuted }}>
                  Synced: {new Date(property.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* 4-Box Key Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              {/* Est Value */}
              <div
                style={{
                  background: colors.boxBg,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: colors.boxBorder,
                }}
              >
                <div style={{ fontSize: '11.5px', color: colors.inkMuted, fontWeight: 700 }}>
                  Estimated Market Value (ARV)
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: colors.inkPrimary,
                    marginTop: '4px',
                  }}
                >
                  {formatCurrency(property.estimatedValue)}
                </div>
                {(property.valueRangeLow || property.valueRangeHigh) && (
                  <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                    Range: {formatCurrency(property.valueRangeLow)} – {formatCurrency(property.valueRangeHigh)}
                  </div>
                )}
              </div>

              {/* Est Equity */}
              <div
                style={{
                  background: colors.accentGreenBg,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.accentGreenBorder}`,
                }}
              >
                <div style={{ fontSize: '11.5px', color: colors.accentGreen, fontWeight: 700 }}>
                  Estimated Equity Spread
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: colors.accentGreen,
                    marginTop: '4px',
                  }}
                >
                  {equityPct}% ({formatCurrency(property.estimatedEquity || rawEquity)})
                </div>
                <div style={{ fontSize: '11px', color: colors.accentGreen, opacity: 0.85, marginTop: '2px', fontWeight: 600 }}>
                  {equityPct >= 40 ? 'High Equity Target' : 'Moderate Equity Position'}
                </div>
              </div>

              {/* Mortgage Balance */}
              <div
                style={{
                  background: colors.boxBg,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: colors.boxBorder,
                }}
              >
                <div style={{ fontSize: '11.5px', color: colors.inkMuted, fontWeight: 700 }}>
                  Open Mortgage Balance
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: rawMortgage > 0 ? colors.accentAmber : colors.accentBlue,
                    marginTop: '4px',
                  }}
                >
                  {rawMortgage > 0 ? formatCurrency(property.mortgageBalance) : 'Free & Clear'}
                </div>
                <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                  {rawMortgage > 0 ? 'Recorded First Lien Debt' : 'No Recorded Mortgages'}
                </div>
              </div>

              {/* Estimated Rent */}
              <div
                style={{
                  background: colors.boxBg,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: colors.boxBorder,
                }}
              >
                <div style={{ fontSize: '11.5px', color: colors.inkMuted, fontWeight: 700 }}>
                  Estimated Market Rent
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: colors.accentBlue,
                    marginTop: '4px',
                  }}
                >
                  {property.estimatedRent ? `${formatCurrency(property.estimatedRent)}/mo` : '—'}
                </div>
                <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                  {rawValue > 0 && parseNum(property.estimatedRent) > 0
                    ? `${(((parseNum(property.estimatedRent) * 12) / rawValue) * 100).toFixed(1)}% Gross Yield`
                    : 'Rental Potential'}
                </div>
              </div>
            </div>

            {/* Additional Tax & Sales History */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                padding: '12px 16px',
                background: colors.boxBg,
                borderRadius: '8px',
                border: colors.boxBorder,
                fontSize: '12.5px',
                color: colors.inkSecondary,
                marginBottom: '16px',
              }}
            >
              <div>
                <strong style={{ color: colors.inkPrimary }}>Assessed Tax Value:</strong>{' '}
                {formatCurrency(property.taxAssessedValue)}
              </div>
              <div>
                <strong style={{ color: colors.inkPrimary }}>Last Recorded Sale:</strong>{' '}
                {formatCurrency(property.lastSalePrice)}{' '}
                {property.lastSaleDate ? `(${property.lastSaleDate})` : ''}
              </div>
            </div>

            {/* Wholesale Underwriting Formula (Interactive 70% Rule MAO) */}
            <div
              style={{
                background: colors.calcCardBg,
                border: colors.calcCardBorder,
                borderRadius: '10px',
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 800,
                    color: colors.calcTitle,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                  }}
                >
                  ⚡ Wholesale Deal Calculator (70% Rule)
                </span>
                <span style={{ fontSize: '11.5px', color: colors.inkMuted }}>
                  MAO = (ARV × 0.70) − Repairs − Fee
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                {/* 70% Base */}
                <div style={{ fontSize: '12.5px' }}>
                  <div style={{ color: colors.inkMuted }}>70% of ARV:</div>
                  <strong style={{ fontSize: '16px', color: colors.inkPrimary }}>
                    {formatCurrency(arv > 0 ? arv * 0.7 : 0)}
                  </strong>
                </div>

                {/* Repair Allowance Selector */}
                <div>
                  <div style={{ fontSize: '11.5px', color: colors.inkMuted, marginBottom: '4px' }}>
                    Est. Repairs:
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[10000, 25000, 50000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRepairEstimate(amt)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border:
                            repairEstimate === amt
                              ? '1px solid #00a89f'
                              : `1px solid ${colors.border}`,
                          background:
                            repairEstimate === amt
                              ? '#00a89f'
                              : colors.boxBg,
                          color:
                            repairEstimate === amt ? '#ffffff' : colors.inkSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        ${amt / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wholesale Fee */}
                <div>
                  <div style={{ fontSize: '11.5px', color: colors.inkMuted, marginBottom: '4px' }}>
                    Wholesale Fee:
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[10000, 15000, 25000].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setAssignmentFee(fee)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border:
                            assignmentFee === fee
                              ? '1px solid #0284c7'
                              : `1px solid ${colors.border}`,
                          background:
                            assignmentFee === fee ? '#0284c7' : colors.boxBg,
                          color: assignmentFee === fee ? '#ffffff' : colors.inkSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        ${fee / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Max Allowable Offer */}
                <div
                  style={{
                    background: colors.boxBg,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: isLight ? '2px solid #00a89f' : '1px solid #00a89f',
                    textAlign: 'right',
                  }}
                >
                  <div style={{ fontSize: '11px', color: colors.calcTitle, fontWeight: 800 }}>
                    Target MAO:
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: colors.inkPrimary }}>
                    {formatCurrency(mao)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Physical Property Specifications ──────────── */}
          <div
            style={{
              background: colors.sectionBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: colors.accentBlue,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🏡</span>
              <span>Physical Specifications &amp; Assessor Records</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
              }}
            >
              {[
                { label: '🛏️ Bedrooms', val: property.bedrooms ? `${property.bedrooms} Beds` : '—' },
                { label: '🛁 Bathrooms', val: property.bathrooms ? `${property.bathrooms} Baths` : '—' },
                {
                  label: '📐 Living Area',
                  val: property.squareFeet
                    ? typeof property.squareFeet === 'number'
                      ? `${property.squareFeet.toLocaleString()} SqFt`
                      : property.squareFeet
                    : '—',
                },
                { label: '🌳 Lot Size', val: property.lotSize ? String(property.lotSize) : '—' },
                {
                  label: '🏗️ Year Built',
                  val: property.yearBuilt
                    ? `${property.yearBuilt} (${new Date().getFullYear() - Number(property.yearBuilt)} yrs)`
                    : '—',
                },
                { label: '🏢 Stories', val: property.stories ? `${property.stories} Story` : '—' },
                { label: '🚗 Garage', val: property.garageSpaces ? `${property.garageSpaces} Spaces` : '—' },
                { label: '🏷️ APN Parcel', val: property.apn || '—', mono: true },
              ].map((spec, i) => (
                <div
                  key={i}
                  style={{
                    background: colors.boxBg,
                    padding: '12px',
                    borderRadius: '8px',
                    border: colors.boxBorder,
                  }}
                >
                  <div style={{ fontSize: '11px', color: colors.inkMuted, fontWeight: 600 }}>
                    {spec.label}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: colors.inkPrimary,
                      marginTop: '2px',
                      fontFamily: spec.mono ? 'monospace' : 'inherit',
                    }}
                  >
                    {spec.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: Distress Signals & Seller Motivation ───────── */}
          <div
            style={{
              background: colors.sectionBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: colors.accentAmber,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚡</span>
              <span>Distress Signals &amp; Seller Motivation</span>
            </div>

            {distressList.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {distressList.map((d) => (
                  <div
                    key={d}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: colors.distressBg,
                      border: colors.distressBorder,
                      color: colors.distressText,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <span>⚠️</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: colors.accentGreenBg,
                  border: `1px solid ${colors.accentGreenBorder}`,
                  color: colors.accentGreen,
                  fontSize: '13px',
                  marginBottom: '14px',
                  lineHeight: 1.5,
                }}
              >
                ✓ <strong>Standard Equity Profile:</strong> No public distress records (tax delinquent,
                pre-foreclosure, probate) detected. Prime target for cash equity offers or creative seller
                financing.
              </div>
            )}

            {/* Score insights / explanations */}
            {property.opportunityReasons && (
              <div
                style={{
                  fontSize: '13px',
                  color: colors.inkSecondary,
                  background: colors.boxBg,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: colors.boxBorder,
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: colors.inkPrimary }}>🧠 Revzenta AI Underwriting Insights:</strong>{' '}
                {Array.isArray(property.opportunityReasons)
                  ? property.opportunityReasons.join(' · ')
                  : property.opportunityReasons}
              </div>
            )}
          </div>

          {/* ── SECTION 4: Ownership & Provenance ─────────────────────── */}
          <div
            style={{
              background: colors.sectionBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12.5px',
              color: colors.inkMuted,
            }}
          >
            <div>
              <strong style={{ color: colors.inkPrimary }}>👤 Recorded Owner:</strong>{' '}
              <span style={{ color: colors.inkPrimary, fontWeight: 600 }}>
                {property.ownerName || 'Public Assessor Record'}
              </span>{' '}
              {property.ownerOccupied ? `(${property.ownerOccupied})` : ''}
            </div>
            <div>
              <strong style={{ color: colors.inkPrimary }}>📡 Data Source:</strong>{' '}
              <span style={{ color: colors.inkPrimary, fontWeight: 600 }}>
                {property.sourceProvider || 'Unified Assessor + RentCast'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Modal Footer Action Bar ───────────────────────────────── */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: `1px solid ${colors.border}`,
            background: colors.footerBg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              fontSize: '13px',
              padding: '8px 18px',
              background: colors.boxBg,
              border: `1px solid ${colors.border}`,
              color: colors.inkPrimary,
            }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Run AI Deal Underwriting */}
            {onExplainDeal && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onExplainDeal();
                }}
                style={{
                  fontSize: '13px',
                  padding: '8px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isLight ? '#7c3aed' : '#c084fc',
                  borderColor: isLight ? 'rgba(124, 58, 237, 0.4)' : 'rgba(192, 132, 252, 0.4)',
                  background: colors.boxBg,
                }}
              >
                <span>🧠</span>
                <span>AI Deal Analysis</span>
              </button>
            )}

            {/* Toggle LOI if in Opportunities */}
            {onToggleLoi && loiStatus && (
              <button
                type="button"
                onClick={onToggleLoi}
                style={{
                  fontSize: '13px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border:
                    loiStatus === 'Sent'
                      ? '1px solid rgba(16, 185, 129, 0.5)'
                      : `1px solid ${colors.border}`,
                  backgroundColor:
                    loiStatus === 'Sent'
                      ? isLight
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(16, 185, 129, 0.15)'
                      : colors.boxBg,
                  color:
                    loiStatus === 'Sent'
                      ? isLight
                        ? '#047857'
                        : '#10b981'
                      : colors.inkMuted,
                }}
              >
                <span>{loiStatus === 'Sent' ? '✓' : '○'}</span>
                <span>LOI: {loiStatus} (Toggle)</span>
              </button>
            )}

            {/* Creative Hub Action (Opportunities) */}
            {actionType === 'opportunity' && onOpenCreativeHub && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenCreativeHub}
                style={{
                  fontSize: '13px',
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <span>⚡</span>
                <span>Open in Creative Hub</span>
              </button>
            )}

            {/* Convert to Lead (Property Search) */}
            {actionType === 'search' && onConvertToLead && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onConvertToLead}
                disabled={isConverting}
                style={{
                  fontSize: '13px',
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <span>➕</span>
                <span>{isConverting ? 'Importing Lead...' : 'Convert to Lead'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
