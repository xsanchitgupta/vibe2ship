// Central feature-flags. Every integration degrades gracefully when its keys
// aren't set, so the app always runs (in-memory + SVG map fallback).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const supabaseEnabled = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const mapsEnabled = (): boolean => Boolean(MAPS_KEY);
