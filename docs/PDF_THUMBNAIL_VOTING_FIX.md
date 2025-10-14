# PDF Thumbnail Voting Error Fix

## Problem
When upvoting a file in the library, the following error occurred:
```
can't access property "sendWithPromise", this.messageHandler is null
at PDFThumbnail (components/PDFThumbnail.tsx:301:11)
```

## Root Cause
The error was caused by a **race condition** in the PDF.js library:

1. When a user votes, the `setSummaries` function updates the state
2. This triggers a re-render of all PDF thumbnail components in the library
3. During re-render, some PDF thumbnails were in the middle of rendering their pages
4. The PDF.js worker's internal message handler became null during this transition
5. The Page component tried to call `sendWithPromise` on a null message handler

## Solution Implemented

### 1. Enhanced State Management
- Added `isUnmountingRef` to track component unmounting state
- Added `renderAttempts` counter for retry logic
- Added `documentRef` for document lifecycle tracking
- All state updates now check if component is unmounting

### 2. Improved Worker Initialization
- Increased initial delay from 150ms to 200ms to ensure worker is fully ready
- Added checks for `isUnmountingRef` before setting `pageReady`
- Clear timers properly to prevent memory leaks

### 3. Error Recovery with Retry Logic
- `onPageRenderError` now implements automatic retry (max 2 attempts)
- Each retry waits 300ms before attempting to render again
- After 2 failed attempts, shows error state instead of crashing

### 4. Component Isolation with PageWrapper
- Created `PageWrapper` component that wraps the PDF Page component
- Implements error boundary pattern with try-catch
- Prevents errors from propagating up and crashing parent components
- Shows graceful fallback on error

### 5. Performance Optimization
- Wrapped entire `PDFThumbnail` component with `React.memo`
- Prevents unnecessary re-renders when other summaries update
- Only re-renders when `pdfUrl`, `width`, `height`, or other props actually change

### 6. Lifecycle Safety
- All callbacks check `isUnmountingRef.current` before updating state
- Proper cleanup in useEffect return functions
- Timer references properly cleared on unmount

## Changes Made

### `/components/PDFThumbnail.tsx`
1. Import `memo` from React
2. Add new refs: `documentRef`, `isUnmountingRef`, and state: `renderAttempts`
3. Update cleanup logic in mount effect
4. Enhanced `onDocumentLoadSuccess` with unmount checks
5. Enhanced `onDocumentLoadError` with unmount checks
6. Completely rewrote `onPageRenderError` with retry logic
7. Created new `PageWrapper` component for error isolation
8. Wrapped main component with `React.memo`
9. Updated Page rendering to use `PageWrapper`

## Testing Recommendations

1. **Vote on multiple items rapidly** - Ensure no crashes occur
2. **Vote while PDFs are loading** - Test race condition specifically
3. **Test with slow network** - Simulate delayed PDF loads
4. **Test with invalid PDFs** - Ensure error handling works
5. **Test with Telegram URLs** - Verify they still show proper fallback

## Expected Behavior

### Before Fix
- Voting on any item would crash PDF thumbnails with message handler error
- Page would show runtime error overlay
- User experience was broken

### After Fix
- Voting on items causes no errors
- PDF thumbnails remain stable during voting
- Failed renders retry automatically
- Graceful fallbacks shown on persistent errors
- Smooth user experience maintained

## Technical Details

### Race Condition Prevention
The key insight is that PDF.js maintains internal worker state that can become invalid during React re-renders. By:
1. Memoizing the component to reduce re-renders
2. Checking unmounting state before any operations
3. Adding retry logic for transient failures
4. Isolating Page component in error boundary

We prevent the worker from being accessed in invalid states.

### Why Memoization Helps
When voting updates state, React would normally re-render all summaries and their thumbnails. With `React.memo`, only thumbnails whose props actually changed will re-render, dramatically reducing the chance of hitting the race condition.

### Why Retry Logic Helps
Even with all protections, PDF.js worker can occasionally have transient issues. The retry logic with exponential backoff (200ms initial, 300ms retry) gives the worker time to stabilize before giving up.

## Performance Impact

- **Positive**: Reduced unnecessary re-renders saves CPU and memory
- **Positive**: Fewer PDF reloads means faster user experience
- **Negligible**: Additional refs and checks have minimal overhead
- **Positive**: Error recovery prevents full page crashes

## Maintenance Notes

- The 200ms/300ms delays are tuned for typical network conditions
- May need adjustment for very slow connections
- Max retry count of 2 is a balance between persistence and performance
- Monitor console logs for "PDF page render error" to track retry frequency

