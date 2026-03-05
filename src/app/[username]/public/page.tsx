import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import { getCachedPortfolioMetrics } from '@/lib/portfolio-cached';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

function mapCategory(type?: string) {
  const t = (type || '').toUpperCase();
  if (t === 'CRYPTO') return 'Crypto';
  if (t === 'BOND') return 'Bond';
  if (t === 'CASH' || t === 'CURRENCY' || t === 'FX') return 'Cash';
  if (t === 'COMMODITY' || t === 'GOLD') return 'Commodity';
  if (t === 'FUND' || t === 'ETF' || t === 'BES' || t === 'BES_FUND') return 'Fund/ETF';
  return 'Stock';
}

async function unlock(formData: FormData) {
  'use server';
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (password !== '1907') {
    redirect(`/${username}/public?e=1`);
  }

  const c = await cookies();
  c.set(`wot_pub_${username}`, 'ok', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  redirect(`/${username}/public`);
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
          <input
            name="password"
            type="password"
            placeholder="Password"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}
          />
          {sp.e ? <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Wrong password</div> : null}
          <button type="submit" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { Portfolio: { include: { Asset: true } } }
  });

  if (!user?.Portfolio) {
    return <div style={{ padding: 24 }}>Portfolio not found</div>;
  }

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

  const grouped = new Map<string, any[]>();
  for (const a of open) {
    const key = mapCategory(a.type);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  const categories = Array.from(grouped.entries()).map(([name, items]) => {
    const sorted = items.sort((x, y) => (y.totalValueEUR || 0) - (x.totalValueEUR || 0));
    const value = sorted.reduce((s, i) => s + (i.totalValueEUR || 0), 0);
    const pct = totalValueEUR > 0 ? (value / totalValueEUR) * 100 : 0;
    return { name, items: sorted, pct };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 20 }}>
      <h2 style={{ marginBottom: 10 }}>Public Portfolio Allocation</h2>
      <div style={{ color: 'var(--text-muted)', marginBottom: 18 }}>Amounts hidden • Percentages only</div>

      {categories.map((c) => (
        <div key={c.name} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)' }}>
            <b>{c.name}</b>
            <b>{Math.round(c.pct)}%</b>
          </div>
          <div>
            {c.items.map((a: any) => {
              const pct = totalValueEUR > 0 ? ((a.totalValueEUR || 0) / totalValueEUR) * 100 : 0;
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                  <span>{a.name || a.symbol}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
