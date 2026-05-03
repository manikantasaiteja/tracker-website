This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Features

- **User Authentication**: Secure registration and login with Supabase Auth
- **Admin Approval System**: New users require admin approval before accessing the platform
- **Admin Portal**: Dedicated admin dashboard for managing user approvals
- **Application Tracking**: Track job applications with status updates
- **Document Management**: Upload and manage CVs and cover letters
- **Profile Management**: User profiles with phone numbers and personal information

## Admin Approval System

This application includes an admin approval workflow:

1. Users register and confirm their email
2. After registration, users see a "pending approval" page
3. Admins review and approve/reject users from the admin portal
4. Once approved, users can access the full platform

**📖 Quick Start:** See [QUICK_START.md](./QUICK_START.md) for 3-step setup guide.

**📚 Full Documentation:** See [ADMIN_SETUP.md](./ADMIN_SETUP.md) for detailed instructions.

### Quick Admin Setup

1. Run the migration: `supabase/migrations/add-admin-approval-system.sql`
2. Create an admin user:
```sql
-- Replace with your user UUID from Supabase Auth
INSERT INTO public.admins (id, email)
VALUES ('your-user-uuid', 'admin@example.com');

UPDATE public.user_profiles
SET is_approved = true, approved_at = now()
WHERE id = 'your-user-uuid';
```
3. Access admin portal at `/admin/login`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
