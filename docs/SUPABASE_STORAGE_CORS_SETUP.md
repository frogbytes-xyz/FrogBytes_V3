# Supabase Storage CORS Configuration

## Problem
When trying to display PDF thumbnails on the dashboard, you may encounter network errors like:
```
NetworkError when attempting to fetch resource
```

This is typically caused by CORS (Cross-Origin Resource Sharing) restrictions on the Supabase Storage bucket.

## Solution

### 1. Database Configuration (Already Done)
The migration `20250115000000_ensure_pdfs_bucket_public_access.sql` configures:
- ✅ Bucket set to public
- ✅ RLS policies for public read access
- ✅ Authenticated user upload/update/delete policies

### 2. Supabase Dashboard CORS Configuration (Required)

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** → **Configuration** → **CORS**
3. Add CORS configuration for the `pdfs` bucket:

```json
{
  "allowedOrigins": ["*"],
  "allowedMethods": ["GET", "HEAD"],
  "allowedHeaders": ["*"],
  "maxAgeSeconds": 3600
}
```

For production, replace `"*"` in `allowedOrigins` with your specific domains:
```json
{
  "allowedOrigins": [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "http://localhost:3000"
  ],
  "allowedMethods": ["GET", "HEAD"],
  "allowedHeaders": ["authorization", "x-client-info", "apikey", "content-type"],
  "maxAgeSeconds": 3600
}
```

#### Option B: Using Supabase CLI

Run the following command:

```bash
supabase storage update pdfs \
  --public \
  --cors-allowed-origins="*" \
  --cors-allowed-methods="GET,HEAD" \
  --cors-allowed-headers="*" \
  --cors-max-age=3600
```

Or for production with specific domains:

```bash
supabase storage update pdfs \
  --public \
  --cors-allowed-origins="https://yourdomain.com,http://localhost:3000" \
  --cors-allowed-methods="GET,HEAD" \
  --cors-allowed-headers="authorization,x-client-info,apikey,content-type" \
  --cors-max-age=3600
```

#### Option C: Using Supabase Management API

```bash
curl -X POST https://api.supabase.com/v1/projects/{project-id}/config/storage/cors \
  -H "Authorization: Bearer {your-access-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "buckets": ["pdfs"],
    "config": {
      "allowedOrigins": ["*"],
      "allowedMethods": ["GET", "HEAD"],
      "allowedHeaders": ["*"],
      "maxAgeSeconds": 3600
    }
  }'
```

### 3. Verify Configuration

#### Using the Diagnostic API
Navigate to:
```
https://yourdomain.com/api/test/pdf-access?summaryId=<your-summary-id>
```

This will return diagnostic information including:
- PDF URL
- HTTP status
- CORS headers present
- Accessibility status

#### Using Browser DevTools
1. Open your dashboard in a browser
2. Open DevTools (F12) → Network tab
3. Refresh the page
4. Look for PDF requests
5. Check Response Headers for:
   - `access-control-allow-origin`
   - `access-control-allow-methods`

### 4. Code Changes (Already Applied)

The `PDFThumbnail` component has been updated to:
- ✅ Pass file config with CORS-friendly headers
- ✅ Set `withCredentials: false` to avoid credential-based CORS issues
- ✅ Use proper PDF.js configuration with CDN resources
- ✅ Add better error logging

## Troubleshooting

### Issue: Still getting network errors after CORS setup

**Check 1: Verify bucket is public**
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'pdfs';
```
Should return: `public = true`

**Check 2: Verify RLS policies**
```sql
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname ILIKE '%pdf%';
```
Should show the "Public can read all PDFs" policy.

**Check 3: Test URL directly**
Copy a PDF URL from the database and try accessing it directly in your browser. If it downloads/displays, the URL is accessible.

**Check 4: Check for authentication requirements**
Make sure `getPublicUrl()` is being used, not `getSignedUrl()` or `download()`.

### Issue: PDFs work locally but not in production

This usually means CORS is configured for local development but not for your production domain.

Update the `allowedOrigins` in CORS configuration to include your production domain.

### Issue: Some PDFs load, others don't

Check if:
1. The files actually exist in storage
2. The URLs are formatted correctly
3. The file paths match the RLS policy patterns (should be `{userId}/{summaryId}.pdf`)

Run this query to check for PDFs with missing files:
```sql
SELECT s.id, s.title, s.pdf_url
FROM summaries s
WHERE s.pdf_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id = 'pdfs'
  AND o.name LIKE '%' || s.id || '.pdf'
);
```

## Security Considerations

### Production CORS Configuration
For production, always specify explicit allowed origins:
```json
{
  "allowedOrigins": [
    "https://yourdomain.com",
    "https://www.yourdomain.com"
  ]
}
```

Never use `"*"` in production as it allows any website to access your storage.

### RLS Policies
The current setup allows:
- ✅ **Public READ** access to all PDFs (good for sharing)
- ✅ **Authenticated WRITE** access only to own files (good for security)

If you need to restrict PDF access, modify the RLS policy to check if:
- The summary is public (`is_public = true`), OR
- The user is the owner of the PDF

## Testing

After configuration:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Check dashboard for PDF thumbnails
4. Open DevTools Console for any errors
5. Use the diagnostic API: `/api/test/pdf-access?summaryId=<id>`

## References

- [Supabase Storage CORS Documentation](https://supabase.com/docs/guides/storage/cors)
- [Supabase Storage Security](https://supabase.com/docs/guides/storage/security/access-control)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

