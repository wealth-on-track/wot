import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseCSV } from '@/lib/importParser';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, errors: ['No file provided'] },
                { status: 400 }
            );
        }

        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        console.log('[PDF Parse] File:', file.name, 'Size:', file.size);

        // Extract text from PDF using unpdf
        const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true });
        console.log('[PDF Parse] Extracted pages:', totalPages, 'text length:', text?.length || 0);

        if (!text || text.trim() === '') {
            return NextResponse.json(
                { success: false, errors: ['Could not extract text from PDF'] },
                { status: 400 }
            );
        }

        console.log('[PDF Parse] First 2000 chars:', text.substring(0, 2000));

        // Check for İş Bank precious metals detection
        const { detectIsBankPreciousMetals } = await import('@/lib/isBankParser');
        const metalType = detectIsBankPreciousMetals(text);
        console.log('[PDF Parse] Detected metal type:', metalType);

        // Check what keywords exist (case-insensitive for better detection)
        const upperText = text.toUpperCase();
        const hasHesapOzeti = upperText.includes('HESAP') && (upperText.includes('ÖZETI') || upperText.includes('OZETI'));
        const hasXAU = upperText.includes('XAU');
        const hasXPT = upperText.includes('XPT');
        const hasALTIN = upperText.includes('ALTIN');
        const hasPLATIN = upperText.includes('PLATIN');
        const hasDateFormat = /\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}/.test(text);

        console.log('[PDF Parse] Keywords: HESAP ÖZETI=', hasHesapOzeti, 'XAU=', hasXAU, 'XPT=', hasXPT, 'ALTIN=', hasALTIN, 'PLATIN=', hasPLATIN, 'DateFormat=', hasDateFormat);

        // Parse the extracted text using our CSV/TXT parser
        const result = parseCSV(text);
        console.log('[PDF Parse] Parse result: success=', result.success, 'rows=', result.rows.length, 'tx=', result.transactions?.length || 0);

        // If no rows found but we detected precious metals format, add helpful error
        if (result.rows.length === 0 && metalType) {
            console.log('[PDF Parse] WARNING: Metal type detected but no rows parsed. Check parser.');
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[PDF Parse] Error:', error);
        return NextResponse.json(
            {
                success: false,
                rows: [],
                transactions: [],
                detectedColumns: {},
                unmappedColumns: [],
                errors: [`PDF parse hatası: ${error.message || 'Unknown error'}`],
                totalRows: 0,
                skippedRows: 0
            },
            { status: 500 }
        );
    }
}
