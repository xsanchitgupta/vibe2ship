import { getUserId } from '@/lib/auth';
import { getMyActivity } from '@/lib/repo';
import { supabaseEnabled } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseEnabled()) return Response.json({ items: [] });
  const uid = await getUserId();
  if (!uid) return Response.json({ items: [] });
  return Response.json({ items: await getMyActivity(uid) });
}
