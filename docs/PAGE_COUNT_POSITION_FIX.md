# Page Count Position Fix - Library View

## Problem
The page count badge on PDF thumbnails in the library was positioned too far to the right (`right-11` = 2.75rem from the right edge), making it look unbalanced.

## Solution
Added a configurable `pageCountPosition` prop to the `PDFThumbnail` component to control the badge position independently for different contexts.

## Changes Made

### 1. `components/PDFThumbnail.tsx`
- Added `pageCountPosition?: 'right-3' | 'right-11'` prop to the component interface
- Default value: `'right-11'` (maintains backward compatibility)
- Updated the page count badge to use the dynamic position class

```tsx
// Before
<div className="absolute bottom-3 right-11 bg-black text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-20">
  {numPages} pages
</div>

// After
<div className={`absolute bottom-3 ${pageCountPosition} bg-black text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-20`}>
  {numPages} pages
</div>
```

### 2. `app/library/page.tsx`
- Added `pageCountPosition="right-3"` prop to PDFThumbnail in the grid view
- This moves the badge from 2.75rem (right-11) to 0.75rem (right-3) from the right edge

```tsx
<PDFThumbnail
  pdfUrl={summary.pdf_url}
  width={450}
  height={300}
  className="cursor-pointer transition-transform group-hover:scale-105"
  pageCountPosition="right-3"  // <-- New prop
/>
```

## Visual Impact

### Library View (CHANGED)
**Before**: `right-11` (2.75rem) → Badge appeared too far right  
**After**: `right-3` (0.75rem) → Badge is more centered and balanced

### Dashboard View (UNCHANGED)
**Position**: `right-11` (2.75rem) - Default value used  
**Reason**: Works perfectly with the "Published/Private" badge at `right-6` (1.5rem)

### Collections View (UNCHANGED)
**Position**: `right-11` (2.75rem) - Default value used  
**Reason**: Maintains existing layout with other badges

## Positioning Details

| Context | Position | Distance from Right | Notes |
|---------|----------|-------------------|-------|
| Library | `right-3` | 0.75rem | More centered, better balance |
| Dashboard | `right-11` | 2.75rem | Works with "Published/Private" badge |
| Collections | `right-11` | 2.75rem | Default position |

## Why This Works

1. **Library context**: No other badges on the thumbnail, so a more centered position looks better
2. **Dashboard context**: The "Published/Private" badge at `right-6` creates visual balance with the page count at `right-11`
3. **Backward compatible**: All existing uses default to `right-11`, maintaining current behavior
4. **Type-safe**: TypeScript ensures only valid positions can be used

## Files Modified
- `components/PDFThumbnail.tsx` - Added prop and dynamic positioning
- `app/library/page.tsx` - Applied `right-3` position for better visual balance

## Testing Recommendation
1. Navigate to `/library` and check the page count badge position on documents
2. Navigate to `/dashboard` and verify the page count badge position remains unchanged
3. Navigate to `/dashboard/collections/[id]` and verify layout remains consistent

