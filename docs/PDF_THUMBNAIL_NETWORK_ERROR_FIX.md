# PDF Thumbnail Network Error Fix

## Issue Summary
Users were experiencing network errors when trying to view PDF thumbnails on the dashboard:

```
NetworkError when attempting to fetch resource.
at PDFThumbnail (components/PDFThumbnail.tsx:188:7)
```

## Root Cause
The `PDFThumbnail` component was passing the PDF URL directly to the `Document` component from `react-pdf` without proper CORS configuration. This caused the browser to block the request due to cross-origin restrictions.

## Changes Made

### 1. Updated `PDFThumbnail.tsx` Component

#### Added CORS-friendly file configuration
```typescript
// Import useMemo for memoization
import { useState, useEffect, useRef, useMemo } from 'react'

// Create file config with proper CORS headers
const fileConfig = useMemo(() => {
  if (!pdfUrl) return null
  return {
    url: pdfUrl,
    httpHeaders: {
      'Access-Control-Allow-Origin': '*',
    },
    withCredentials: false,
  }
}, [pdfUrl])
```

#### Added PDF.js document options
```typescript
const documentOptions = useMemo(() => {
  const version = pdfVersion || '4.0.379'
  return {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
  }
}, [])
```

#### Updated Document component usage
```typescript
<Document
  file={fileConfig}  // Changed from: file={pdfUrl}
  options={documentOptions}  // Added
  onLoadSuccess={onDocumentLoadSuccess}
  onLoadError={onDocumentLoadError}
  loading=""
  className="flex items-center justify-center w-full h-full"
>
```

#### Enhanced error logging
```typescript
function onDocumentLoadError(error: Error) {
  console.error('PDF thumbnail load error:', {
    error: error.message,
    pdfUrl,
    errorStack: error.stack
  })
  setLoading(false)
  setError(true)
  setPageReady(false)
}
```

### 2. Created New Database Migration

**File**: `supabase/migrations/20250115000000_ensure_pdfs_bucket_public_access.sql`

This migration ensures:
- ✅ Bucket is set to public
- ✅ Simplified RLS policies for better public access
- ✅ Removed conflicting policies
- ✅ Added comprehensive "Public can read all PDFs" policy

Key changes:
```sql
-- Update bucket to be public
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800, -- 50MB limit
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'pdfs';

-- Create comprehensive public read policy
CREATE POLICY "Public can read all PDFs"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'pdfs');
```

### 3. Created Diagnostic API Endpoint

**File**: `app/api/test/pdf-access/route.ts`

This endpoint helps diagnose PDF accessibility issues:

**Usage**:
```
GET /api/test/pdf-access?summaryId=<summary-id>
```

**Returns**:
```json
{
  "summaryId": "...",
  "title": "...",
  "hasPdfUrl": true,
  "pdfUrl": "https://...",
  "isSupabaseStorage": true,
  "bucketName": "pdfs",
  "urlAccessible": true,
  "httpStatus": 200,
  "corsHeaders": {
    "access-control-allow-origin": "*"
  }
}
```

### 4. Created Documentation

**File**: `docs/SUPABASE_STORAGE_CORS_SETUP.md`

Comprehensive guide covering:
- Problem explanation
- Step-by-step CORS setup instructions
- Multiple configuration methods (Dashboard, CLI, API)
- Troubleshooting steps
- Security considerations
- Testing procedures

## Testing Steps

### 1. Apply Database Migration
```bash
# If using Supabase CLI
supabase migration up

# Or apply directly in Supabase Dashboard SQL Editor
```

### 2. Configure CORS (Required for Production)

**Option A: Supabase Dashboard**
1. Go to Storage → Configuration → CORS
2. Add configuration for `pdfs` bucket

**Option B: CLI**
```bash
supabase storage update pdfs \
  --public \
  --cors-allowed-origins="*" \
  --cors-allowed-methods="GET,HEAD" \
  --cors-allowed-headers="*"
```

### 3. Test PDF Accessibility

1. **Use diagnostic API**:
   ```
   https://yourdomain.com/api/test/pdf-access?summaryId=<id>
   ```

2. **Check dashboard**:
   - Navigate to `/dashboard`
   - Verify PDF thumbnails load without errors
   - Check browser console for any errors

3. **Verify in browser DevTools**:
   - Open Network tab
   - Filter by PDF requests
   - Check Response Headers for CORS headers

### 4. Clear Cache
```bash
# Development
rm -rf .next/cache
npm run dev

# Browser
Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
```

## Expected Behavior After Fix

### Before
- ❌ Network errors in console
- ❌ PDF thumbnails show error fallback
- ❌ CORS blocking requests

### After
- ✅ PDFs load successfully
- ✅ Thumbnails display properly
- ✅ No network errors
- ✅ CORS headers present in responses

## Rollback Plan

If issues occur, you can rollback the changes:

### Revert Code Changes
```bash
git revert <commit-hash>
```

### Revert Migration (If Needed)
```sql
-- Restore previous policies if needed
-- Note: Only do this if the new policy causes issues
DROP POLICY IF EXISTS "Public can read all PDFs" ON storage.objects;

-- Recreate old policies
CREATE POLICY "Anyone can view PDFs"
ON storage.objects FOR SELECT
TO anon, public, authenticated
USING (bucket_id = 'pdfs');
```

## Additional Notes

### Security Considerations
- Current configuration allows public read access to all PDFs
- Write access restricted to authenticated users for their own files
- For more restrictive access, modify RLS policy to check `is_public` flag

### Performance
- `useMemo` used to prevent unnecessary re-renders
- File config and document options are memoized
- No performance degradation expected

### Compatibility
- Works with existing PDF URLs
- No changes needed to database schema
- Backward compatible with existing summaries

## Related Files Modified

1. `components/PDFThumbnail.tsx` - Main fix for CORS issue
2. `supabase/migrations/20250115000000_ensure_pdfs_bucket_public_access.sql` - Database configuration
3. `app/api/test/pdf-access/route.ts` - Diagnostic endpoint
4. `docs/SUPABASE_STORAGE_CORS_SETUP.md` - Setup documentation

## References

- Original error stack trace at line 188 of `PDFThumbnail.tsx`
- Similar implementation in `PDFViewer.tsx` (lines 61-80)
- Supabase Storage policies in `supabase/migrations/20250109000000_create_pdfs_storage_bucket.sql`
- CORS fix attempt in `supabase/migrations/20250114000000_fix_pdfs_cors.sql`

