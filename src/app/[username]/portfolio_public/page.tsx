import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import { getCachedPortfolioMetrics } from '@/lib/portfolio-cached';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicPortfolioView } from '@/components/PublicPortfolioView';

function mapCategory(type?: string, name?: string) {
  const t = (type || '').toUpperCase();
  const n = (name || '').toLowerCase();

  if (n.includes('altın') || n.includes('gold')) return 'Commodity';
  if (n.includes('hisse') || n.includes('equity')) return 'Stock';
  if (n.includes('para piyas')) return 'Cash';

  if (t === 'CRYPTO') return 'Crypto';
  if (t === 'BOND') return 'Bond';
  if (t === 'CASH' || t === 'CURRENCY' || t === 'FX') return 'Cash';
  if (t === 'COMMODITY' || t === 'GOLD') return 'Commodity';
  if (t === 'STOCK') return 'Stock';
  if (t === 'ETF' || t === 'FUND' || t === 'BES' || t === 'BES_FUND') return 'Fund/ETF';
  return 'Fund/ETF';
}

async function unlock(formData: FormData) {
  'use server';
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (password !== '1907') {
    redirect(`/${username}/portfolio_public?e=1`);
  }

  const c = await cookies();
  c.set(`wot_pub_${username}`, 'ok', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  redirect(`/${username}/portfolio_public`);
}

export default async function PublicPortfolioPage({ params, searchParams }: { params: Promise<{ username: string }>, searchParams: Promise<{ e?: string }> }) {
  const { username } = await params;
  const sp = await searchParams;

  const session = await auth();
  const ownerUsername = ((session?.user as any)?.username || session?.user?.name || '').toString().toLowerCase();
  const isOwner = ownerUsername === username.toLowerCase();

  const c = await cookies();
  const unlocked = c.get(`wot_pub_${username}`)?.value === 'ok';

  if (!isOwner && !unlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)' }}>
        <form action={unlock} style={{ width: 320, padding: 20, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <input type="hidden" name="username" value={username} />
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Protected Portfolio</div>
          <input name="password" type="password" placeholder="Password" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }} />
          {sp.e ? <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Wrong password</div> : null}
          <button type="submit" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>Enter</button>
        </form>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { Portfolio: { include: { Asset: true } } }
  });

  if (!user?.Portfolio) return <div style={{ padding: 24 }}>Portfolio not found</div>;

  const effectiveAssets = user.Portfolio.Asset.map((a: any) => ({
    ...a,
    type: a.customType || a.type,
    exchange: a.customExchange || a.exchange,
    currency: a.customCurrency || a.currency,
    country: a.customCountry || a.country,
    sector: a.customSector || a.sector,
  }));

  const rates = await getExchangeRates();
  const { assetsWithValues, totalValueEUR } = await getCachedPortfolioMetrics(effectiveAssets as any, rates);

  const open = assetsWithValues.filter((a: any) => (a.quantity || 0) > 0 && (a.totalValueEUR || 0) > 0);

  // Flatten BES into independent visible funds (no single BES bucket row)
  const flattened: any[] = [];
  for (const a of open as any[]) {
    if ((a.type || '').toUpperCase() === 'BES' && a.metadata) {
      const meta: any = a.metadata || {};
      const userFundOverrides = meta.userFundOverrides || {};

      const totalKP = meta.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
      const totalDK = meta.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
      const tryRate = rates?.TRY || 38.5;

      if (meta.katkiPayiFunds && meta.katkiPayiFunds.length > 0) {
        for (const fund of meta.katkiPayiFunds) {
          const ov = userFundOverrides[fund.code] || {};
          const valueTRY = (fund.percentage / 100) * totalKP;
          const valueEUR = valueTRY / tryRate;
          if (valueEUR <= 0) continue;

          flattened.push({
            id: `pp-bes-kp-${fund.code}`,
            symbol: fund.code,
            name: ov.name || fund.name,
            type: ov.type || 'FUND',
            totalValueEUR: valueEUR,
            _besParentId: a.id,
            _besFundCode: fund.code,
          });
        }
      }

      if (totalDK > 0) {
        const ov = userFundOverrides['AET'] || {};
        flattened.push({
          id: 'pp-bes-dk-AET',
          symbol: 'AET',
          name: ov.name || 'Devlet Katkısı Fonu',
          type: ov.type || 'FUND',
          totalValueEUR: totalDK / tryRate,
          _besParentId: a.id,
          _besFundCode: 'AET',
        });
      }

      continue;
    }

    flattened.push(a);
  }

  // Merge all cash-like assets into one cash row
  const cashLike = flattened.filter((a: any) => ['CASH', 'CURRENCY', 'FX'].includes((a.type || '').toUpperCase()));
  const nonCash = flattened.filter((a: any) => !['CASH', 'CURRENCY', 'FX'].includes((a.type || '').toUpperCase()));
  const mergedCashValue = cashLike.reduce((s: number, a: any) => s + (a.totalValueEUR || 0), 0);

  // Merge duplicate assets (same symbol) for cleaner public view
  const mergedBySymbol = new Map<string, any>();
  for (const a of nonCash as any[]) {
    const sym = String(a.symbol || a.name || a.id || '').toUpperCase();
    const key = `${sym}`;

    if (!mergedBySymbol.has(key)) {
      mergedBySymbol.set(key, {
        ...a,
        _mergedIds: [a.id],
        _ret1dWeighted: (a.changePercent1D || 0) * (a.totalValueEUR || 0),
        _retAllWeighted: (a.plPercentage || 0) * (a.totalValueEUR || 0),
      });
      continue;
    }

    const prev = mergedBySymbol.get(key);
    mergedBySymbol.set(key, {
      ...prev,
      totalValueEUR: (prev.totalValueEUR || 0) + (a.totalValueEUR || 0),
      _ret1dWeighted: (prev._ret1dWeighted || 0) + ((a.changePercent1D || 0) * (a.totalValueEUR || 0)),
      _retAllWeighted: (prev._retAllWeighted || 0) + ((a.plPercentage || 0) * (a.totalValueEUR || 0)),
      _mergedIds: [...(prev._mergedIds || []), a.id],
      // merged rows are display-only; don't map to a single assetId for write actions
      id: `merged-${key}`,
    });
  }

  const normalized = Array.from(mergedBySymbol.values());
  if (mergedCashValue > 0) {
    normalized.push({ id: 'merged-cash', symbol: 'CASH', name: 'Cash (Merged)', type: 'CASH', totalValueEUR: mergedCashValue } as any);
  }

  const grouped = new Map<string, any[]>();
  for (const a of normalized) {
    const key = mapCategory(a.type || undefined, a.name || undefined);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  const categories = Array.from(grouped.entries()).map(([name, items]) => {
    const sorted = items.sort((x, y) => (y.totalValueEUR || 0) - (x.totalValueEUR || 0));
    const value = sorted.reduce((s, i) => s + (i.totalValueEUR || 0), 0);
    const pct = totalValueEUR > 0 ? (value / totalValueEUR) * 100 : 0;

    const visibleItems = sorted
      .map((i: any) => {
        const val = i.totalValueEUR || 0;
        const oneDay = val > 0
          ? (typeof i._ret1dWeighted === 'number' ? i._ret1dWeighted / val : i.changePercent1D)
          : undefined;
        const allTime = val > 0
          ? (typeof i._retAllWeighted === 'number' ? i._retAllWeighted / val : i.plPercentage)
          : undefined;

        return {
          id: i.id,
          name: i.name || i.symbol,
          pct: totalValueEUR > 0 ? (val / totalValueEUR) * 100 : 0,
          oneDay,
          allTime,
          assetId: (String(i.id || '').startsWith('pp-bes-') || String(i.id || '').startsWith('merged-')) ? undefined : i.id,
          besParentId: i._besParentId,
          besFundCode: i._besFundCode,
        };
      })
      .filter((i: any) => Math.round(i.pct) > 0);

    return {
      name,
      pct,
      items: visibleItems
    };
  })
    .filter((c: any) => Math.round(c.pct) > 0 && c.items.length > 0)
    .sort((a, b) => b.pct - a.pct);

  return <PublicPortfolioView categories={categories} canEdit={isOwner} />;
}

/* autonomous-engine:JOB-20260309-204954895-001:single-functional-change */
