import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true });

        return NextResponse.json({
            fileName: file.name,
            fileSize: file.size,
            totalPages,
            textLength: text?.length || 0,
            first2000Chars: text?.substring(0, 2000) || '',
            // Check for key patterns
            patterns: {
                hasHESAP: text?.includes('HESAP') || false,
                hasOZETI: text?.includes('ÖZETI') || text?.includes('OZETI') || false,
                hasXAU: text?.includes('XAU') || false,
                hasXPT: text?.includes('XPT') || false,
                hasALTIN: text?.includes('ALTIN') || text?.includes('Altın') || false,
                hasPLATIN: text?.includes('PLATIN') || text?.includes('Platin') || false,
                hasBANKASI: text?.includes('BANKASI') || false,
                hasIBAN: text?.includes('IBAN') || false,
                hasDateFormat: /\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}/.test(text || '') || false,
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
