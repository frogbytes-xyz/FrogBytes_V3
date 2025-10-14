# Vote Persistence Fix Documentation

## Problem
Users could upvote documents in the library, but after refreshing the page, the upvote would disappear. The vote count (reputation_score) would reset to 0.

## Root Cause
The voting system had a critical flaw:
- **Votes WERE being saved** to the `votes` table correctly ✅
- **BUT** the `reputation_score` column in the `summaries` table was **NOT being updated** ❌

### Technical Details
The frontend `handleVote()` function in `app/library/page.tsx`:
1. Correctly saved votes to the `votes` table
2. Updated the local React state with the new score
3. **But never updated the `reputation_score` in the `summaries` table**

When the page refreshed:
- The frontend loaded summaries from the database
- The `reputation_score` was still 0 (never updated)
- User votes were correctly loaded from `votes` table
- But the displayed score was wrong

## Solution
Created a database trigger that automatically updates `reputation_score` in the `summaries` table whenever votes are inserted, updated, or deleted.

### Migration Applied
**File**: `supabase/migrations/20250112000000_add_vote_trigger.sql`

**What it does**:
1. Creates a function `update_summary_reputation_score()` that recalculates the reputation score by summing all votes for a summary
2. Creates three triggers on the `votes` table:
   - `vote_insert_update_reputation` - fires on INSERT
   - `vote_update_update_reputation` - fires on UPDATE
   - `vote_delete_update_reputation` - fires on DELETE
3. Each trigger automatically updates the `reputation_score` in the `summaries` table

### Code Example
```sql
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

## Implementation Steps
1. ✅ Investigated the issue using database queries
2. ✅ Created trigger migration file
3. ✅ Applied migration using Supabase Management API
4. ✅ Synced existing votes to fix mismatched scores (6 summaries)
5. ✅ Tested trigger functionality (insert/update/delete)
6. ✅ Verified frontend already loads user votes correctly
7. ✅ Tested full user flow with page refresh

## Testing Results
All tests passed:
- ✅ Vote saved to database
- ✅ Reputation score updates automatically via trigger
- ✅ Vote persists after page refresh
- ✅ Score persists after page refresh

## Frontend Code
The frontend in `app/library/page.tsx` already correctly:
1. Loads summaries with `reputation_score` (lines 94-95)
2. Fetches user votes from `votes` table (lines 135-139)
3. Maps votes to summaries (lines 141-149)
4. Displays both score and vote state

No frontend changes were required! The trigger ensures the database stays consistent.

## Database Schema

### votes table
```sql
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  summary_id UUID NOT NULL REFERENCES public.summaries(id),
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, summary_id)
);
```

### summaries table (relevant column)
```sql
ALTER TABLE public.summaries
ADD COLUMN reputation_score INTEGER DEFAULT 0 NOT NULL;
```

## Benefits of This Solution
1. **Automatic**: No manual score updates needed in application code
2. **Consistent**: Database always reflects accurate vote counts
3. **Reliable**: Works regardless of how votes are modified (frontend, API, admin panel, etc.)
4. **Efficient**: Trigger only updates the affected summary, not all summaries
5. **Maintainable**: Business logic lives in one place (database)

## Files Modified
- `supabase/migrations/20250112000000_add_vote_trigger.sql` (created)
- No application code changes required

## Related Files
- `app/library/page.tsx` - Frontend voting logic (lines 194-253)
- `supabase/migrations/20250106000000_create_votes_table.sql` - Original votes table
- `supabase/migrations/20250110000000_add_library_fields.sql` - Added reputation_score column

## Future Considerations
- The trigger recalculates by summing all votes each time. For high-volume systems, consider optimizing with incremental updates (+1, -1 instead of SUM)
- Consider adding a materialized view for vote aggregations if performance becomes an issue
- Could add additional triggers to track vote history or audit changes

## Date Fixed
October 11, 2025

