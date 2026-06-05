"use client";

import { useRef, useState } from 'react';
import { createEventId, createLinkedBasketId, enqueue, markSynced, getQueue } from '@/lib/offlineQueue';

type ShotContext = {
  linked_basket_id: string;
  player: string;
  points: 1 | 2 | 3;
  made: boolean;
  assist?: string;
  foul?: string;
  tags: string[];
};

type CourtMarker = {
  id: string;
  x: number;
  y: number;
  label: string;
  made: boolean;
  kind: 'shot' | 'foul';
};

type CourtTab = 'court' | 'shots' | 'fouls' | 'heat';

export default function OperatorPage() {
  const [homeScore, setHomeScore] = useState(52);
  const [awayScore] = useState(47);
  const [seconds, setSeconds] = useState(204);
  const [timer, setTimer] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('#7 Burak');
  const [feed, setFeed] = useState<string[]>([
    '03:40 #7 Burak 2PM AB',
    '03:58 #4 Ahmet AST',
    '04:10 #8 Kerem DREB'
  ]);
  const [shotModal, setShotModal] = useState<ShotContext | null>(null);
  const [pendingShot, setPendingShot] = useState<ShotContext | null>(null);
  const [pendingFoul, setPendingFoul] = useState<string | null>(null);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [onCourt, setOnCourt] = useState(['#7 Burak', '#4 Ahmet', '#5 Mehmet', '#6 Ali', '#8 Kerem']);
  const [bench, setBench] = useState(['#9 Ege', '#10 Okan', '#11 Mert', '#12 Can', '#13 Tuna', '#14 Emir', '#15 Arda']);
  const [courtTab, setCourtTab] = useState<CourtTab>('court');
  const clickTimer = useRef<any>(null);
  const clickPoints = useRef<1 | 2 | 3 | null>(null);
  const [markers, setMarkers] = useState<CourtMarker[]>([
    { id: 'm1', x: 24, y: 30, label: '2P✓', made: true, kind: 'shot' },
    { id: 'm2', x: 36, y: 39, label: '3P×', made: false, kind: 'shot' },
    { id: 'm3', x: 51, y: 52, label: 'PF', made: false, kind: 'foul' },
    { id: 'm4', x: 70, y: 44, label: '2P✓', made: true, kind: 'shot' }
  ]);

  function fmt(s: number) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function log(text: string) {
    setFeed(prev => [text, ...prev].slice(0, 30));
  }

  function startClock() {
    if (timer) return;
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    setTimer(t);
  }

  function stopClock() {
    clearInterval(timer);
    setTimer(null);
  }

  function getDemoPlayerId(player: string) {
    const match = player.match(/#(\d+)/);
    if (!match) return null;
    const jersey = Number(match[1]);
    const map: Record<number, number> = { 7: 1, 4: 2, 5: 3, 6: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12 };
    return map[jersey] || null;
  }

  function addQueue(type: string, player: string, payload: Record<string, any> = {}) {
    const event = {
      event_id: createEventId(),
      type,
      player,
      status: online ? 'ready' as const : 'queued' as const,
      payload
    };

    enqueue(event);

    // Online modda olayları Supabase'e yazan Next.js API route'una gönderir.
    // Demo sabitleri 003_demo_match_data.sql ile oluşturulan test maçına bağlıdır.
    if (online) {
      fetch('/api/match-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_event_id: event.event_id,
          event_type: type,
          match_id: 1,
          team_id: 1,
          player_id: getDemoPlayerId(player),
          quarter: 4,
          game_clock: fmt(seconds),
          operator_side: 'HOME_OPERATOR',
          sync_source: 'OPERATOR_WEB',
          client_created_at: new Date().toISOString(),
          linked_basket_id: payload.linked_basket_id,
          event_tags: payload.tags?.join?.('-') || payload.event_tags,
          notes: JSON.stringify({ player_label: player, ...payload })
        })
      })
        .then(async res => {
          if (!res.ok) {
            const text = await res.text();
            console.error('NONSTOP Supabase kayıt hatası:', text);
            log(`SİSTEM: Supabase kayıt hatası (${type})`);
          }
        })
        .catch(err => {
          console.error('NONSTOP API bağlantı hatası:', err);
          log(`SİSTEM: API bağlantı hatası (${type})`);
        });
    }
  }

  async function syncNow() {
    markSynced();
    log('SİSTEM: offline kuyruk senkronize edildi');
  }

  function toggleOnline() {
    const next = !online;
    setOnline(next);
    if (next) syncNow();
  }

  function eventOnly(type: string) {
    addQueue(type, selectedPlayer);
    log(`${fmt(seconds)} ${selectedPlayer} ${type}`);
  }

  function startShot(points: 1 | 2 | 3, made: boolean) {
    const ctx: ShotContext = {
      linked_basket_id: createLinkedBasketId(),
      player: selectedPlayer,
      points,
      made,
      assist: points === 1 ? 'YOK' : 'PENDING',
      foul: points === 1 ? 'YOK' : 'PENDING',
      tags: []
    };

    if (made) setHomeScore(s => s + points);

    if (points === 1) {
      saveShot(ctx, { x: 15, y: 50 });
      setMarkers(prev => [{ id: createEventId(), x: 15, y: 50, label: made ? 'FT✓' : 'FT×', made, kind: 'shot' }, ...prev]);
      return;
    }

    if (made) setShotModal(ctx);
    else setPendingShot(ctx);
  }

  function handleStatClick(points: 1 | 2 | 3) {
    // Tek tık: 1 saniye bekler, ikinci tık gelmezse isabetsiz atış.
    // Aynı butona ikinci tık 1 saniye içinde gelirse sayı olarak kaydeder.
    if (clickTimer.current && clickPoints.current === points) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      clickPoints.current = null;
      startShot(points, true);
      return;
    }

    if (clickTimer.current && clickPoints.current !== points) {
      clearTimeout(clickTimer.current);
      const previousPoints = clickPoints.current;
      clickTimer.current = null;
      clickPoints.current = null;
      if (previousPoints) startShot(previousPoints, false);
    }

    clickPoints.current = points;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      clickPoints.current = null;
      startShot(points, false);
    }, 1000);
  }

  function setAssist(player: string | null) {
    setShotModal(m => {
      if (!m) return m;
      const tags = player ? Array.from(new Set([...m.tags, 'AB'])) : m.tags.filter(t => t !== 'AB');
      return { ...m, assist: player || 'YOK', tags };
    });
  }

  function setFoul(player: string | null) {
    setShotModal(m => {
      if (!m) return m;
      const tags = player ? Array.from(new Set([...m.tags, 'FA'])) : m.tags.filter(t => t !== 'FA');
      return { ...m, foul: player || 'YOK', tags };
    });
  }

  function saveShot(context: ShotContext, shot?: { x: number; y: number }) {
    const isFreeThrow = context.points === 1;
    const type = isFreeThrow
      ? (context.made ? 'FTM' : 'FTA_MISS')
      : `${context.points}P${context.made ? 'M' : 'A_MISS'}`;
    const tag = context.tags.length ? context.tags.join('-') : (context.made ? 'SAYI' : 'İSABETSİZ');

    addQueue(type, context.player, { ...context, linked_basket_id: context.linked_basket_id, shot_x: shot?.x, shot_y: shot?.y, made: context.made, tags: context.tags });

    log(`${fmt(seconds)} ${context.player} ${type} ${tag}${shot ? ` (${shot.x.toFixed(0)}%, ${shot.y.toFixed(0)}%)` : ''}`);

    if (context.made && context.assist && context.assist !== 'YOK' && context.assist !== 'PENDING') {
      addQueue('AST', context.assist, { linked_basket_id: context.linked_basket_id, assist: context.assist });
      log(`${fmt(seconds)} ${context.assist} AST`);
    }

    if (context.made && context.foul && context.foul !== 'YOK' && context.foul !== 'PENDING') {
      addQueue('FD', context.player, { linked_basket_id: context.linked_basket_id, drawn_by: context.player });
      addQueue('PF', context.foul, { linked_basket_id: context.linked_basket_id, committed_by: context.foul });
      log(`${fmt(seconds)} ${context.player} FD`);
      log(`${fmt(seconds)} ${context.foul} PF`);
    }
  }

  function saveShotWithoutLocation() {
    if (!shotModal) return;
    saveShot(shotModal);
    setShotModal(null);
  }

  function startShotPick() {
    if (!shotModal) return;
    setPendingShot(shotModal);
    setShotModal(null);
  }

  function startFoulPick(type: string) {
    setPendingShot(null);
    setPendingFoul(type);
    setCourtTab('fouls');
  }

  function handleCourtClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (pendingFoul) {
      const type = pendingFoul;
      setMarkers(prev => [{ id: createEventId(), x, y, label: type, made: false, kind: 'foul' }, ...prev]);
      addQueue(type, selectedPlayer, { foul_x: x, foul_y: y });
      log(`${fmt(seconds)} ${selectedPlayer} ${type} (${x.toFixed(0)}%, ${y.toFixed(0)}%)`);
      setPendingFoul(null);
      return;
    }

    if (!pendingShot) return;
    const label = pendingShot.points === 1 ? (pendingShot.made ? 'FT✓' : 'FT×') : `${pendingShot.points}P${pendingShot.made ? '✓' : '×'}`;
    setMarkers(prev => [{ id: createEventId(), x, y, label, made: pendingShot.made, kind: 'shot' }, ...prev]);
    saveShot(pendingShot, { x, y });
    setPendingShot(null);
  }

  function saveSub(playerIn: string) {
    if (!subOut) return;

    const playerOut = subOut;
    if (playerIn === playerOut) return;

    // Oyuncu değişikliği sadece olay kaydı değil, ekrandaki kadroyu da günceller.
    // Çıkan oyuncu sahadan yedeklere, giren oyuncu yedekten sahaya taşınır.
    setOnCourt(prev => {
      const replaced = prev.map(p => p === playerOut ? playerIn : p);
      return Array.from(new Set(replaced)).slice(0, 5);
    });

    setBench(prev => {
      const withoutIncoming = prev.filter(p => p !== playerIn && p !== playerOut);
      return [...withoutIncoming, playerOut];
    });

    setSelectedPlayer(playerIn);
    addQueue('SUBSTITUTION', playerIn, { player_out: playerOut, player_in: playerIn });
    log(`${fmt(seconds)} DEĞİŞİKLİK: ${playerOut} OUT / ${playerIn} IN`);
    setSubOut(null);
  }

  const visibleMarkers = markers.filter(m => courtTab === 'court' || courtTab === 'heat' || (courtTab === 'shots' && m.kind === 'shot') || (courtTab === 'fouls' && m.kind === 'foul'));

  return (
    <div className="operator-page">
      <header className="score-header">
        <div className="team-score">
          <div><span>EV SAHİBİ</span><h1>TOFAŞ U14</h1></div>
          <b>{homeScore}</b>
        </div>
        <div className="clock-box">
          <span>4. ÇEYREK</span>
          <strong>{fmt(seconds)}</strong>
          <div className="clock-buttons"><button onClick={startClock}>▶</button><button onClick={stopClock}>⏸</button></div>
          <small>{online ? 'ONLINE' : 'OFFLINE'} / Queue: {typeof window !== 'undefined' ? getQueue().filter(e => e.status !== 'synced').length : 0}</small>
          <button onClick={toggleOnline}>{online ? 'Offline Yap' : 'Online Yap'}</button>
        </div>
        <div className="team-score away">
          <div><span>MİSAFİR</span><h1>GEMLİK U14</h1></div>
          <b>{awayScore}</b>
        </div>
      </header>

      <section className="stat-footer">
        <div className="stat-context"><span>İstatistik Girişi</span><b>{selectedPlayer}</b><small>Tek tık: 1 sn bekler, isabetsiz atış • Çift tık: sayı • +1: faul çizgisi</small></div>
        <div className="stat-buttons">
          <button className="shot-btn" onClick={() => handleStatClick(1)}>+1</button>
          <button className="shot-btn" onClick={() => handleStatClick(2)}>+2</button>
          <button className="shot-btn" onClick={() => handleStatClick(3)}>+3</button>
          <button onClick={() => eventOnly('OREB')}>Rib. H</button>
          <button onClick={() => eventOnly('DREB')}>Rib. S</button>
          <button onClick={() => eventOnly('STL')}>Top Çalma</button>
          <button onClick={() => eventOnly('TOV')}>Top Kaybı</button>
          <button onClick={() => startFoulPick('PF')}>Faul</button>
          <button onClick={() => startFoulPick('FD')}>Faul Aldı</button>
          <button onClick={() => eventOnly('BLK')}>Blok</button>
          <button onClick={() => eventOnly('BY')}>Blok Yedi</button>
        </div>
      </section>

      <main className="operator-layout">
        <section className="court-area">
          <div className="court-toolbar">
            <button className={courtTab === 'court' ? 'active' : ''} onClick={() => setCourtTab('court')}>Saha</button>
            <button className={courtTab === 'shots' ? 'active' : ''} onClick={() => setCourtTab('shots')}>Şutlar</button>
            <button className={courtTab === 'fouls' ? 'active' : ''} onClick={() => setCourtTab('fouls')}>Fauller</button>
            <button className={courtTab === 'heat' ? 'active' : ''} onClick={() => setCourtTab('heat')}>Heat Map</button>
          </div>

          {(pendingShot || pendingFoul) && (
            <div className="shot-pick-banner">
              {pendingShot ? <><b>{pendingShot.player}</b> {pendingShot.made ? 'sayı' : 'isabetsiz atış'} için sahada yeri tıkla.</> : <><b>{selectedPlayer}</b> {pendingFoul} için faul yerini tıkla.</>}
              <button onClick={() => { setPendingShot(null); setPendingFoul(null); }}>Vazgeç</button>
            </div>
          )}

          <div className={`court ${pendingShot || pendingFoul ? 'picking-shot' : ''} ${courtTab === 'heat' ? 'heat-mode' : ''}`} onClick={handleCourtClick}>
            <div className="half-line" /><div className="center-circle" />
            <div className="paint left" /><div className="paint right" />
            <div className="rim left" /><div className="rim right" />
            <div className="arc left" /><div className="arc right" />
            {visibleMarkers.map(m => <div key={m.id} className={`marker ${m.kind} ${m.made ? 'made' : 'miss'}`} style={{ left: `${m.x}%`, top: `${m.y}%` }}>{courtTab === 'heat' ? '' : m.label}</div>)}
          </div>
        </section>

        <aside className="roster-panel">
          <div className="panel-title"><div><h2>TOFAŞ U14</h2><span>Sadece kontrol edilen takım</span></div></div>
          <div className="roster-block">
            <h3>Sahadakiler</h3>
            {onCourt.map(p => <div key={p} className={`player-row ${selectedPlayer === p ? 'selected' : ''}`} onClick={() => setSelectedPlayer(p)}><div><b>{p}</b><small>Oyunda</small></div><button onClick={(e) => { e.stopPropagation(); setSubOut(p); }}>Değiş</button></div>)}
          </div>
          <div className="roster-block bench">
            <h3>Yedekler</h3>
            <div className="bench-grid">{bench.map(p => <button key={p} onClick={() => setSelectedPlayer(p)}>{p}</button>)}</div>
          </div>
          <div className="selected-player-card"><span>Seçili Oyuncu</span><strong>{selectedPlayer}</strong><small>Bu oyuncuya istatistik işlenecek</small></div>
        </aside>
      </main>

      <section className="event-feed bottom-feed">
        <h3>Son Olaylar</h3>
        <ul>{feed.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </section>

      {shotModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{shotModal.player} {shotModal.points} Sayı</h2>
            <p>Çift tık sayı olarak kaydedildi. Asist / faul seç, sonra şut yerini sahadan işaretle.</p>
            <div className="decision-grid">
              <div className="decision-card"><h3>Asist?</h3>{onCourt.filter(p => p !== shotModal.player).map(p => <button key={p} onClick={() => setAssist(p)}>{p}</button>)}<button className="none" onClick={() => setAssist(null)}>YOK</button><p>Durum: {shotModal.assist}</p></div>
              <div className="decision-card"><h3>Faul?</h3><button onClick={() => setFoul('#12 Rakip')}>#12 Rakip PF</button><button onClick={() => setFoul('#15 Rakip')}>#15 Rakip PF</button><button className="none" onClick={() => setFoul(null)}>YOK</button><p>Durum: {shotModal.foul}</p></div>
            </div>
            <div className="modal-actions"><button className="primary" onClick={startShotPick}>Şut Yerini Seç</button><button onClick={saveShotWithoutLocation}>Konumsuz Kaydet</button><button onClick={() => setShotModal(null)}>İptal</button></div>
          </div>
        </div>
      )}

      {subOut && (
        <div className="modal-backdrop">
          <div className="modal small">
            <h2>Oyuncu Değişikliği</h2>
            <p>Çıkan oyuncu: <b>{subOut}</b></p>
            <h3>Oyuna Girecek Oyuncu</h3>
            <div className="bench-grid">{bench.map(p => <button key={p} className="sub-in-btn" onClick={() => saveSub(p)}>→ {p} Oyuna Gir</button>)}</div>
            <br /><button onClick={() => setSubOut(null)}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
