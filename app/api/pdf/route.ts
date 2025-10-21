import { logger } from '@/lib/utils/logger'

/**
 * PDF Compilation API Endpoint
 * POST /api/pdf
 * Compiles LaTeX source to PDF and returns the compiled PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { compileToPDF, isLatexAvailable } from '@/lib/pdf/compiler';
import { 
  createErrorResponse, 
  isMissingLatexError, 
  extractLatexError 
} from '@/lib/pdf/fallback';

// Request body schema
const PDFRequestSchema = z.object({
  latex: z.string().min(1, 'LaTeX content is required'),
  title: z.string().optional(),
  options: z.object({
    cmd: z.string().optional(),
    passes: z.number().min(1).max(3).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = PDFRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }
    
    const { latex, title, options } = validation.data;
    
    // Check if LaTeX compiler is available
    const latexAvailable = await isLatexAvailable();
    if (!latexAvailable) {
      return NextResponse.json(
        {
          error: 'LaTeX compiler not available',
          message: 'pdflatex is not installed on this system. Please install TeX Live or MiKTeX.',
        },
        { status: 503 }
      );
    }
    
    // Compile LaTeX to PDF
    const compileOptions: any = {
      title: title || 'Document'
    };
    if (options?.cmd) compileOptions.cmd = options.cmd;
    if (options?.passes) compileOptions.passes = options.passes;
    
    const result = await compileToPDF(latex, compileOptions);
    
    if (!result.success) {
      // Extract meaningful error message
      const errorMessage = result.error || 'Unknown compilation error';
      const extractedError = result.logs 
        ? extractLatexError(result.logs) 
        : errorMessage;
      
      // Check if error is due to missing LaTeX installation
      if (isMissingLatexError(errorMessage)) {
        return NextResponse.json(
          {
            error: 'LaTeX compiler not available',
            message: 'pdflatex is not installed or not in PATH',
          },
          { status: 503 }
        );
      }
      
      // Create error response with fallback PDF
      const errorData: any = {
        message: extractedError
      };
      if (result.logs) errorData.logs = result.logs;
      
      const errorResponse = await createErrorResponse(
        errorData,
        latex
      );
      
      // If fallback PDF was generated, return it with warning header
      if (errorResponse.fallbackPdf) {
        return new NextResponse(errorResponse.fallbackPdf as any, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="error-${title || 'document'}.pdf"`,
            'X-Compilation-Status': 'error',
            'X-Error-Message': encodeURIComponent(extractedError),
          },
        });
      }
      
      // If fallback also failed, return JSON error
      return NextResponse.json(
        {
          error: 'Compilation failed',
          message: extractedError,
          logs: result.logs,
        },
        { status: 422 }
      );
    }
    
    // Return PDF as binary response
    return new NextResponse(result.pdf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title || 'document'}.pdf"`,
        'Content-Length': result.pdf!.length.toString(),
      },
    });
    
  } catch (error) {
    logger.error('PDF compilation error', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
      );
  }
}

// Health check endpoint
export async function GET() {
  const latexAvailable = await isLatexAvailable();
  
  return NextResponse.json({
    status: 'ok',
    latexAvailable,
    message: latexAvailable 
      ? 'PDF compilation service is ready' 
      : 'pdflatex not available - compilation will fail',
  });
}
