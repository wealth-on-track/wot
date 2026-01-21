import React from 'react';
import { AlertCircle, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ShareData } from './share/Templates';

interface InsightCardProps {
    title: string;
    description: string;
    impact_level: 'success' | 'warning' | 'danger' | 'info';
    value?: string;
    trend?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    graphType?: 'pie' | 'area' | 'bar';
    graphData?: any[];
    shareData?: ShareData;
    onShare?: (data: any) => void;
    children?: React.ReactNode;
}

const IMPACT_CONFIG = {
    success: {
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(255, 255, 255, 1) 100%)',
        iconBg: '#D1FAE5',
        iconColor: '#059669',
        valueColor: '#047857',
        borderColor: 'rgba(16, 185, 129, 0.12)',
        icon: TrendingUp
    },
    warning: {
        gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(255, 255, 255, 1) 100%)',
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        valueColor: '#B45309',
        borderColor: 'rgba(245, 158, 11, 0.12)',
        icon: AlertTriangle
    },
    danger: {
        gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(255, 255, 255, 1) 100%)',
        iconBg: '#FEE2E2',
        iconColor: '#DC2626',
        valueColor: '#B91C1C',
        borderColor: 'rgba(239, 68, 68, 0.12)',
        icon: AlertCircle
    },
    info: {
        gradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.06) 0%, rgba(255, 255, 255, 1) 100%)',
        iconBg: '#E2E8F0',
        iconColor: '#475569',
        valueColor: '#334155',
        borderColor: 'rgba(100, 116, 139, 0.12)',
        icon: Info
    }
};

export const InsightCard: React.FC<InsightCardProps> = ({
    title,
    description,
    impact_level,
    value,
    graphType,
    graphData,
    children,
}) => {
    const config = IMPACT_CONFIG[impact_level];
    const Icon = config.icon;

    return (
        <div
            style={{
                background: config.gradient,
                border: `1px solid ${config.borderColor}`,
                borderRadius: '16px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
                padding: '16px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.03)';
            }}
        >
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

                {/* Header - COMPACT */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '10px' }}>
                    {/* Icon - SMALLER */}
                    <div style={{
                        backgroundColor: config.iconBg,
                        color: config.iconColor,
                        padding: '8px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                        flexShrink: 0
                    }}>
                        <Icon size={20} strokeWidth={2.5} />
                    </div>

                    {/* Title - SMALLER */}
                    <h3 style={{
                        flex: 1,
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#64748B',
                        lineHeight: 1.3,
                        marginTop: '0px'
                    }}>
                        {title}
                    </h3>
                </div>

                {/* Value - STILL BIG BUT COMPACT */}
                {value && (
                    <div style={{
                        fontSize: '48px',
                        fontWeight: 800,
                        color: config.valueColor,
                        letterSpacing: '-0.03em',
                        lineHeight: 0.85,
                        marginBottom: '10px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                        {value}
                    </div>
                )}

                {/* Description - COMPACT */}
                <p style={{
                    fontSize: '12px',
                    lineHeight: 1.4,
                    color: '#475569',
                    fontWeight: 500,
                    marginBottom: '12px',
                    flex: 1
                }}>
                    {description}
                </p>

                {/* Footer: Chart - SMALLER */}
                {(graphData || children) && (
                    <div style={{
                        marginTop: 'auto',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(0, 0, 0, 0.04)'
                    }}>
                        {children ? children : (
                            graphType === 'pie' ? (
                                <div style={{ height: '40px', width: '40px', opacity: 0.7 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={graphData}
                                                innerRadius={12}
                                                outerRadius={20}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {graphData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : graphType === 'area' ? (
                                <div style={{ height: '40px', width: '120px', opacity: 0.6 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={graphData}>
                                            <defs>
                                                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={impact_level === 'danger' ? '#EF4444' : '#10B981'} stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor={impact_level === 'danger' ? '#EF4444' : '#10B981'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={impact_level === 'danger' ? '#EF4444' : '#10B981'}
                                                fill={`url(#grad-${title})`}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : null
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
