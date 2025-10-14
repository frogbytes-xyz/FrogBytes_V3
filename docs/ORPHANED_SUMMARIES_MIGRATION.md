# Orphaned Public Summaries Migration

## Overview
This migration enables users to discard published documents from their dashboard while keeping them available in the public library. This is achieved by making summaries "orphaned" (no owner).

## Migration Details

**File**: `supabase/migrations/20250126000000_allow_orphaned_public_summaries.sql`  
**Date Applied**: October 11, 2025  
**Status**: ✅ Applied Successfully

---

## Changes Made

### 1. Made `user_id` Nullable
Allows summaries to exist without an owner:

```sql
ALTER TABLE public.summaries
ALTER COLUMN user_id DROP NOT NULL;
```

**Before**: `user_id UUID NOT NULL`  
**After**: `user_id UUID` (nullable)

### 2. Updated RLS Policy
Updated the viewing policy to allow access to orphaned public summaries:

```sql
DROP POLICY IF EXISTS "Users can view their own summaries" ON public.summaries;

CREATE POLICY "Users can view their own summaries or orphaned public ones"
  ON public.summaries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_public = true)
  );
```

**Policy Logic**:
- Users can view summaries they own (`auth.uid() = user_id`)
- Everyone can view orphaned public summaries (`user_id IS NULL AND is_public = true`)

### 3. Added Delete Policy
Enables users to delete their own summaries:

```sql
CREATE POLICY "Users can delete their own summaries"
  ON public.summaries
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 4. Added Performance Index
Created an index for efficient querying of orphaned public summaries:

```sql
CREATE INDEX IF NOT EXISTS summaries_orphaned_public_idx 
  ON public.summaries(is_public) 
  WHERE user_id IS NULL AND is_public = true;
```

### 5. Added Documentation
Added a comment explaining the nullable `user_id`:

```sql
COMMENT ON COLUMN public.summaries.user_id IS 
  'User who created the summary. NULL for orphaned published documents that were discarded by their creator.';
```

---

## Use Cases

### User Workflow

1. **User publishes a document**
   - `user_id` = creator's ID
   - `is_public` = true
   - Document appears in their dashboard AND public library

2. **User wants to clean up their dashboard**
   - They can "discard" the document
   - Backend sets `user_id` = NULL
   - Document is removed from their dashboard
   - Document remains in public library (orphaned)

3. **Orphaned documents remain accessible**
   - Anyone can view them in the public library
   - They have no owner (user_id = NULL)
   - They continue to receive votes and engagement

### Benefits

- **User Control**: Users can manage their dashboard without losing public contributions
- **Data Preservation**: Community benefits from keeping quality content public
- **Clean Dashboards**: Users aren't forced to keep old documents visible
- **No Broken Links**: Public library links continue to work

---

## Database State After Migration

### Summary Types

| Type | user_id | is_public | Who Can View | Where Visible |
|------|---------|-----------|--------------|---------------|
| **Private** | user-123 | false | Owner only | Owner's dashboard |
| **Published** | user-123 | true | Everyone | Dashboard + Library |
| **Orphaned** | NULL | true | Everyone | Library only |

### Query Examples

**Find all orphaned summaries**:
```sql
SELECT * FROM summaries 
WHERE user_id IS NULL 
AND is_public = true;
```

**Count orphaned vs owned public summaries**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE user_id IS NULL) as orphaned_count,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as owned_count
FROM summaries 
WHERE is_public = true;
```

---

## Application Impact

### Frontend Changes Needed

To support discarding documents, you'll need to:

1. **Add "Discard" button to dashboard**
   ```typescript
   async function discardSummary(summaryId: string) {
     await supabase
       .from('summaries')
       .update({ user_id: null })
       .eq('id', summaryId)
       .eq('user_id', currentUser.id); // Ensure user owns it
   }
   ```

2. **Update dashboard queries**
   ```typescript
   // Only show summaries user owns
   const { data } = await supabase
     .from('summaries')
     .select('*')
     .eq('user_id', currentUser.id); // Excludes orphaned
   ```

3. **Library queries remain unchanged**
   ```typescript
   // Shows all public summaries (owned + orphaned)
   const { data } = await supabase
     .from('summaries')
     .select('*')
     .eq('is_public', true);
   ```

---

## Security Considerations

### RLS Policies Ensure

1. ✅ **Users can only delete their own summaries**
   - Cannot delete orphaned summaries
   - Cannot delete other users' summaries

2. ✅ **Orphaned summaries are read-only**
   - No user_id = no UPDATE permission
   - Prevents modification of abandoned content

3. ✅ **Public visibility is maintained**
   - Orphaned summaries remain in public library
   - RLS policy explicitly allows viewing them

### Edge Cases Handled

- **What if a user is deleted?**: Their summaries should be orphaned first (via CASCADE or trigger)
- **Can orphaned summaries receive votes?**: Yes, voting system uses summary_id only
- **Can orphaned summaries be claimed?**: No, by design (would need additional feature)

---

## Performance

### Index Benefits

The `summaries_orphaned_public_idx` index optimizes:
- Queries filtering for orphaned summaries
- Library views that include orphaned content
- Analytics on orphaned vs owned content

### Query Performance

**Before index** (full table scan):
```sql
EXPLAIN ANALYZE SELECT * FROM summaries 
WHERE user_id IS NULL AND is_public = true;
```

**After index** (index scan):
- Uses partial index on (is_public) WHERE conditions match
- Dramatically faster for queries targeting orphaned summaries

---

## Testing

### Verification Results

✅ **All checks passed**:
- user_id is now nullable
- RLS policy allows viewing orphaned public summaries  
- Users can delete their own summaries
- Index created for efficient querying
- Can query orphaned summaries without errors

### Test Scenarios

1. ✅ Create summary with user_id = NULL
2. ✅ Query orphaned public summaries
3. ✅ User can delete their own summary
4. ✅ User cannot delete orphaned summary
5. ✅ Orphaned summaries visible in library

---

## Rollback Plan

If needed, the migration can be rolled back:

```sql
-- Remove index
DROP INDEX IF EXISTS summaries_orphaned_public_idx;

-- Remove delete policy
DROP POLICY IF EXISTS "Users can delete their own summaries" ON summaries;

-- Revert RLS policy
DROP POLICY IF EXISTS "Users can view their own summaries or orphaned public ones" ON summaries;

CREATE POLICY "Users can view their own summaries"
  ON summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Make user_id NOT NULL again (requires no NULL values exist)
ALTER TABLE summaries
ALTER COLUMN user_id SET NOT NULL;
```

⚠️ **Note**: Cannot make user_id NOT NULL if orphaned summaries exist. Would need to delete or reassign them first.

---

## Future Enhancements

### Possible Features

1. **Claim Orphaned Summaries**: Allow users to claim and adopt orphaned content
2. **Expiration**: Automatically delete very old orphaned summaries
3. **Attribution**: Keep original creator info even when orphaned
4. **Bulk Operations**: Allow users to orphan multiple summaries at once
5. **Undo**: Grace period to un-orphan recently discarded summaries

### Analytics Opportunities

- Track ratio of orphaned to owned summaries
- Monitor user engagement with orphaned content
- Identify most popular orphaned documents
- Measure cleanup patterns over time

---

## Related Documentation

- `docs/VOTE_PERSISTENCE_FIX.md` - Voting system (works with orphaned summaries)
- `docs/VOTING_SYSTEM_IMPROVEMENTS.md` - Vote improvements
- `supabase/migrations/20250110000000_add_library_fields.sql` - Library fields including is_public

---

**Migration Status**: ✅ **PRODUCTION READY**  
**Date**: October 11, 2025

The orphaned summaries feature is now fully functional and ready for application-level integration.


