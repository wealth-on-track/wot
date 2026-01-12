import { prisma } from "@/lib/prisma";

export type TableName =
    | 'User'
    | 'Portfolio'
    | 'Asset'
    | 'Goal'
    | 'PriceCache'
    | 'ExchangeRate'
    | 'AssetPriceHistory'
    | 'PortfolioSnapshot'
    | 'ApiUsage'
    | 'ApiRequestLog';

export interface TableInfo {
    name: TableName;
    displayName: string;
    description: string;
    recordCount: number;
}

export async function getTableList(): Promise<TableInfo[]> {
    const [
        userCount,
        portfolioCount,
        assetCount,
        goalCount,
        priceCacheCount,
        exchangeRateCount,
        historyCount,
        snapshotCount,
        apiUsageCount,
        apiLogCount
    ] = await Promise.all([
        prisma.user.count(),
        prisma.portfolio.count(),
        prisma.asset.count(),
        prisma.goal.count(),
        prisma.priceCache.count(),
        prisma.exchangeRate.count(),
        prisma.assetPriceHistory.count(),
        prisma.portfolioSnapshot.count(),
        prisma.apiUsage.count(),
        prisma.apiRequestLog.count()
    ]);

    return [
        { name: 'User', displayName: 'Users', description: 'User accounts', recordCount: userCount },
        { name: 'Portfolio', displayName: 'Portfolios', description: 'User portfolios', recordCount: portfolioCount },
        { name: 'Asset', displayName: 'Assets', description: 'User holdings', recordCount: assetCount },
        { name: 'Goal', displayName: 'Goals', description: 'Financial goals', recordCount: goalCount },
        { name: 'PriceCache', displayName: 'Price Cache', description: 'Cached prices from APIs', recordCount: priceCacheCount },
        { name: 'ExchangeRate', displayName: 'Exchange Rates', description: 'Currency exchange rates', recordCount: exchangeRateCount },
        { name: 'AssetPriceHistory', displayName: 'Price History', description: 'Historical price data', recordCount: historyCount },
        { name: 'PortfolioSnapshot', displayName: 'Portfolio Snapshots', description: 'Daily portfolio values', recordCount: snapshotCount },
        { name: 'ApiUsage', displayName: 'API Usage Stats', description: 'API usage statistics', recordCount: apiUsageCount },
        { name: 'ApiRequestLog', displayName: 'API Request Logs', description: 'Detailed API call logs', recordCount: apiLogCount }
    ];
}

export async function getTableData(tableName: TableName): Promise<any[]> {
    switch (tableName) {
        case 'User':
            return await prisma.user.findMany({ take: 500 });
        case 'Portfolio':
            return await prisma.portfolio.findMany({ take: 500 });
        case 'Asset':
            return await prisma.asset.findMany({ take: 500 });
        case 'Goal':
            return await prisma.goal.findMany({ take: 500 });
        case 'PriceCache':
            return await prisma.priceCache.findMany({ take: 500 });
        case 'ExchangeRate':
            return await prisma.exchangeRate.findMany({ take: 500 });
        case 'AssetPriceHistory':
            return await prisma.assetPriceHistory.findMany({
                take: 500,
                orderBy: { date: 'desc' }
            });
        case 'PortfolioSnapshot':
            return await prisma.portfolioSnapshot.findMany({
                take: 500,
                orderBy: { date: 'desc' }
            });
        case 'ApiUsage':
            return await prisma.apiUsage.findMany({
                take: 500,
                orderBy: { lastUpdated: 'desc' }
            });
        case 'ApiRequestLog':
            return await prisma.apiRequestLog.findMany({
                take: 500,
                orderBy: { createdAt: 'desc' }
            });
        default:
            return [];
    }
}

export function getTableColumns(tableName: TableName): string[] {
    const columnMap: Record<TableName, string[]> = {
        'User': ['id', 'username', 'email', 'password', 'createdAt', 'updatedAt'],
        'Portfolio': ['id', 'userId', 'isPublic', 'createdAt', 'updatedAt'],
        'Asset': ['id', 'portfolioId', 'type', 'symbol', 'name', 'quantity', 'buyPrice', 'currency', 'exchange', 'sector', 'country', 'platform', 'customGroup', 'createdAt', 'updatedAt'],
        'Goal': ['id', 'portfolioId', 'name', 'type', 'targetAmount', 'currentAmount', 'currency', 'deadline', 'isCompleted', 'createdAt', 'updatedAt'],
        'PriceCache': ['symbol', 'previousClose', 'currency', 'sector', 'country', 'tradeTime', 'source', 'lastRequestedBy', 'updatedAt'],
        'ExchangeRate': ['currency', 'rate', 'updatedAt'],
        'AssetPriceHistory': ['id', 'symbol', 'price', 'currency', 'date', 'createdAt'],
        'PortfolioSnapshot': ['id', 'portfolioId', 'date', 'totalValue', 'createdAt'],
        'ApiUsage': ['id', 'provider', 'dateKey', 'successCount', 'errorCount', 'lastUpdated'],
        'ApiRequestLog': ['id', 'provider', 'endpoint', 'params', 'status', 'statusCode', 'duration', 'error', 'userId', 'createdAt']
    };

    return columnMap[tableName] || [];
}

export function formatCellValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}
