# Database Trigger Setup Guide

## What is the Trigger?

The database trigger automatically creates a `user_profiles` entry whenever a new user signs up in `auth.users`. This ensures every user has a profile without requiring manual creation in the application code.

## How It Works

```
User Signs Up → auth.users INSERT → Trigger Fires → user_profiles INSERT
```

**Trigger Function:** `handle_new_user()`
- Runs automatically after a new user is inserted into `auth.users`
- Extracts user data from `raw_user_meta_data`
- Creates a profile in `user_profiles` with `is_approved = false`
- Handles duplicate entries gracefully

## Setup Instructions

### Option 1: Run the Standalone Script

1. Open Supabase SQL Editor
2. Copy and paste the contents of `supabase/create-profile-trigger.sql`
3. Click **Run** or press `Ctrl+Enter`
4. Verify the trigger was created (queries included in the script)

### Option 2: Run the Full Migration

1. Open Supabase SQL Editor
2. Copy and paste the contents of `supabase/migrations/add-admin-approval-system.sql`
3. Click **Run** or press `Ctrl+Enter`
4. This includes the trigger plus all other admin approval features

## Verification

After running the script, verify the trigger exists:

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';
```

## Testing the Trigger

1. **Register a new user** through your app
2. **Check if profile was created:**
   ```sql
   SELECT * FROM public.user_profiles 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
3. **Verify the data:**
   - `id` matches the user's UUID from `auth.users`
   - `email` is populated
   - `full_name` is populated (if provided during signup)
   - `phone_number` is populated (if provided during signup)
   - `is_approved` is `false`

## What Data Gets Copied?

The trigger extracts data from the new user record:

| Source | Destination |
|--------|-------------|
| `auth.users.id` | `user_profiles.id` |
| `auth.users.email` | `user_profiles.email` |
| `auth.users.raw_user_meta_data->>'full_name'` | `user_profiles.full_name` |
| `auth.users.raw_user_meta_data->>'phone_number'` | `user_profiles.phone_number` |
| `false` (hardcoded) | `user_profiles.is_approved` |

## Handling Existing Users

If you have users who signed up before the trigger was created, run this to create their profiles:

```sql
INSERT INTO public.user_profiles (id, full_name, email, phone_number, is_approved, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  au.email,
  COALESCE(au.raw_user_meta_data->>'phone_number', ''),
  false,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
```

## Troubleshooting

### Trigger Not Firing

**Check if trigger exists:**
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

**If not found, recreate it:**
```sql
-- Run the create-profile-trigger.sql script again
```

### Profile Not Created

**Check for errors in Supabase logs:**
1. Go to Supabase Dashboard
2. Navigate to **Database** → **Logs**
3. Look for errors related to `handle_new_user`

**Common issues:**
- RLS policies blocking the insert
- Missing columns in `user_profiles` table
- Trigger function has syntax errors

### Duplicate Key Error

If you see "duplicate key value violates unique constraint":
- The profile already exists
- The trigger has an exception handler to ignore this
- No action needed

### Missing Data in Profile

If `full_name` or `phone_number` is empty:
- Check that your signup form is passing this data
- Verify it's being stored in `raw_user_meta_data`
- Check the auth form code in `components/auth-form.tsx`

## Removing the Trigger

If you need to remove the trigger:

```sql
-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();
```

## Benefits of Using a Trigger

✅ **Automatic** - No manual profile creation needed
✅ **Reliable** - Runs at the database level, can't be bypassed
✅ **Consistent** - Every user gets a profile
✅ **Atomic** - Profile creation is part of the signup transaction
✅ **Maintainable** - Logic is in one place (database)

## Alternative: Application-Level Creation

If you prefer to create profiles in your application code instead:

1. Remove the trigger (see above)
2. Keep the profile creation code in `components/auth-form.tsx`
3. Handle errors and edge cases in your application

The trigger approach is recommended for reliability and consistency.

## Next Steps

After setting up the trigger:

1. ✅ Test user registration
2. ✅ Verify profiles are created automatically
3. ✅ Create profiles for existing users (if needed)
4. ✅ Set up your first admin user
5. ✅ Test the admin approval workflow

See [QUICK_START.md](./QUICK_START.md) for the complete setup guide.
