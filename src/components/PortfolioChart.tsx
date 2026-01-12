"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Sector } from "recharts";

interface PortfolioChartProps {
    assets: {
        name: string;
        value: number;
        color?: string;
    }[];
    totalValueEUR: number;
    showLegend?: boolean;
    onHover?: (name: string | null) => void;
    onClick?: (name: string) => void;
    activeSliceName?: string | null;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];

const renderActiveShape = (props: any) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill
    } = props;

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke={fill}
                strokeWidth={2}
                style={{
                    filter: 'drop-shadow(0 0 12px var(--accent-glow))',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none',
                    pointerEvents: 'none'
                }}
            />
            {/* Inner ring for extra depth */}
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 2}
                outerRadius={innerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ opacity: 0.5 }}
            />
        </g>
    );
};

export function PortfolioChart({ assets, totalValueEUR, showLegend = true, onHover, onClick, activeSliceName }: PortfolioChartProps) {
    const chartData = assets;
    const activeIndex = chartData.findIndex(item => item.name === activeSliceName);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', outline: 'none' }}>
            <div style={{ width: '100%', height: '100%', outline: 'none' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart style={{ outline: 'none' }}>
                        <Pie
                            activeShape={renderActiveShape}
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius="72%"
                            outerRadius="95%"
                            paddingAngle={5}
                            dataKey="value"
                            onMouseEnter={(data) => onHover?.(data.name)}
                            onMouseLeave={() => onHover?.(null)}
                            onClick={(data) => onClick?.(data.name)}
                            stroke="transparent"
                            style={{ outline: 'none', cursor: 'pointer' }}
                            animationBegin={0}
                            animationDuration={600}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color || COLORS[index % COLORS.length]}
                                    style={{
                                        transition: 'all 0.3s ease',
                                        outline: 'none',
                                        opacity: activeSliceName && activeSliceName !== entry.name ? 0.4 : 1,
                                    }}
                                />
                            ))}
                        </Pie>
                        {showLegend && <Legend />}
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
