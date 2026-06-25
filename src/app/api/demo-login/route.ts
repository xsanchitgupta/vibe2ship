import { createServiceClient } from '@/lib/supabase/server';
import { supabaseEnabled } from '@/lib/config';

export const dynamic = 'force-dynamic';

// One-click demo: mints a fresh OTP for the fixed demo-authority account so judges
// can try the Authority Console without a real inbox. Restricted to this account.
const DEMO_EMAIL = 'authority@demo.com';

export async function POST() {
  if (!supabaseEnabled()) return Response.json({ error: 'Unavailable' }, { status: 400 });
  const admin = createServiceClient();
  if (!admin) return Response.json({ error: 'Unavailable' }, { status: 400 });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEMO_EMAIL,
  });
  const otp = data?.properties?.email_otp;
  if (error || !otp) {
    return Response.json({ error: error?.message ?? 'Could not start demo session' }, { status: 500 });
  }
  return Response.json({ email: DEMO_EMAIL, otp });
}
