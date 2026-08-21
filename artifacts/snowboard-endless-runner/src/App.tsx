import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Play, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react';
import './index.css';

type GameMode = 'ready' | 'playing' | 'over';
type ThingKind = 'tree' | 'rock' | 'beacon';
type Thing = { id: number; kind: ThingKind; lane: number; y: number; scale: number; spin: number };
type RunStats = { score: number; best: number; distance: number; beacons: number; combo: number; maxCombo: number };

const START_STATS: RunStats = { score: 0, best: 0, distance: 0, beacons: 0, combo: 0, maxCombo: 0 };
const LANES = [-1, 0, 1];

function getBest() {
  try { return Number(localStorage.getItem('powderline-best') || 0); } catch { return 0; }
}

function GameCanvas({ mode, steering, onHit, onBeacon, onDistance }: {
  mode: GameMode;
  steering: number;
  onHit: () => void;
  onBeacon: () => void;
  onDistance: (distance: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ things: [] as Thing[], playerX: 0, speed: 0, distance: 0, spawn: 0, nextId: 0, flash: 0, beaconPulse: 0 });
  const callbacks = useRef({ onHit, onBeacon, onDistance });
  callbacks.current = { onHit, onBeacon, onDistance };
  const steeringRef = useRef(steering);
  steeringRef.current = steering;

  const drawTree = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#26394a'; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(-27, 0); ctx.lineTo(-11, -3); ctx.lineTo(-39, 39); ctx.lineTo(-12, 35); ctx.lineTo(-26, 68); ctx.lineTo(26, 68); ctx.lineTo(12, 35); ctx.lineTo(39, 39); ctx.lineTo(11, -3); ctx.lineTo(27, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6d4151'; ctx.fillRect(-5, 47, 10, 27); ctx.restore();
  };
  const drawRock = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#566273'; ctx.beginPath(); ctx.moveTo(-31, 20); ctx.lineTo(-23, -10); ctx.lineTo(-4, -25); ctx.lineTo(23, -12); ctx.lineTo(32, 20); ctx.quadraticCurveTo(0, 32, -31, 20); ctx.fill(); ctx.fillStyle = 'rgba(238,239,226,.18)'; ctx.beginPath(); ctx.moveTo(-20,-7); ctx.lineTo(-4,-20); ctx.lineTo(9,-14); ctx.lineTo(-3,-8); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  const drawBeacon = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pulse: number) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = .3 + pulse * .14; ctx.fillStyle = '#fac660'; ctx.beginPath(); ctx.arc(0, 0, 26 + pulse * 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#f8e3aa'; ctx.fillRect(-3, -41, 6, 58); ctx.fillStyle = '#ef765f'; ctx.beginPath(); ctx.moveTo(3,-39); ctx.lineTo(29,-29); ctx.lineTo(3,-18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fac660'; ctx.beginPath(); ctx.arc(0, -43, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => {
    const s = stateRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = w / dpr; const height = h / dpr;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#202b49'); sky.addColorStop(.45, '#74516d'); sky.addColorStop(.73, '#ed9a69'); sky.addColorStop(1, '#f5c57e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = .24; ctx.fillStyle = '#fac660'; ctx.beginPath(); ctx.arc(width * .77, height * .24, 82, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#343b5b'; ctx.beginPath(); ctx.moveTo(0,height*.43); ctx.lineTo(width*.19,height*.22); ctx.lineTo(width*.32,height*.4); ctx.lineTo(width*.55,height*.16); ctx.lineTo(width*.76,height*.38); ctx.lineTo(width*.95,height*.2); ctx.lineTo(width,height*.38); ctx.lineTo(width,height*.58); ctx.lineTo(0,height*.58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6e8d0'; ctx.globalAlpha = .62; ctx.beginPath(); ctx.moveTo(width*.19,height*.22); ctx.lineTo(width*.23,height*.3); ctx.lineTo(width*.14,height*.3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(width*.55,height*.16); ctx.lineTo(width*.6,height*.3); ctx.lineTo(width*.49,height*.3); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    const horizon = height * .42; const vanX = width / 2;
    ctx.fillStyle = '#d9e5e5'; ctx.beginPath(); ctx.moveTo(0,horizon); ctx.lineTo(width*.18,horizon-.07*height); ctx.lineTo(width*.34,horizon+.02*height); ctx.lineTo(vanX,horizon-.08*height); ctx.lineTo(width*.67,horizon+.02*height); ctx.lineTo(width*.83,horizon-.07*height); ctx.lineTo(width,horizon); ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(width*.22,horizon); ctx.lineTo(vanX,horizon); ctx.lineTo(width*.88,horizon); ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#c6dce0'; ctx.fillRect(0,horizon,width,height-horizon);
    ctx.strokeStyle = 'rgba(79,105,125,.1)'; ctx.lineWidth = 2;
    for (let i = -10; i < 15; i++) { ctx.beginPath(); ctx.moveTo(vanX, horizon); ctx.lineTo(vanX + i * width * .23, height); ctx.stroke(); }
    for (let j = 1; j < 10; j++) { const yy = horizon + Math.pow(j / 10, 1.7) * (height-horizon); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(width,yy); ctx.stroke(); }
    ctx.restore();
    const depth = (y: number) => Math.max(0.35, Math.min(1.3, (y - horizon) / (height-horizon) * 1.1));
    s.things.slice().sort((a,b) => a.y-b.y).forEach((item) => {
      const z = depth(item.y); const laneX = vanX + item.lane * (width * .095 + (item.y-horizon) * .52);
      if (item.kind === 'tree') drawTree(ctx, laneX, item.y, z * item.scale);
      if (item.kind === 'rock') drawRock(ctx, laneX, item.y, z * item.scale);
      if (item.kind === 'beacon') drawBeacon(ctx, laneX, item.y, z * item.scale, Math.sin(s.beaconPulse) * .5 + .5);
    });
    const px = vanX + s.playerX * Math.min(width * .22, 245); const py = height * .82;
    ctx.save(); ctx.translate(px, py); ctx.rotate(s.playerX * -.12);
    ctx.fillStyle = 'rgba(36,53,72,.2)'; ctx.beginPath(); ctx.ellipse(0, 14, 47, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ef765f'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-37, 5); ctx.quadraticCurveTo(0, 16, 37, 5); ctx.stroke();
    ctx.strokeStyle = '#f8e3aa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-28, 2); ctx.quadraticCurveTo(0, 10, 28, 2); ctx.stroke();
    ctx.fillStyle = '#25334d'; ctx.beginPath(); ctx.ellipse(0,-19,16,23,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fac660'; ctx.beginPath(); ctx.arc(0,-43,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#202b49'; ctx.beginPath(); ctx.arc(0,-47,11,Math.PI,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#25334d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-11,-20); ctx.lineTo(-25,-5); ctx.moveTo(11,-20); ctx.lineTo(25,-5); ctx.stroke();
    ctx.restore();
    if (s.flash > 0) { ctx.fillStyle = `rgba(239,118,95,${s.flash * .16})`; ctx.fillRect(0,0,width,height); }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0; let last = performance.now();
    const resize = () => {
      const box = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = box.width * dpr; canvas.height = box.height * dpr;
    };
    resize(); window.addEventListener('resize', resize);
    const tick = (now: number) => {
      const dt = Math.min((now-last)/1000, .04); last = now; const st = stateRef.current;
      if (mode === 'playing') {
        st.speed = Math.min(1.7, st.speed + dt * .014); st.distance += dt * (24 + st.speed * 22); st.beaconPulse += dt * 4;
        st.playerX += (steeringRef.current - st.playerX) * Math.min(1, dt * 8);
        st.spawn -= dt;
        if (st.spawn <= 0) {
          const kind: ThingKind = Math.random() < .22 ? 'beacon' : Math.random() < .56 ? 'tree' : 'rock';
          st.things.push({ id: st.nextId++, kind, lane: LANES[Math.floor(Math.random()*3)], y: 0, scale: .72 + Math.random()*.2, spin: Math.random() });
          st.spawn = Math.max(.33, .74 - st.speed * .16 + Math.random()*.3);
        }
        st.things.forEach((thing) => { thing.y += dt * (145 + st.speed * 125) * (thing.kind === 'beacon' ? .95 : 1); });
        const box = canvas.getBoundingClientRect(); const height = box.height;
        const hit = st.things.find((t) => t.y > height*.74 && t.y < height*.88 && Math.abs(t.lane - st.playerX) < .34 && t.kind !== 'beacon');
        if (hit) { st.flash = 1; callbacks.current.onHit(); st.things = st.things.filter((t) => t.id !== hit.id); }
        const beacon = st.things.find((t) => t.y > height*.73 && t.y < height*.86 && Math.abs(t.lane - st.playerX) < .3 && t.kind === 'beacon');
        if (beacon) { callbacks.current.onBeacon(); st.things = st.things.filter((t) => t.id !== beacon.id); st.beaconPulse = 0; }
        st.things = st.things.filter((t) => t.y < height + 100);
        callbacks.current.onDistance(Math.floor(st.distance));
        st.flash = Math.max(0, st.flash - dt * 2.8);
      } else { st.beaconPulse += dt * 2; st.flash = Math.max(0, st.flash - dt * 2.8); }
      const dpr = Math.min(window.devicePixelRatio || 1, 2); draw(ctx, canvas.width, canvas.height, dpr);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [draw, mode]);
  useEffect(() => { if (mode === 'ready') stateRef.current = { ...stateRef.current, things: [], playerX: 0, speed: 0, distance: 0, spawn: .25 }; }, [mode]);
  return <canvas ref={canvasRef} className="game-canvas" data-testid="game-canvas" aria-label="Powderline downhill course" />;
}

function App() {
  const [mode, setMode] = useState<GameMode>('ready');
  const [steering, setSteering] = useState(0);
  const [stats, setStats] = useState<RunStats>(() => ({ ...START_STATS, best: getBest() }));
  const [sound, setSound] = useState(true);
  const [isNewBest, setIsNewBest] = useState(false);
  const scoreRef = useRef({ lastBeacon: 0, combo: 0 });

  useEffect(() => {
    document.title = 'Powderline — Chase the Golden Line';
    const description = 'Powderline is a quick, playful downhill snowboarding run. Dodge, collect beacons, and chase your local best.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', description);
    document.documentElement.classList.add('dark');
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); setSteering(-1); }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); setSteering(1); }
      if ((event.key === ' ' || event.key === 'Enter') && mode !== 'playing') startRun();
    };
    const onUp = (event: KeyboardEvent) => { if (['ArrowLeft','ArrowRight','a','d'].includes(event.key)) setSteering(0); };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); };
  });
  const startRun = useCallback(() => {
    scoreRef.current = { lastBeacon: 0, combo: 0 };
    setStats((old) => ({ ...START_STATS, best: old.best }));
    setIsNewBest(false); setMode('playing');
  }, []);
  const finishRun = useCallback(() => {
    setStats((old) => {
      const nextBest = Math.max(old.best, old.score);
      if (nextBest > old.best) { try { localStorage.setItem('powderline-best', String(nextBest)); } catch { /* local storage can be unavailable */ } setIsNewBest(true); }
      return { ...old, best: nextBest };
    });
    setMode('over'); setSteering(0);
  }, []);
  const collectBeacon = useCallback(() => {
    scoreRef.current.combo = Math.min(9, scoreRef.current.combo + 1);
    setStats((old) => {
      const combo = scoreRef.current.combo;
      return { ...old, beacons: old.beacons + 1, combo, maxCombo: Math.max(old.maxCombo, combo), score: old.score + 25 + combo * 5 };
    });
  }, []);
  const updateDistance = useCallback((distance: number) => {
    setStats((old) => ({ ...old, distance, score: Math.floor(distance * 1.2) + old.beacons * 25 + old.maxCombo * 5 }));
  }, []);
  const pressSteer = (direction: number) => setSteering(direction);
  const score = Math.floor(stats.distance * 1.2) + stats.beacons * 25 + stats.maxCombo * 5;
  const liveStats = { ...stats, score };
  return (
    <main className="game-shell" data-testid="game-shell">
      <section className="game-stage" aria-label="Powderline game">
        <GameCanvas mode={mode} steering={steering} onHit={finishRun} onBeacon={collectBeacon} onDistance={updateDistance} />
        <header className="game-topbar">
          <div className="brand-lockup" data-testid="text-game-title">
            <div className="brand-mark" aria-hidden="true" />
            <div><h1 className="brand-name">POWDERLINE</h1><p className="brand-sub">find your fall line</p></div>
          </div>
          <div className="top-actions">
            <button type="button" className="icon-button" data-testid="button-sound" aria-label={sound ? 'Mute sound' : 'Turn sound on'} onClick={() => setSound(!sound)}>
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
        </header>
        <div className="hud" aria-live="polite">
          <div className="hud-card"><span className="hud-label">score</span><strong className="hud-value" data-testid="text-score">{liveStats.score.toLocaleString()}</strong></div>
          <div className="hud-card combo"><span className="hud-label">beacon chain</span><strong className="hud-value" data-testid="text-combo">x{liveStats.combo}</strong></div>
          <div className="hud-card best"><span className="hud-label">local best</span><strong className="hud-value" data-testid="text-best">{liveStats.best.toLocaleString()}</strong></div>
        </div>
        <div className="progress-track" aria-hidden="true"><div className="progress-fill" style={{ transform: `scaleX(${Math.min(1, liveStats.distance / 1000)})` }} /></div>
        {mode === 'ready' && <div className="game-overlay">
          <div className="intro-panel">
            <div className="eyebrow">run 001 / open face</div>
            <div className="hero-title">Chase<br /><em>the line.</em></div>
            <p className="hero-copy">Drop into the light. Thread the trees, catch the beacons, and keep your edge sharp.</p>
            <button type="button" className="primary-button" data-testid="button-start-run" onClick={startRun}><Play size={17} fill="currentColor" /> Drop in</button>
            <div className="hint-row">
              <span className="hint"><span className="keycap">A</span><span className="keycap">D</span> steer</span>
              <span className="hint"><span className="keycap">←</span><span className="keycap">→</span> carve</span>
              <span className="hint"><Zap size={13} /> chain beacons</span>
            </div>
          </div>
        </div>}
        {mode === 'over' && <div className="game-overlay">
          <div className="game-over-panel">
            <div className="eyebrow">line ended / clean slate</div>
            <div className="game-over-title">Nice run.</div>
            <p className="game-over-note">The mountain keeps the score. You keep the feeling.</p>
            {isNewBest && <div className="new-best" data-testid="status-new-best">New local best</div>}
            <div className="result-grid">
              <div className="result-cell"><span className="result-label">score</span><strong className="result-value score" data-testid="text-final-score">{liveStats.score.toLocaleString()}</strong></div>
              <div className="result-cell"><span className="result-label">distance</span><strong className="result-value" data-testid="text-distance">{liveStats.distance}m</strong></div>
              <div className="result-cell"><span className="result-label">beacons</span><strong className="result-value" data-testid="text-final-beacons">{liveStats.beacons}</strong></div>
              <div className="result-cell"><span className="result-label">best chain</span><strong className="result-value best" data-testid="text-final-combo">x{liveStats.maxCombo}</strong></div>
            </div>
            <div className="game-over-actions">
              <button type="button" className="primary-button" data-testid="button-restart-run" onClick={startRun}><RotateCcw size={16} /> Go again</button>
              <button type="button" className="secondary-button" data-testid="button-back-to-start" onClick={() => setMode('ready')}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> View start</button>
            </div>
          </div>
        </div>}
        <div className="bottom-hud">
          <div className="mission-chip" data-testid="status-run-tip">{mode === 'playing' ? 'stay loose · the line gets faster' : 'golden hour / fresh tracks'}</div>
          <div className="touch-controls" aria-label="Touch controls">
            <button type="button" className="touch-button" data-testid="button-steer-left" aria-label="Steer left" onPointerDown={() => pressSteer(-1)} onPointerUp={() => setSteering(0)} onPointerCancel={() => setSteering(0)}><ArrowLeft size={21} /></button>
            <button type="button" className="touch-button" data-testid="button-steer-right" aria-label="Steer right" onPointerDown={() => pressSteer(1)} onPointerUp={() => setSteering(0)} onPointerCancel={() => setSteering(0)}><ArrowRight size={21} /></button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
