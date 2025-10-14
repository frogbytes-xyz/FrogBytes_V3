# Voting System Improvements

## Overview
This document outlines the improvements made to the document voting system to prevent spam, ensure fair voting behavior, and provide clear visual feedback.

## Implemented Features

### 1. Anti-Spam Protection

#### Debouncing
- **Location**: `lib/hooks/useVoting.ts`
- **Implementation**: Vote actions are debounced with a configurable delay (default: 500ms)
- **Benefit**: Prevents rapid clicking from generating multiple API calls
- **How it works**: When a user clicks a vote button, the system waits 500ms before executing the actual vote. If the user clicks again within this window, the previous request is canceled and replaced with the new one.

#### Vote State Management
- **Location**: `lib/hooks/useVoting.ts`
- **Implementation**: Tracks voting state per document to prevent concurrent vote requests
- **Benefit**: Prevents race conditions from multiple simultaneous votes on the same document
- **UI Feedback**: Vote buttons are disabled while a vote is in progress

#### Database Constraint
- **Location**: `supabase/migrations/20250106000000_create_votes_table.sql` (line 13)
- **Implementation**: `UNIQUE(user_id, summary_id)` constraint on votes table
- **Benefit**: Database-level enforcement ensures only one vote per user per document
- **Behavior**: Attempting to insert duplicate votes will fail; use `upsert` to update existing votes

### 2. One Vote Per User Per Document

#### Database Schema
```sql
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, summary_id)  -- Enforces one vote per user per document
);
```

#### Vote Logic
- **Location**: `lib/hooks/useVoting.ts` (handleVote function)
- **Behavior**:
  - **Same vote clicked**: Removes the vote (toggles off)
  - **Different vote clicked**: Changes the vote (from upvote to downvote or vice versa)
  - **New vote**: Adds the vote

#### Automatic Score Updates
- **Location**: `supabase/migrations/20250112000000_add_vote_trigger.sql`
- **Implementation**: Database triggers automatically update `reputation_score` when votes are added, updated, or deleted
- **Benefit**: Ensures consistency between votes table and summaries table without manual updates

### 3. Minimum Vote Count (Score ≥ 0)

#### Database Constraint
- **Location**: `supabase/migrations/20250123000000_add_reputation_check_constraint.sql`
- **Implementation**:
  ```sql
  ALTER TABLE public.summaries
  ADD CONSTRAINT summaries_reputation_score_check
  CHECK (reputation_score >= 0);
  ```
- **Benefit**: Database-level enforcement prevents negative reputation scores

#### Updated Trigger Function
- The trigger function now uses `GREATEST(0, SUM(vote))` to ensure scores never go below 0
- Existing records with negative scores are automatically updated to 0 during migration

#### Client-side Protection
- **Location**: `lib/hooks/useVoting.ts` (line 68)
- **Implementation**: `optimisticScore = Math.max(0, optimisticScore)`
- **Benefit**: Prevents displaying negative scores in the UI even before database confirmation

### 4. Visual Feedback (UI Colors)

#### Upvote Styling
- **Active State**: Green color (text-green-600, bg-green-100)
- **Hover State**: Green tint on hover
- **Scale Effect**: 110% scale when active
- **Dark Mode**: Adjusted colors (text-green-400, bg-green-950)

#### Downvote Styling
- **Active State**: Red color (text-red-600, bg-red-100)
- **Hover State**: Red tint on hover
- **Scale Effect**: 110% scale when active
- **Dark Mode**: Adjusted colors (text-red-400, bg-red-950)

#### Updated Components
1. **Library Page** (`app/library/page.tsx`)
   - Grid view voting buttons (lines 543-574)
   - List view voting buttons (lines 594-622)

2. **For You Section** (`components/ForYouSection.tsx`)
   - Recommendation voting buttons (lines 374-402)
   - Now fetches and displays user's current vote state (lines 166-187)

### 5. Optimistic UI Updates

#### Implementation
- **Location**: `lib/hooks/useVoting.ts`
- **How it works**:
  1. User clicks vote button
  2. UI immediately updates (optimistic update)
  3. Vote request is debounced and sent to server
  4. If request fails, UI rolls back to previous state
  5. If request succeeds, UI remains in updated state

#### Benefits
- Instant feedback for users
- Reduces perceived latency
- Graceful error handling with automatic rollback

### 6. Vote Caching

#### Implementation
- **Location**: `lib/hooks/useVoting.ts` (voteCache ref)
- **Purpose**: Stores recent vote states in memory
- **Benefit**: Reduces redundant API calls for recently voted documents
- **Usage**: Can be queried via `getCachedVote(summaryId)` method

## File Changes Summary

### New Files
1. **`lib/hooks/useVoting.ts`**
   - Reusable React hook for voting functionality
   - Includes debouncing, spam protection, and optimistic updates
   - ~160 lines

2. **`supabase/migrations/20250123000000_add_reputation_check_constraint.sql`**
   - Database migration for minimum score constraint
   - Updates trigger function to enforce score >= 0
   - ~35 lines

3. **`docs/VOTING_SYSTEM_IMPROVEMENTS.md`**
   - This documentation file

### Modified Files
1. **`app/library/page.tsx`**
   - Integrated useVoting hook
   - Updated vote button colors (green for upvote, red for downvote)
   - Added disabled state during voting
   - Cleanup of pending votes on unmount

2. **`components/ForYouSection.tsx`**
   - Updated vote button colors to match library page
   - Added user vote state fetching and display
   - Proper visual feedback for current vote state

## Testing Guide

### 1. Test Anti-Spam Protection

#### Rapid Clicking Test
1. Open the library page
2. Sign in as a user
3. Rapidly click the upvote button multiple times (10-20 clicks in quick succession)
4. **Expected**: Only one vote is registered, score increases by 1
5. Check browser network tab: Should see only 1-2 API calls (not 10-20)

#### Concurrent Votes Test
1. Open two browser tabs with the same document
2. Try voting from both tabs simultaneously
3. **Expected**: Only one vote is registered per user
4. Database constraint should prevent duplicate entries

### 2. Test One Vote Per User

#### Toggle Vote Test
1. Click upvote button
2. **Expected**: Arrow turns green, score increases by 1
3. Click upvote button again
4. **Expected**: Arrow returns to default color, score decreases by 1 (vote removed)

#### Change Vote Test
1. Click upvote button
2. **Expected**: Score increases by 1, up arrow turns green
3. Click downvote button
4. **Expected**: Score decreases by 2 (removing +1, adding -1), down arrow turns red, up arrow returns to default

#### Refresh Test
1. Vote on a document
2. Refresh the page
3. **Expected**: Your vote state is preserved (correct arrow is colored)

### 3. Test Minimum Score (≥ 0)

#### Boundary Test
1. Find a document with reputation_score of 0 or 1
2. Downvote it
3. **Expected**: Score goes to 0 (never negative)
4. Try downvoting again
5. **Expected**: Score remains at 0

#### Database Test
```sql
-- Attempt to manually set negative score (should fail)
UPDATE summaries SET reputation_score = -1 WHERE id = '<some-id>';
-- Expected error: new row violates check constraint "summaries_reputation_score_check"
```

### 4. Test Visual Feedback

#### Upvote Visual Test
1. Click upvote on a document
2. **Expected**:
   - Up arrow turns green (light green in light mode, dark green in dark mode)
   - Background becomes light green
   - Arrow scales up slightly (110%)
   - Score updates immediately

#### Downvote Visual Test
1. Click downvote on a document
2. **Expected**:
   - Down arrow turns red (light red in light mode, dark red in dark mode)
   - Background becomes light red
   - Arrow scales up slightly (110%)
   - Score updates immediately

#### Hover States
1. Hover over upvote button (when not voted)
2. **Expected**: Slight green tint appears
3. Hover over downvote button (when not voted)
4. **Expected**: Slight red tint appears

#### Dark Mode Test
1. Switch to dark mode (if available)
2. Vote on documents
3. **Expected**: Colors adjust appropriately for dark backgrounds
   - Green: text-green-400, bg-green-950
   - Red: text-red-400, bg-red-950

### 5. Test Optimistic Updates

#### Network Delay Test
1. Open browser DevTools → Network tab
2. Enable "Slow 3G" throttling
3. Click vote button
4. **Expected**:
   - UI updates immediately (score and color change)
   - Button becomes disabled
   - After ~500ms, request is sent
   - Button re-enables after response

#### Error Handling Test
1. Vote on a document while offline
2. **Expected**:
   - UI updates immediately
   - After debounce delay, request fails
   - UI rolls back to previous state
   - Error message may appear (implementation-dependent)

### 6. Test For You Section

#### Recommendation Vote Test
1. Navigate to library page (where For You section appears)
2. Ensure you're signed in and have uploaded documents
3. Vote on recommended documents
4. **Expected**:
   - Same visual feedback as main library
   - Green upvote, red downvote
   - Score updates immediately
   - Vote state persists on refresh

### 7. Cross-Session Test

#### Multi-Device Test
1. Sign in on Device A and vote on a document
2. Open the same document on Device B with the same account
3. **Expected**: Your vote from Device A is visible on Device B
4. Try voting on Device B
5. **Expected**: Can change or remove vote, updates on both devices after refresh

### 8. Performance Test

#### Bulk Vote Test
1. Go to library page with many documents
2. Vote on 10-20 different documents in quick succession
3. **Expected**:
   - Each vote is debounced independently
   - No lag or freezing
   - All votes are eventually registered
   - Network tab shows debounced requests (not immediate)

#### Page Navigation Test
1. Start voting on a document
2. Navigate away before debounce completes
3. **Expected**: Pending vote is cleaned up (no memory leaks)
4. No error messages in console

## Database Migration Instructions

To apply the new database constraint:

```bash
# If using Supabase CLI
supabase db reset

# Or apply the specific migration
supabase migration up --db-url <your-database-url>

# Or manually run the SQL from the migration file
psql <your-database-url> -f supabase/migrations/20250123000000_add_reputation_check_constraint.sql
```

## Rollback Instructions

If you need to rollback the changes:

### Rollback Database Constraint
```sql
-- Remove the check constraint
ALTER TABLE public.summaries
DROP CONSTRAINT IF EXISTS summaries_reputation_score_check;

-- Revert trigger function to original version
CREATE OR REPLACE FUNCTION update_summary_reputation_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.summaries
  SET reputation_score = (
    SELECT COALESCE(SUM(vote), 0)
    FROM public.votes
    WHERE summary_id = COALESCE(NEW.summary_id, OLD.summary_id)
  )
  WHERE id = COALESCE(NEW.summary_id, OLD.summary_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Rollback Code Changes
```bash
# Revert to previous commit
git revert <commit-hash>

# Or restore specific files
git checkout HEAD~1 app/library/page.tsx
git checkout HEAD~1 components/ForYouSection.tsx
# Delete the new hook
rm lib/hooks/useVoting.ts
```

## Future Enhancements

Potential improvements for future iterations:

1. **Rate Limiting**: Server-side rate limiting to prevent vote spam across sessions
2. **Vote Analytics**: Track voting patterns to detect abuse
3. **Reputation System**: User reputation based on quality of their votes
4. **Vote History**: Allow users to view their voting history
5. **Vote Notifications**: Notify document authors when their content is upvoted
6. **Vote Reasons**: Allow users to explain why they downvoted (optional)
7. **Weighted Votes**: Higher reputation users get more vote weight
8. **Vote Decay**: Older votes count less towards reputation over time

## Support

For issues or questions about the voting system:
- Check browser console for error messages
- Verify database migrations are applied
- Ensure user is authenticated before voting
- Check network tab for failed API requests
