import { NextResponse } from 'next/server';
import { getUserId, hasSupabaseAdminEnv, insertOne, jsonError } from '@/lib/apiHelpers';

const ALLOWED_EVENTS = new Set([
  '2PM','2PA_MISS','3PM','3PA_MISS','FTM','FTA_MISS',
  'AST','OREB','DREB','STL','BLK','TOV','PF','FD',
  'CHARGE_DRAWN','BLOCKED','BY','TIMEOUT','SUBSTITUTION'
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventType = body.event_type || body.type;
    if (!eventType) return jsonError('event_type required');
    if (!ALLOWED_EVENTS.has(eventType)) return jsonError(`unsupported event_type: ${eventType}`);

    const payload = {
      client_event_id: body.client_event_id || body.event_id,
      match_id: body.match_id,
      team_id: body.team_id,
      player_id: body.player_id,
      related_player_id: body.related_player_id,
      quarter: body.quarter || 1,
      game_clock: body.game_clock,
      event_type: eventType,
      event_tags: body.event_tags,
      linked_basket_id: body.linked_basket_id,
      operator_side: body.operator_side,
      sync_source: body.sync_source || 'WEB',
      client_created_at: body.client_created_at || body.created_local_at,
      created_by: getUserId(req),
      notes: body.notes
    };

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ ok: true, mode: 'demo-no-db', message: 'match event accepted', data: payload });
    }

    if (!payload.match_id || !payload.team_id || !payload.quarter) {
      return jsonError('match_id, team_id and quarter are required when Supabase is connected');
    }

    const data = await insertOne('match_events', payload);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return jsonError('match event insert failed', 500, err.message || err);
  }
}
