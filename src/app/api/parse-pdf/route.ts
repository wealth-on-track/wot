import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseCSV } from '@/lib/importParser';
import {
    apiMiddleware,
    sanitizeError,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/parse-pdf
 * Parse PDF files for portfolio import
 *
 * Security:
 * - Requires authentication
 * - Rate limited
 * - File size validation
 */
export async function POST(request: NextRequest) {
    try {
        // Security middleware: require auth + rate limit
        const middlewareError = await apiMiddleware(request, {
            requireAuth: true,
            rateLimit: STRICT_RATE_LIMIT,
        });

        if (middlewareError) {
            return middlewareError;
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, errors: ['No file provided'], code: 'NO_FILE' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, errors: ['File too large. Maximum size is 10MB'], code: 'FILE_TOO_LARGE' },
                { status: 400 }
            );
        }

        // Validate file extension
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json(
                { success: false, errors: ['Invalid file type. Only PDF files are allowed'], code: 'INVALID_FILE_TYPE' },
                { status: 400 }
            );
        }

        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();

        // SECURITY: Validate PDF magic bytes (not just extension)
        // PDF files must start with %PDF (hex: 25 50 44 46)
        const headerBytes = new Uint8Array(buffer.slice(0, 4));
        const pdfMagicBytes = [0x25, 0x50, 0x44, 0x46]; // %PDF
        const isValidPdf = pdfMagicBytes.every((byte, i) => headerBytes[i] === byte);

        if (!isValidPdf) {
            console.warn('[PDF Parse] Invalid PDF magic bytes detected - potential malicious file');
            return NextResponse.json(
                { success: false, errors: ['Invalid PDF file format. File does not appear to be a valid PDF'], code: 'INVALID_PDF_FORMAT' },
                { status: 400 }
            );
        }
        console.log('[PDF Parse] File:', file.name, 'Size:', file.size);

        // Extract text from PDF
        const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true });
        console.log('[PDF Parse] Extracted pages:', totalPages, 'text length:', text?.length || 0);

        if (!text || text.trim() === '') {
            return NextResponse.json(
                { success: false, errors: ['Could not extract text from PDF'], code: 'EXTRACTION_FAILED' },
                { status: 400 }
            );
        }

        // Check for İş Bank precious metals detection
        const { detectIsBankPreciousMetals } = await import('@/lib/isBankParser');
        const metalType = detectIsBankPreciousMetals(text);
        console.log('[PDF Parse] Detected metal type:', metalType);

        // Parse the extracted text
        const result = parseCSV(text);
        console.log('[PDF Parse] Parse result: success=', result.success, 'rows=', result.rows.length);

        return NextResponse.json(result);

    } catch (error) {
        const sanitized = sanitizeError(error, 'PDF parsing failed');
        console.error('[PDF Parse] Error:', error);
        return NextResponse.json(
            {
                success: false,
                rows: [],
                transactions: [],
                detectedColumns: {},
                unmappedColumns: [],
                errors: [sanitized.error],
                totalRows: 0,
                skippedRows: 0
            },
            { status: sanitized.status }
        );
    }
}
