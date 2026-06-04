"use client";

import { useState } from 'react';
import { createEventId, createLinkedBasketId, enqueue, markSynced, getQueue } from '@/lib/offlineQueue';

type BasketContext = {
  linked_basket_id: string;
  player: string;
  points: 2 | 3;
  assist: string;
  foul: string;
  tags: string[];
};

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
  const [basketModal, setBasketModal] = useState<BasketContext | null>(null);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  function fmt(s: number) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function log(text: string) {
    setFeed(prev => [text, ...prev]);
  }

  function startClock() {
    if (timer) return;
    const t = setInterval(() => {
      setSeconds(s => Math.max(0, s - 1));
    }, 1000);
    setTimer(t);
  }

  function stopClock() {
    clearInterval(timer);
    setTimer(null);
  }

  function addQueue(type: string, player: string, payload: Record<string, any> = {}) {
    enqueue({
      event_id: createEventId(),
      type,
      player,
      status: online ? 'ready' : 'queued',
      payload
    });
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

  function freeThrow(made: boolean) {
    if (made) setHomeScore(s => s + 1);
    const type = made ? 'FTM' : 'FTA_MISS';
    addQueue(type, selectedPlayer, { is_free_throw: true, made });
    log(`${fmt(seconds)} ${selectedPlayer} ${made ? 'FTM +1' : 'FTA_MISS'}`);
  }

  function basket(points: 2 | 3) {
    setHomeScore(s => s + points);
    setBasketModal({
      linked_basket_id: createLinkedBasketId(),
      player: selectedPlayer,
      points,
      assist: 'PENDING',
      foul: 'PENDING',
      tags: []
    });
  }

  function setAssist(player: string | null) {
    setBasketModal(m => {
      if (!m) return m;
      const tags = player ? Array.from(new Set([...m.tags, 'AB'])) : m.tags.filter(t => t !== 'AB');
      return { ...m, assist: player || 'YOK', tags };
    });
  }

  function setFoul(player: string | null) {
    setBasketModal(m => {
      if (!m) return m;
      const tags = player ? Array.from(new Set([...m.tags, 'FA'])) : m.tags.filter(t => t !== 'FA');
      return { ...m, foul: player || 'YOK', tags };
    });
  }

  function saveBasket() {
    if (!basketModal) return;

    const tag = basketModal.tags.length ? basketModal.tags.join('-') : 'B';
    const type = basketModal.points === 2 ? '2PM' : '3PM';

    enqueue({
      event_id: createEventId(),
      linked_basket_id: basketModal.linked_basket_id,
      type,
      player: basketModal.player,
      status: online ? 'ready' : 'queued',
      payload: basketModal
    });

    log(`${fmt(seconds)} ${basketModal.player} ${basketModal.points}PM ${tag}`);

    if (basketModal.assist !== 'YOK' && basketModal.assist !== 'PENDING') {
      enqueue({
        event_id: createEventId(),
        linked_basket_id: basketModal.linked_basket_id,
        type: 'AST',
        player: basketModal.assist,
        status: online ? 'ready' : 'queued',
        payload: { assist: basketModal.assist }
      });
      log(`${fmt(seconds)} ${basketModal.assist} AST`);
    }

    if (basketModal.foul !== 'YOK' && basketModal.foul !== 'PENDING') {
      enqueue({
        event_id: createEventId(),
        linked_basket_id: basketModal.linked_basket_id,
        type: 'FD',
        player: basketModal.player,
        status: online ? 'ready' : 'queued',
        payload: { drawn_by: basketModal.player }
      });
      enqueue({
        event_id: createEventId(),
        linked_basket_id: basketModal.linked_basket_id,
        type: 'PF',
        player: basketModal.foul,
        status: online ? 'ready' : 'queued',
        payload: { committed_by: basketModal.foul }
      });
      log(`${fmt(seconds)} ${basketModal.player} FD`);
      log(`${fmt(seconds)} ${basketModal.foul} PF`);
    }

    setBasketModal(null);
  }

  function saveSub(playerIn: string) {
    enqueue({
      event_id: createEventId(),
      type: 'SUBSTITUTION',
      player: playerIn,
      status: online ? 'ready' : 'queued',
      payload: { player_out: subOut, player_in: playerIn }
    });
    log(`${fmt(seconds)} DEĞİŞİKLİK: ${subOut} OUT / ${playerIn} IN`);
    setSubOut(null);
  }

  const onCourt = ['#7 Burak', '#4 Ahmet', '#5 Mehmet', '#6 Ali', '#8 Kerem'];
  const bench = ['#9 Ege', '#10 Okan', '#11 Mert', '#12 Can', '#13 Tuna', '#14 Emir', '#15 Arda'];

  return (
    <div className="operator-page">
      <header className="score-header">
        <div className="team-score">
          <div>
            <span>EV SAHİBİ</span>
            <h1>TOFAŞ U14</h1>
          </div>
          <b>{homeScore}</b>
        </div>

        <div className="clock-box">
          <span>4. ÇEYREK</span>
          <strong>{fmt(seconds)}</strong>
          <div className="clock-buttons">
            <button onClick={startClock}>▶</button>
            <button onClick={stopClock}>⏸</button>
          </div>
          <small>{online ? 'ONLINE' : 'OFFLINE'} / Queue: {typeof window !== 'undefined' ? getQueue().filter(e => e.status !== 'synced').length : 0}</small>
          <button onClick={toggleOnline}>{online ? 'Offline Yap' : 'Online Yap'}</button>
        </div>

        <div className="team-score away">
          <div>
            <span>MİSAFİR</span>
            <h1>GEMLİK U14</h1>
          </div>
          <b>{awayScore}</b>
        </div>
      </header>

      <main className="operator-layout">
        <section className="court-area">
          <div className="court-toolbar">
            <button className="active">Saha</button>
            <button>Şutlar</button>
            <button>Fauller</button>
            <button>Heat Map</button>
          </div>

          <div className="court">
            <div className="marker made" style={{ left: '24%', top: '30%' }}>AB</div>
            <div className="marker miss" style={{ left: '36%', top: '39%' }}>K-3</div>
            <div className="marker made" style={{ left: '51%', top: '52%' }}>HH</div>
            <div className="marker made" style={{ left: '70%', top: '44%' }}>AB-FA</div>
          </div>

          <div className="event-feed">
            <h3>Son Olaylar</h3>
            <ul>{feed.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
        </section>

        <aside className="roster-panel">
          <div className="panel-title">
            <div>
              <h2>TOFAŞ U14</h2>
              <span>Sadece kontrol edilen takım</span>
            </div>
          </div>

          <div className="roster-block">
            <h3>Sahadakiler</h3>
            {onCourt.map(p => (
              <div key={p} className={`player-row ${selectedPlayer === p ? 'selected' : ''}`} onClick={() => setSelectedPlayer(p)}>
                <div><b>{p}</b><small>Oyunda</small></div>
                <button onClick={(e) => { e.stopPropagation(); setSubOut(p); }}>Değiş</button>
              </div>
            ))}
          </div>

          <div className="roster-block bench">
            <h3>Yedekler</h3>
            <div className="bench-grid">
              {bench.map(p => <button key={p} onClick={() => setSelectedPlayer(p)}>{p}</button>)}
            </div>
          </div>

          <div className="selected-player-card">
            <span>Seçili Oyuncu</span>
            <strong>{selectedPlayer}</strong>
            <small>Bu oyuncuya istatistik işlenecek</small>
          </div>
        </aside>
      </main>

      <footer className="stat-footer">
        <div className="stat-context">
          <span>İstatistik Girişi</span>
          <b>{selectedPlayer}</b>
        </div>
        <div className="stat-buttons">
          <button onClick={() => basket(2)}>+2</button>
          <button onClick={() => basket(3)}>+3</button>
          <button onClick={() => freeThrow(true)}>+1 FT</button>
          <button onClick={() => freeThrow(false)}>FT Kaçtı</button>
          <button onClick={() => eventOnly('OREB')}>Rib. H</button>
          <button onClick={() => eventOnly('DREB')}>Rib. S</button>
          <button onClick={() => eventOnly('STL')}>Top Çalma</button>
          <button onClick={() => eventOnly('BLK')}>Blok</button>
          <button onClick={() => eventOnly('TOV')}>Top Kaybı</button>
          <button onClick={() => eventOnly('PF')}>Faul</button>
          <button onClick={() => eventOnly('FD')}>Faul Aldı</button>
          <button onClick={() => eventOnly('BY')}>Blok Yedi</button>
        </div>
      </footer>

      {basketModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{basketModal.player} +{basketModal.points} Basket</h2>
            <p>Basket sonrası hızlı seçim: Asist / Faul / YOK.</p>

            <div className="decision-grid">
              <div className="decision-card">
                <h3>Asist?</h3>
                <button onClick={() => setAssist('#4 Ahmet')}>#4 Ahmet</button>
                <button onClick={() => setAssist('#5 Mehmet')}>#5 Mehmet</button>
                <button className="none" onClick={() => setAssist(null)}>YOK</button>
                <p>Durum: {basketModal.assist}</p>
              </div>

              <div className="decision-card">
                <h3>Faul?</h3>
                <button onClick={() => setFoul('#12 Rakip')}>#12 Rakip PF</button>
                <button onClick={() => setFoul('#15 Rakip')}>#15 Rakip PF</button>
                <button className="none" onClick={() => setFoul(null)}>YOK</button>
                <p>Durum: {basketModal.foul}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button className="primary" onClick={saveBasket}>Şut Yerini Seç ve Kaydet</button>
              <button onClick={() => setBasketModal(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {subOut && (
        <div className="modal-backdrop">
          <div className="modal small">
            <h2>Oyuncu Değişikliği</h2>
            <p>Çıkan oyuncu: <b>{subOut}</b></p>
            <h3>Oyuna Girecek Oyuncu</h3>
            <div className="bench-grid">
              {bench.map(p => <button key={p} onClick={() => saveSub(p)}>→ {p}</button>)}
            </div>
            <br />
            <button onClick={() => setSubOut(null)}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
