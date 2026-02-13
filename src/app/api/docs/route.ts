/**
 * API Documentation Endpoint
 * Serves OpenAPI specification
 *
 * GET /api/docs - Returns OpenAPI JSON
 */

import { NextResponse } from 'next/server';
import openApiSpec from './openapi.json';

export async function GET() {
    return NextResponse.json(openApiSpec, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
            'Content-Type': 'application/json'
        }
    });
}
