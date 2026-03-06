import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const map: Record<string, string> = {
  'Stock': 'STOCK',
  'Bond': 'BOND',
  'Cash': 'CASH',
  'Commodity': 'COMMODITY',
  'Crypto': 'CRYPTO',
  'Fund/ETF': 'FUND',
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const category = String(body?.category || 'Fund/ETF');
  const nextType = map[category] || 'FUND';

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, include: { Portfolio: true } });
    if (!user?.Portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

    const besParentId = body?.besParentId ? String(body.besParentId) : '';
    const besFundCode = body?.besFundCode ? String(body.besFundCode) : '';
    const assetId = body?.assetId ? String(body.assetId) : '';

    if (besParentId && besFundCode) {
      const parent = await prisma.asset.findUnique({ where: { id: besParentId } });
      if (!parent || parent.portfolioId !== user.Portfolio.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      const meta: any = (parent.metadata as any) || {};
      const userFundOverrides = meta.userFundOverrides || {};
      const prev = userFundOverrides[besFundCode] || {};
      userFundOverrides[besFundCode] = { ...prev, type: nextType };

      await prisma.asset.update({ where: { id: besParentId }, data: { metadata: { ...meta, userFundOverrides } } });
      return NextResponse.json({ success: true });
    }

    if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.portfolioId !== user.Portfolio.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    await prisma.asset.update({ where: { id: assetId }, data: { customType: nextType } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('move-category api error', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
