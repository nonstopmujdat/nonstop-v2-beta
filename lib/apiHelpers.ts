import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function getUserId(req: Request) {
  return req.headers.get('x-nonstop-user-id') || null;
}

export async function insertOne(table: string, payload: Record<string, any>) {
  const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}
