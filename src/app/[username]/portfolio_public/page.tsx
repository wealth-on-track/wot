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

  // Merge all cash-like assets into one cash row
  const cashLike = open.filter((a: any) => ['CASH', 'CURRENCY', 'FX'].includes((a.type || '').toUpperCase()));
  const nonCash = open.filter((a: any) => !['CASH', 'CURRENCY', 'FX'].includes((a.type || '').toUpperCase()));
  const mergedCashValue = cashLike.reduce((s: number, a: any) => s + (a.totalValueEUR || 0), 0);

  const normalized = [...nonCash];
  if (mergedCashValue > 0) {
    normalized.push({ id: 'merged-cash', name: 'Cash (Merged)', type: 'CASH', totalValueEUR: mergedCashValue } as any);
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
    return {
      name,
      pct,
      items: sorted.map((i: any) => ({
        id: i.id,
        name: i.name || i.symbol,
        pct: totalValueEUR > 0 ? ((i.totalValueEUR || 0) / totalValueEUR) * 100 : 0,
      }))
    };
  }).sort((a, b) => b.pct - a.pct);

  return <PublicPortfolioView categories={categories} />;
}
