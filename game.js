const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W, H;
function resize(){ const d = devicePixelRatio||1; W = innerWidth; H = innerHeight; cv.width = W*d; cv.height = H*d; ctx.setTransform(d,0,0,d,0,0); }
addEventListener('resize', resize); resize();

// ---------- world ----------
const WW = 3200, WH = 3200;
let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
const pond = {x:1600, y:1500, rx:230, ry:130};
const inPond = (x,y,m=0) => ((x-pond.x)/(pond.rx+m))**2 + ((y-pond.y)/(pond.ry+m))**2 < 1;
const cottage = {x:1600, y:760};

const flowers = [];
for (let i=0; i<1100; i++){
  const x = 60 + rnd()*(WW-120), y = 60 + rnd()*(WH-120);
  if (inPond(x,y,30)) continue;
  if (Math.abs(x-cottage.x)<150 && Math.abs(y-cottage.y)<110) continue;
  if (Math.hypot(x-1600, y-2600) < 90) continue; // clearing at spawn
  flowers.push({x, y, h:70+rnd()*60, ph:rnd()*6.28, s:0.8+rnd()*0.5, picked:0});
}
// ---------- missions & collectibles ----------
const HER_NAME = 'you';   // <- put her name here
const LETTER = `Dear ${HER_NAME},\n\nYou found every egg, every berry, every chocolate and all 13 stars.\n\nI planted this whole valley for you, because you make ordinary days feel golden.\n\nWrite your own message here ♥`;
const inv = {kinder:0, berry:0, choc:0, star:0}; let cake = false, gold = null, finished = false;
const MISSIONS = [
  {k:'kinder',  t:'Find 5 Kinder Joy eggs 🥚',            need:5,  win:'Surprise inside! 🥚'},
  {k:'berry',   t:'Pick 10 blueberries 🫐',               need:10},
  {k:'cake',    t:'Bake blueberry cheesecake at cottage 🍰', need:1, win:'Cheesecake is ready 🍰'},
  {k:'choc',    t:'Collect 7 chocolates 🍫',               need:7,  win:'Sweet tooth satisfied 🍫'},
  {k:'star',t:'Catch 13 fallen stars ⭐',       need:13, win:'you\'re 11:11 ✨'},
];
const count = k => k==='cake' ? (cake?1:0) : inv[k];
const items = [];
for (const [type, n] of [['kinder',5],['berry',12],['choc',7],['star',13]]){
  for (let i=0;i<n;i++){
    let x, y; do { x = 120+rnd()*(WW-240); y = 120+rnd()*(WH-240); } while (inPond(x,y,40) || Math.hypot(x-cottage.x,y-cottage.y)<170 || Math.hypot(x-1600,y-2600)<120);
    items.push({type, x, y, ph:rnd()*6, got:false});
  }
}
function updateMissions(){
  document.getElementById('missions').innerHTML = '<b>🌻 Missions</b>' + MISSIONS.map(m => {
    const c = Math.min(count(m.k), m.need), d = c>=m.need;
    return `<div class="${d?'done':''}">${m.t}${m.k==='cake'?'':` (${c}/${m.need})`}</div>`;
  }).join('') + (gold ? '<div>✨ A golden sunflower has appeared near where you started…</div>' : '');
}
function checkProgress(k){
  const m = MISSIONS.find(x => x.k===k);
  if (m && m.win && count(k)===m.need){ setTimeout(() => { toast(m.win); chime(); }, 2400); }
  if (!gold && MISSIONS.every(m => count(m.k)>=m.need)){
    gold = {x:1600, y:2480}; setTimeout(()=>toast('A golden sunflower appeared… 🌟'), 2500);
  }
  updateMissions();
}
function drawItem(it, t){
  const bob = Math.sin(t*2.5+it.ph)*3, x = it.x, y = it.y - 10 + bob;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 9, 3, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = .35 + .2*Math.sin(t*4+it.ph); ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (it.type==='kinder'){
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y+3, 9, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f39a1e'; ctx.beginPath(); ctx.ellipse(x, y-3, 9, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d8191f'; ctx.fillRect(x-9, y-1, 18, 2.5);
  } else if (it.type==='berry'){
    ctx.fillStyle = '#3b4a9c'; for (const [dx,dy] of [[-4,2],[4,2],[0,-4]]){ ctx.beginPath(); ctx.arc(x+dx, y+dy, 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8a95d6'; ctx.beginPath(); ctx.arc(x-5, y, 1.4, 0, 7); ctx.fill();
  } else if (it.type==='choc'){
    ctx.fillStyle = '#4b2a14'; ctx.fillRect(x-8, y-6, 16, 12);
    ctx.strokeStyle = '#2d180a'; ctx.lineWidth = 1; ctx.strokeRect(x-8, y-6, 16, 12); ctx.beginPath(); ctx.moveTo(x, y-6); ctx.lineTo(x, y+6); ctx.moveTo(x-8, y); ctx.lineTo(x+8, y); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffe066'; ctx.beginPath();
    for (let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? 4 : 10; ctx.lineTo(x+Math.cos(a)*r, y+Math.sin(a)*r); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 1; ctx.stroke();
  }
}
// ---------- sound (synthesized, no files) ----------
let AC = null;
function sfx(f, d=.15, type='sine', vol=.07, to=f){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(to, n+d);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(.0001, n+d);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(n+d);
  }catch(e){}
}
const chime = () => [660,880,1320].forEach((f,i) => setTimeout(() => sfx(f,.25,'triangle'), i*90));

// ---------- item effects ----------
let boostUntil = 0;
const SURPRISES = [
  'Inside the egg: "Sunflowers face the light even on cloudy days. Be like that." 🌻',
  'Inside the egg: "You don\'t need to have it all figured out. Just take the next step." 👣',
  'Inside the egg: "Hard things feel impossible right until they\'re done." 💪',
  'Inside the egg: "Progress counts, even when it\'s slow." 🐢',
  'Inside the egg: "You\'ve survived every bad day so far. Your record is 100%." 🏆',
];
const WISHES = ['Wish: a day with zero stress','Wish: a big win this week','Wish: more time for what you love','Wish: courage for the next big thing','Wish: a really good meal today','Wish: sleep that actually refreshes','Wish: an idea that clicks','Wish: good news, soon','Wish: a trip somewhere new','Wish: calm in a busy week','Wish: a laugh you can\'t stop','Wish: confidence on tough days','Wish: all of the above'];
function itemEffect(it){
  if (it.type==='kinder'){ toast(SURPRISES[(inv.kinder-1) % SURPRISES.length]); sfx(500,.25,'square',.04,900); }
  else if (it.type==='berry'){ sfx(900,.08,'sine',.07,1200); }
  else if (it.type==='choc'){ boostUntil = performance.now()+6000; toast('Sugar rush! Speed boost 🍫⚡'); sfx(300,.3,'sawtooth',.04,800); }
  else { toast('⭐ ' + WISHES[(inv.star-1) % WISHES.length] + ' (' + inv.star + '/13)'); chime(); }
}

// ---------- cat (white Persian) ----------
const dog = {x:1540, y:2650, dir:1, t:0};   // follower state (kept name; it's the cat now)
function drawDog(t){
  const moving = dog.moving, sway = Math.sin(t*(moving?6:2))*.35, bob = moving ? Math.abs(Math.sin(t*14))*2 : Math.sin(t*2)*.6, d = dog.dir;
  const fur = '#fdfcf8', shade = '#e6e2d8';
  ctx.save(); ctx.translate(dog.x, dog.y); ctx.scale(1.3,1.3);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 5, 0, 0, 7); ctx.fill();
  // big fluffy tail, curling up behind
  ctx.save(); ctx.translate(-d*11, -12-bob); ctx.rotate(-d*(.5+sway));
  ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(0, -9, 5.5, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -9, 4.4, 11, 0, 0, 7); ctx.fill();
  ctx.restore();
  // fluffy body
  ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(0, -9-bob, 14, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fur;   ctx.beginPath(); ctx.ellipse(0, -10-bob, 13, 8.2, 0, 0, 7); ctx.fill();
  // paws
  const st = moving ? Math.sin(t*14)*2 : 0;
  ctx.fillStyle = fur; ctx.strokeStyle = shade; ctx.lineWidth = .8;
  for (const px of [-8+st, -3-st, 4+st, 9-st]){ ctx.beginPath(); ctx.ellipse(px, 0, 3, 2.4, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  // chest ruff
  ctx.beginPath(); ctx.ellipse(d*9, -9-bob, 6, 6, 0, 0, 7); ctx.fill();
  // head: round, fluffy cheeks
  const hx = d*13, hy = -17-bob;
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(hx, hy, 8.4, 0, 7); ctx.fill();
  ctx.fillStyle = fur;   ctx.beginPath(); ctx.arc(hx, hy, 7.6, 0, 7); ctx.ellipse(hx-4, hy+3, 4, 3, 0, 0, 7); ctx.ellipse(hx+4, hy+3, 4, 3, 0, 0, 7); ctx.fill();
  // ears
  ctx.fillStyle = fur; ctx.strokeStyle = shade;
  for (const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(hx+s*7, hy-3); ctx.lineTo(hx+s*5, hy-12); ctx.lineTo(hx+s*1.5, hy-6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#f6c6c6'; for (const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(hx+s*5.6, hy-5); ctx.lineTo(hx+s*4.8, hy-9.5); ctx.lineTo(hx+s*2.8, hy-6); ctx.fill(); }
  // face: eyes, flat pink nose, mouth, whiskers
  const blink = (t % 4) < .12;
  ctx.fillStyle = '#3d8fd1';
  if (!blink){ ctx.beginPath(); ctx.ellipse(hx-3.2, hy-.5, 1.7, 2, 0, 0, 7); ctx.ellipse(hx+3.2, hy-.5, 1.7, 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx-3.2, hy-.5, .9, 0, 7); ctx.arc(hx+3.2, hy-.5, .9, 0, 7); ctx.fill(); }
  else { ctx.strokeStyle = '#555'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(hx-5, hy-.5); ctx.lineTo(hx-1.5, hy-.5); ctx.moveTo(hx+1.5, hy-.5); ctx.lineTo(hx+5, hy-.5); ctx.stroke(); }
  ctx.fillStyle = '#f2a0a8'; ctx.beginPath(); ctx.ellipse(hx, hy+2.2, 1.5, 1, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b88'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(hx, hy+3.2); ctx.lineTo(hx-1.5, hy+4.4); ctx.moveTo(hx, hy+3.2); ctx.lineTo(hx+1.5, hy+4.4); ctx.stroke();
  ctx.strokeStyle = '#d4d0c6'; ctx.lineWidth = .6; ctx.beginPath();
  for (const s of [-1,1]){ ctx.moveTo(hx+s*5, hy+2.5); ctx.lineTo(hx+s*12, hy+1.5); ctx.moveTo(hx+s*5, hy+3.5); ctx.lineTo(hx+s*12, hy+4.5); }
  ctx.stroke();
  ctx.restore();
}

// ---------- fireflies ----------
const flies = Array.from({length:220}, () => ({x:rnd()*WW, y:rnd()*WH, ph:rnd()*9}));
function drawFireflies(t, dark, x0, x1, y0, y1){
  if (dark <= 0) return;
  for (const f of flies){
    const x = f.x + Math.sin(t*.6+f.ph)*30, y = f.y + Math.cos(t*.8+f.ph)*20 - 30;
    if (x<x0||x>x1||y<y0||y>y1) continue;
    const a = dark*(.5+.5*Math.sin(t*3+f.ph*3));
    const g = ctx.createRadialGradient(x,y,0,x,y,14); g.addColorStop(0,`rgba(255,255,150,${a})`); g.addColorStop(1,'rgba(255,255,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,14,0,7); ctx.fill();
  }
}

// ---------- era corners ----------
const ERA_ZONES = [
  {x:520,  y:520,  c:'255,120,190', n:'Lover'},
  {x:2680, y:520,  c:'140,160,140', n:'folklore'},
  {x:520,  y:2680, c:'40,50,130',   n:'Midnights'},
  {x:2680, y:2680, c:'120,200,255', n:'1989'},
];
function drawZones(){
  for (const z of ERA_ZONES){
    const g = ctx.createRadialGradient(z.x,z.y,20,z.x,z.y,300); g.addColorStop(0,`rgba(${z.c},.45)`); g.addColorStop(1,`rgba(${z.c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x,z.y,300,0,7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = 'italic 26px Georgia'; ctx.textAlign = 'center'; ctx.fillText(z.n, z.x, z.y+8);
  }
}

// ---------- picnic ----------
function drawPicnic(){
  const x = 1130, y = 1700;
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x-62, y-32, 130, 80);
  for (let i=0;i<6;i++) for (let j=0;j<4;j++){ ctx.fillStyle = (i+j)%2 ? '#fff' : '#d8191f'; ctx.fillRect(x-60+i*20, y-35+j*20, 20, 20); }
  ctx.fillStyle = '#f4ead2'; ctx.beginPath(); ctx.ellipse(x, y-6, 20, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b4a9c'; for (let i=0;i<6;i++){ ctx.beginPath(); ctx.arc(x-10+i*4, y-10+(i%2)*3, 2.4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#4b2a14'; ctx.fillRect(x+30, y-12, 14, 10);
  ctx.fillStyle = '#fff'; ctx.font = '13px Georgia'; ctx.textAlign = 'center'; ctx.fillText('picnic time 🍰', x, y-48);
}

function drawGold(t){
  const x = gold.x, y = gold.y, p = 1 + Math.sin(t*3)*.08;
  const g = ctx.createRadialGradient(x, y-60, 5, x, y-60, 120); g.addColorStop(0,'#fff3a0cc'); g.addColorStop(1,'#fff3a000');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y-60, 120, 0, 7); ctx.fill();
  drawSunflower({x, y, h:120*p, ph:0, s:1.6}, t);
}
const trees = [];
for (let i=0; i<60; i++){
  const edge = rnd(), t = rnd();
  const x = edge<.5 ? (rnd()<.5? 20 : WW-20) : t*WW, y = edge<.5 ? t*WH : (rnd()<.5? 20 : WH-20);
  trees.push({x, y, r:40+rnd()*30});
}
const butterflies = Array.from({length:16}, () => ({x:rnd()*WW, y:rnd()*WH, a:rnd()*6.28, hue:[320,40,200,280][i4()], ph:rnd()*9}));
function i4(){ return Math.floor(rnd()*4); }
const petals = [];
const clouds = Array.from({length:10}, () => ({x:rnd()*WW, y:rnd()*WH, s:.6+rnd()}));

// ---------- player ----------
const P = {x:1600, y:2600, dir:1, vx:0, vy:0, walk:0};
const keys = {};
let picked = 0, tod = 0.25, mouse = null;
const flying = [];
const typing = e => e.target && e.target.tagName === 'INPUT';
addEventListener('keydown', e => {
  if (typing(e)) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key===' '||e.key.toLowerCase()==='e') pickNearby();
  if (e.key.toLowerCase()==='t') tod = (tod + 0.25) % 1;
});
addEventListener('keyup', e => { if (!typing(e)) keys[e.key.toLowerCase()] = false; });
document.getElementById('lt-close').addEventListener('click', () => { document.getElementById('letter').style.display = 'none'; });
cv.addEventListener('pointerdown', e => mouse = {x:e.clientX, y:e.clientY});
cv.addEventListener('pointermove', e => { if (mouse) mouse = {x:e.clientX, y:e.clientY}; });
addEventListener('pointerup', () => mouse = null);
document.getElementById('pick').addEventListener('pointerdown', e => { e.stopPropagation(); pickNearby(); });

function toast(t){ const el = document.getElementById('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(()=>el.style.opacity=0, 2200); }
const msgs = {1:'Your first sunflower! 🌻', 10:'A little bouquet 💐', 25:'The valley loves you ☀️', 50:'Sunflower queen 👑'};
function pickNearby(){
  if (gold && !finished && Math.hypot(gold.x-P.x, gold.y-P.y) < 100){
    finished = true; document.getElementById('lt').textContent = LETTER; document.getElementById('letter').style.display = 'flex'; return;
  }
  if (!cake && inv.berry >= 10 && Math.hypot(cottage.x-P.x, cottage.y-P.y) < 160){ cake = true; NET.send({t:'c'}); checkProgress('cake'); return; }
  let it = null, id = 70;
  for (const i of items){ if (i.got) continue; const d = Math.hypot(i.x-P.x, i.y-P.y); if (d<id){id=d; it=i;} }
  if (it){
    it.got = true; inv[it.type]++; itemEffect(it);
    for (let i=0;i<10;i++) petals.push({x:it.x, y:it.y-10, vx:(Math.random()-.5)*120, vy:-Math.random()*100, life:1.2, r:3});
    NET.send({t:'i', i:items.indexOf(it)});
    checkProgress(it.type); return;
  }
  let best=null, bd=75;
  for (const f of flowers){ if (f.picked) continue; const d = Math.hypot(f.x-P.x, f.y-P.y); if (d<bd){bd=d; best=f;} }
  if (!best) return;
  best.picked = performance.now();
  sfx(520,.12,'triangle',.06,780);
  const hy = best.y - best.h*best.s;
  flying.push({sx:best.x, sy:hy, t0:performance.now()});
  P.gatherUntil = performance.now() + 650; P.gx = best.x; P.gy = best.y - 20;
  if (best.x !== P.x) P.dir = Math.sign(best.x - P.x);
  for (let i=0;i<8;i++) petals.push({x:best.x, y:hy, vx:(Math.random()-.5)*90, vy:-Math.random()*70, life:1, r:Math.random()*6});
}
function handPos(){ return {x: P.x + P.dir*9*1.5, y: P.y - 38*1.5}; }
function arrive(){
  picked++; document.getElementById('n').textContent = picked;
  P.pulse = performance.now();
  const h = handPos();
  for (let i=0;i<6;i++) petals.push({x:h.x, y:h.y, vx:(Math.random()-.5)*80, vy:-Math.random()*60, life:.8, r:3});
  sfx(780,.1,'sine',.06,1100);
  if (msgs[picked]) toast(msgs[picked]);
}

// ---------- drawing helpers ----------
function sunDir(){ const a = tod*Math.PI*2; return {x:Math.cos(a), y:-0.3}; }

function drawSunflower(f, t){
  const sway = Math.sin(t*1.3 + f.ph)*5*f.s;
  const sd = sunDir();
  const hx = f.x + sway + sd.x*6, hy = f.y - f.h*f.s;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(f.x, f.y+2, 14*f.s, 5*f.s, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3f7a24'; ctx.lineWidth = 4*f.s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x, f.y - f.h*.5*f.s, hx, hy); ctx.stroke();
  ctx.fillStyle = '#4c9a2c';
  for (const side of [-1,1]){
    const ly = f.y - f.h*f.s*(.35 + (side>0?.12:0));
    ctx.beginPath(); ctx.ellipse(f.x + side*11*f.s, ly, 11*f.s, 5*f.s, side*-.5, 0, 7); ctx.fill();
  }
  const r = 17*f.s;
  for (let i=0;i<14;i++){
    const a = i/14*6.283 + f.ph;
    ctx.fillStyle = i%2 ? '#ffc61a' : '#ffd93d';
    ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*r*1.05, hy+Math.sin(a)*r*1.05*.9, r*.55, r*.27, a, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#5a3412'; ctx.beginPath(); ctx.arc(hx, hy, r*.72, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a4a1c'; ctx.beginPath(); ctx.arc(hx - r*.15, hy - r*.15, r*.42, 0, 7); ctx.fill();
}

function drawGirl(t, p, cnt){
  const x = p.x, y = p.y, d = p.dir, moving = Math.hypot(p.vx,p.vy) > 5;
  const gath = performance.now() < p.gatherUntil;
  const bob = (moving ? Math.abs(Math.sin(p.walk))*3 : Math.sin(t*2)*.8) + (gath ? 3 : 0);
  const step = moving ? Math.sin(p.walk)*7 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(1.5, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 16, 6, 0, 0, 7); ctx.fill();
  // legs
  ctx.strokeStyle = '#f2c9a5'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -16-bob); ctx.lineTo(-4+step, -1); ctx.moveTo(4, -16-bob); ctx.lineTo(4-step, -1); ctx.stroke();
  ctx.fillStyle = '#7b3f1d'; ctx.beginPath(); ctx.ellipse(-4+step, 0, 4, 2.5, 0, 0, 7); ctx.ellipse(4-step, 0, 4, 2.5, 0, 0, 7); ctx.fill();
  // back hair (open, flowing)
  const hairLean = -d*(moving?7:0) + Math.sin(t*2.5)*2.5, flow = Math.sin(t*3 + p.walk*.5)*3;
  ctx.fillStyle = '#3a2214';
  ctx.beginPath();
  ctx.moveTo(-10, -52-bob);
  ctx.bezierCurveTo(-18+hairLean, -40-bob, -15+hairLean+flow, -26-bob, -11+hairLean*1.4, -14-bob);
  ctx.quadraticCurveTo(0+hairLean*1.2, -10-bob+flow, 11+hairLean*1.4, -15-bob);
  ctx.bezierCurveTo(16+hairLean+flow, -26-bob, 18+hairLean, -40-bob, 10, -52-bob);
  ctx.closePath(); ctx.fill();
  // dress
  ctx.fillStyle = '#d8191f';
  ctx.beginPath(); ctx.moveTo(-6, -38-bob); ctx.lineTo(6, -38-bob);
  ctx.quadraticCurveTo(10, -27-bob, 15, -15-bob+Math.sin(t*3)*.6);
  ctx.quadraticCurveTo(0, -11-bob, -15, -15-bob+Math.sin(t*3+1)*.6);
  ctx.quadraticCurveTo(-10, -27-bob, -6, -38-bob); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#fff';
  for (const [dx,dy] of [[-8,-17],[0,-14],[8,-17],[-4,-23],[4,-23],[-11,-14],[11,-14],[0,-31],[-3,-35],[3,-35],[-7,-27],[7,-27]]){
    ctx.beginPath(); ctx.arc(dx, dy-bob, 1.7, 0, 7); ctx.fill();
  }
  ctx.restore();
  // arms
  ctx.strokeStyle = '#f2c9a5'; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(-6, -36-bob); ctx.lineTo(-10-step*.5, -24-bob); ctx.moveTo(6, -36-bob); ctx.lineTo(10+step*.5, -24-bob); ctx.stroke();
  // arm reaching down to pluck
  if (gath){
    let rx = (p.gx - p.x)/1.5, ry = (p.gy - p.y)/1.5 + 14; const L = Math.hypot(rx, ry) || 1, k = Math.min(1, 24/L);
    ctx.strokeStyle = '#f2c9a5'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(d*6, -36-bob); ctx.lineTo(d*6 + rx*k*Math.abs(d), -36-bob + ry*k); ctx.stroke();
  }
  drawBouquet(p, cnt, d, bob);
  // neck/head
  ctx.fillStyle = '#f2c9a5'; ctx.fillRect(-2, -42-bob, 4, 5);
  ctx.beginPath(); ctx.arc(0, -48-bob, 9, 0, 7); ctx.fill();
  // front hair (side locks + fringe)
  ctx.fillStyle = '#3a2214';
  ctx.beginPath(); ctx.arc(0, -50-bob, 9.6, Math.PI*1.02, Math.PI*1.98); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9, -42-bob, 2.8, 9, .15+hairLean*.01, 0, 7); ctx.ellipse(9, -42-bob, 2.8, 9, -.15+hairLean*.01, 0, 7); ctx.fill();
  // face
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath(); ctx.arc(d*3.2-2.5, -48-bob, 1, 0, 7); ctx.arc(d*3.2+2.5, -48-bob, 1, 0, 7); ctx.fill();
  ctx.fillStyle = '#f09a9a88'; ctx.beginPath(); ctx.arc(d*3.2-5, -45.5-bob, 2, 0, 7); ctx.arc(d*3.2+5, -45.5-bob, 2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#a2412f'; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(d*3.2, -45-bob, 2.2, .2, 2.9); ctx.stroke();
  ctx.restore();
}

function drawBouquet(p, cnt, d, bob){
  if (cnt > 0){
    const pl = Math.max(0, 1 - (performance.now() - (p.pulse||0))/300);
    ctx.save(); ctx.translate(d*9, -24-bob); ctx.scale(1+pl*.25, 1+pl*.25); ctx.translate(-d*9, 24+bob);
    const n = Math.min(cnt, 12), bx = d*9, by = -24-bob;
    ctx.strokeStyle = '#3f7a24'; ctx.lineWidth = 1.6;
    for (let i=0;i<n;i++){ const a = (i-(n-1)/2)*.28; ctx.beginPath(); ctx.moveTo(bx, by+6); ctx.lineTo(bx+Math.sin(a)*14, by-Math.cos(a)*14); ctx.stroke(); }
    for (let i=0;i<n;i++){
      const a = (i-(n-1)/2)*.28, hx = bx+Math.sin(a)*14, hy = by-Math.cos(a)*14;
      ctx.fillStyle = '#ffc61a'; ctx.beginPath(); ctx.arc(hx, hy, 4.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a3412'; ctx.beginPath(); ctx.arc(hx, hy, 1.9, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#d8191f'; ctx.beginPath(); ctx.moveTo(bx-3, by+2); ctx.lineTo(bx+3, by+2); ctx.lineTo(bx+1.5, by+8); ctx.lineTo(bx-1.5, by+8); ctx.fill();
    ctx.restore();
  }
}

function drawButterfly(b, t){
  const flap = Math.abs(Math.sin(t*14 + b.ph));
  ctx.save(); ctx.translate(b.x, b.y - 40 + Math.sin(t*2+b.ph)*8);
  ctx.fillStyle = `hsl(${b.hue} 85% 62%)`;
  ctx.beginPath(); ctx.ellipse(-5*flap, 0, 6*flap+1, 5, -.4, 0, 7); ctx.ellipse(5*flap, 0, 6*flap+1, 5, .4, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(-.8, -4, 1.6, 8);
  ctx.restore();
}

function drawCottage(){
  const {x,y} = cottage;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y+8, 120, 22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e9d6b0'; ctx.fillRect(x-85, y-90, 170, 95);
  ctx.fillStyle = '#b4452c'; ctx.beginPath(); ctx.moveTo(x-105, y-88); ctx.lineTo(x, y-165); ctx.lineTo(x+105, y-88); ctx.fill();
  ctx.fillStyle = '#6b3d1f'; ctx.fillRect(x-17, y-58, 34, 63);
  ctx.fillStyle = '#9fd4e8'; ctx.fillRect(x-70, y-70, 32, 28); ctx.fillRect(x+38, y-70, 32, 28);
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x+10, y-30, 2.5, 0, 7); ctx.fill();
}

function drawTree(tr){
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(tr.x, tr.y, tr.r*.8, tr.r*.25, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b3a1e'; ctx.fillRect(tr.x-6, tr.y-tr.r*1.2, 12, tr.r*1.2);
  ctx.fillStyle = '#2f6b2a'; ctx.beginPath(); ctx.arc(tr.x, tr.y-tr.r*1.8, tr.r, 0, 7); ctx.arc(tr.x-tr.r*.6, tr.y-tr.r*1.4, tr.r*.7, 0, 7); ctx.arc(tr.x+tr.r*.6, tr.y-tr.r*1.4, tr.r*.7, 0, 7); ctx.fill();
}

// ---------- co-op hooks (net.js fills these in) ----------
const NET = {role:'girl', remote:null, send(){}};
function applyRemoteItem(i){
  if (!Number.isInteger(i) || i < 0 || i >= items.length) return;
  const it = items[i]; if (it.got) return;
  it.got = true; inv[it.type]++;
  for (let k=0;k<10;k++) petals.push({x:it.x, y:it.y-10, vx:(Math.random()-.5)*120, vy:-Math.random()*100, life:1.2, r:3});
  checkProgress(it.type);
}
function applyRemoteCake(){ if (cake) return; cake = true; checkProgress('cake'); }
function updateRemote(dt){
  const R = NET.remote; if (!R || dt <= 0) return;
  const k = Math.min(1, dt*10), ox = R.x, oy = R.y;
  R.x += (R.tx-R.x)*k; R.y += (R.ty-R.y)*k;
  R.vx = (R.x-ox)/dt; R.vy = (R.y-oy)/dt;
  R.walk += Math.hypot(R.vx,R.vy)*dt*.07;
}
const drawChar = (role, t, p, cnt) => role === 'boy' ? drawBoy(t, p, cnt) : drawGirl(t, p, cnt);

function drawBoy(t, p, cnt){
  const d = p.dir, moving = Math.hypot(p.vx,p.vy) > 5;
  const bob = moving ? Math.abs(Math.sin(p.walk))*3 : Math.sin(t*2)*.8;
  const step = moving ? Math.sin(p.walk)*7 : 0;
  const skin = '#e8b890', butter = '#f7e48a', butterDk = '#e6d06a';
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.6, 1.6);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 16, 6, 0, 0, 7); ctx.fill();
  // light blue jeans
  ctx.strokeStyle = '#8ec1ea'; ctx.lineWidth = 5.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.6, -19-bob); ctx.lineTo(-3.6+step, -2); ctx.moveTo(3.6, -19-bob); ctx.lineTo(3.6-step, -2); ctx.stroke();
  ctx.strokeStyle = '#6fa3d2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3.6+step*.5, -14-bob); ctx.lineTo(-3.6+step*.9, -4); ctx.moveTo(3.6-step*.5, -14-bob); ctx.lineTo(3.6-step*.9, -4); ctx.stroke();
  ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.ellipse(-3.6+step+d*1.2, 0, 5, 2.6, 0, 0, 7); ctx.ellipse(3.6-step+d*1.2, 0, 5, 2.6, 0, 0, 7); ctx.fill();
  // butter-yellow shirt
  ctx.fillStyle = butter; ctx.beginPath();
  ctx.moveTo(-8, -38-bob); ctx.quadraticCurveTo(0, -41-bob, 8, -38-bob);
  ctx.lineTo(8.6, -17-bob); ctx.lineTo(-8.6, -17-bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = butterDk; ctx.fillRect(-8.6, -19-bob, 17.2, 2.4);
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-8.2, -17-bob, 16.4, 2.2);
  // arms: short sleeves + forearms
  const asw = step*.5;
  ctx.lineCap = 'round'; ctx.lineWidth = 4;
  ctx.strokeStyle = butter; ctx.beginPath(); ctx.moveTo(-8, -36-bob); ctx.lineTo(-10.5-asw*.4, -31-bob); ctx.moveTo(8, -36-bob); ctx.lineTo(10.5+asw*.4, -31-bob); ctx.stroke();
  ctx.strokeStyle = skin; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(-10.5-asw*.4, -31-bob); ctx.lineTo(-11-asw, -22-bob); ctx.moveTo(10.5+asw*.4, -31-bob); ctx.lineTo(11+asw, -22-bob); ctx.stroke();
  drawBouquet(p, cnt, d, bob);
  // neck + head
  ctx.fillStyle = skin; ctx.fillRect(-2.2, -43-bob, 4.4, 6);
  ctx.beginPath(); ctx.arc(0, -48-bob, 9, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9, -47-bob, 1.6, 2.6, 0, 0, 7); ctx.ellipse(9, -47-bob, 1.6, 2.6, 0, 0, 7); ctx.fill();
  // slight beard (stubble along jaw)
  ctx.save(); ctx.beginPath(); ctx.arc(0, -48-bob, 9, 0, 7); ctx.clip();
  ctx.fillStyle = 'rgba(54,36,26,.62)'; ctx.beginPath(); ctx.ellipse(0, -41.5-bob, 9.4, 6.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(d*1.4, -45.3-bob, 3.4, 1.9, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#9a5a45'; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(d*1.4, -46.3-bob, 2, .25, 2.9); ctx.stroke();
  // wavy swept-back hair with a lifted front quiff
  ctx.fillStyle = '#6a4326';
  ctx.beginPath(); ctx.arc(0, -50-bob, 9.7, Math.PI, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9.5, -51-bob);
  ctx.bezierCurveTo(-11, -63-bob, d*3-3, -68-bob, d*9+1, -59-bob);
  ctx.quadraticCurveTo(d*9, -55-bob, d*4, -55.5-bob);
  ctx.quadraticCurveTo(-3, -54-bob, -9.5, -51-bob); ctx.fill();
  ctx.strokeStyle = '#8a5d38'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(-6, -58-bob); ctx.quadraticCurveTo(-1, -64-bob, d*5, -60-bob);
  ctx.moveTo(-7, -54-bob); ctx.quadraticCurveTo(-2, -59-bob, d*3, -56.5-bob); ctx.stroke();
  // eyes + round specs
  const ex = d*2.2;
  ctx.fillStyle = '#20150e'; ctx.beginPath(); ctx.arc(ex-3.3, -49-bob, 1, 0, 7); ctx.arc(ex+3.3, -49-bob, 1, 0, 7); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(ex-3.3, -49-bob, 3.4, 0, 7); ctx.moveTo(ex+6.7, -49-bob); ctx.arc(ex+3.3, -49-bob, 3.4, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex-.1, -49.4-bob); ctx.lineTo(ex+.1, -49.4-bob); ctx.moveTo(ex-6.7, -49-bob); ctx.lineTo(-9, -48.4-bob); ctx.moveTo(ex+6.7, -49-bob); ctx.lineTo(9, -48.4-bob); ctx.stroke();
  ctx.fillStyle = 'rgba(190,225,255,.18)'; ctx.beginPath(); ctx.arc(ex-3.3, -49-bob, 3.3, 0, 7); ctx.arc(ex+3.3, -49-bob, 3.3, 0, 7); ctx.fill();
  ctx.restore();
}

// ---------- loop ----------
let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now-last)/1000); last = now; const t = now/1000;
  tod = (tod + dt/180) % 1; // full day ~3 min

  // input
  let ix = (keys.d||keys.arrowright?1:0) - (keys.a||keys.arrowleft?1:0);
  let iy = (keys.s||keys.arrowdown?1:0) - (keys.w||keys.arrowup?1:0);
  if (mouse){ const dx = mouse.x - W/2, dy = mouse.y - H/2, m = Math.hypot(dx,dy); if (m>25){ ix = dx/m; iy = dy/m; } }
  const m = Math.hypot(ix,iy) || 1, run = keys.shift ? 1.7 : 1, sp = 190*run*(now<boostUntil ? 1.6 : 1);
  P.vx = ix/m*sp*(ix||iy?1:0); P.vy = iy/m*sp*(ix||iy?1:0);
  let nx = P.x + P.vx*dt, ny = P.y + P.vy*dt;
  nx = Math.max(30, Math.min(WW-30, nx)); ny = Math.max(30, Math.min(WH-30, ny));
  if (!inPond(nx, ny, 12)) { P.x = nx; P.y = ny; }
  else if (!inPond(nx, P.y, 12)) P.x = nx; else if (!inPond(P.x, ny, 12)) P.y = ny;
  if (Math.abs(P.x-cottage.x)<95 && P.y>cottage.y-90 && P.y<cottage.y+8) { P.y = P.y<cottage.y-40 ? cottage.y-90 : cottage.y+8; }
  if (P.vx) P.dir = Math.sign(P.vx);
  P.walk += Math.hypot(P.vx,P.vy)*dt*.07;
  { const dx = P.x-60*P.dir - dog.x, dy = P.y+10 - dog.y, dd = Math.hypot(dx,dy);
    dog.moving = dd > 80;
    if (dog.moving){ const s = Math.min(260, 120 + dd), nx2 = dog.x + dx/dd*s*dt, ny2 = dog.y + dy/dd*s*dt; if (!inPond(nx2, ny2, 10)){ dog.x = nx2; dog.y = ny2; } dog.dir = Math.sign(dx) || dog.dir; } }

  updateRemote(dt);
  for (const b of butterflies){ b.a += (Math.random()-.5)*dt*5; b.x += Math.cos(b.a)*45*dt; b.y += Math.sin(b.a)*45*dt; if (b.x<0||b.x>WW||b.y<0||b.y>WH) b.a += Math.PI; }
  for (let i=flying.length-1;i>=0;i--){ if (now - flying[i].t0 >= 600){ flying.splice(i,1); arrive(); } }
  for (let i=petals.length-1;i>=0;i--){ const p = petals[i]; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 160*dt; p.life -= dt; if (p.life<=0) petals.splice(i,1); }

  const camX = P.x - W/2, camY = P.y - H/2 - 40;
  // ground
  ctx.fillStyle = '#7fb83f'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(-camX, -camY);
  // grass texture
  ctx.fillStyle = '#74ae38';
  const gs = 90;
  for (let gx=Math.floor(camX/gs)*gs; gx<camX+W+gs; gx+=gs) for (let gy=Math.floor(camY/gs)*gs; gy<camY+H+gs; gy+=gs){
    const h = Math.sin(gx*12.9898+gy*78.233)*43758.5453; const r = h-Math.floor(h);
    ctx.beginPath(); ctx.ellipse(gx+r*gs, gy+((r*7)%1)*gs, 26, 8, 0, 0, 7); ctx.fill();
  }
  // pond
  ctx.fillStyle = '#c9b27a'; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.rx+14, pond.ry+10, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(pond.x, pond.y, 20, pond.x, pond.y, pond.rx);
  g.addColorStop(0, '#6cc4e6'); g.addColorStop(1, '#3d93c4');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 2;
  for (let i=0;i<4;i++){ const k = (t*.3+i/4)%1; ctx.globalAlpha = 1-k; ctx.beginPath(); ctx.ellipse(pond.x-60+i*40, pond.y+(i%2?20:-20), 20+k*50, 8+k*18, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;

  drawZones();
  if (cake) drawPicnic();
  // y-sorted draw list
  const list = [];
  const pad = 140, x0 = camX-pad, x1 = camX+W+pad, y0 = camY-pad, y1 = camY+H+pad+160;
  for (const f of flowers) if (f.x>x0 && f.x<x1 && f.y>y0 && f.y<y1) list.push({y:f.y, fn:()=>drawSunflower(f,t)});
  for (const tr of trees) if (tr.x>x0 && tr.x<x1 && tr.y>y0 && tr.y<y1+100) list.push({y:tr.y, fn:()=>drawTree(tr)});
  for (const it of items) if (!it.got && it.x>x0 && it.x<x1 && it.y>y0 && it.y<y1) list.push({y:it.y, fn:()=>drawItem(it,t)});
  if (gold && !finished) list.push({y:gold.y, fn:()=>drawGold(t)});
  list.push({y:cottage.y, fn:drawCottage});
  list.push({y:P.y, fn:()=>drawChar(NET.role, t, P, picked)});
  if (NET.remote) list.push({y:NET.remote.y, fn:()=>drawChar(NET.remote.role, t, NET.remote, NET.remote.n)});
  list.push({y:dog.y, fn:()=>drawDog(t)});
  list.sort((a,b)=>a.y-b.y);
  for (const o of list) o.fn();
  for (const b of butterflies) if (b.x>x0 && b.x<x1 && b.y>y0 && b.y<y1) drawButterfly(b, t);
  for (const p of petals){ ctx.globalAlpha = Math.max(0,p.life/1.6); ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 3, p.life*5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const fl of flying){
    const k = Math.min(1, (now - fl.t0)/600), e = k*k*(3-2*k), h = handPos();
    const x = fl.sx + (h.x - fl.sx)*e, y = fl.sy + (h.y - fl.sy)*e - Math.sin(k*Math.PI)*50, r = 17*(1-e*.7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(k*6);
    ctx.fillStyle = '#ffc61a'; for (let i=0;i<10;i++){ const a = i/10*6.283; ctx.beginPath(); ctx.ellipse(Math.cos(a)*r, Math.sin(a)*r, r*.55, r*.27, a, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5a3412'; ctx.beginPath(); ctx.arc(0, 0, r*.7, 0, 7); ctx.fill();
    ctx.restore();
  }
  drawFireflies(t, Math.max(0, (0.45 - (0.5+0.5*Math.cos(tod*Math.PI*2))) / 0.45), x0, x1, y0, y1);
  // pick hint
  let near = false; for (const f of flowers) if (!f.picked && Math.hypot(f.x-P.x,f.y-P.y)<75){ near = true; break; }
  for (const i of items) if (!i.got && Math.hypot(i.x-P.x,i.y-P.y)<70){ near = true; break; }
  if ((gold && !finished && Math.hypot(gold.x-P.x,gold.y-P.y)<100) || (!cake && inv.berry>=10 && Math.hypot(cottage.x-P.x,cottage.y-P.y)<160)) near = true;
  if (near){ ctx.fillStyle = '#fff'; ctx.font = '16px Georgia'; ctx.textAlign = 'center'; ctx.fillText('press E', P.x, P.y-110); }
  ctx.restore();

  // clouds (parallax shadows)
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  for (const c of clouds){ const cx = ((c.x + t*14*c.s) % (WW+600)) - 300 - camX*1.0, cy = c.y - camY; ctx.beginPath(); ctx.ellipse(cx, cy, 150*c.s, 60*c.s, 0, 0, 7); ctx.fill(); }

  // time-of-day tint: 0.25 = noon-ish golden, 0.5 = sunset, 0.75 = dusk
  const a = tod*Math.PI*2, elev = Math.sin(a - Math.PI/2)*-1; // 1 at tod=.5? normalize below
  const light = 0.5 + 0.5*Math.sin(a + Math.PI/2); // 1 at tod 0
  const dusk = Math.max(0, 1 - light*1.4);
  ctx.fillStyle = `rgba(255,${150+60*light|0},60,${0.08 + dusk*0.22})`; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `rgba(20,20,70,${Math.max(0,(0.35-light)*0.9)})`; ctx.fillRect(0,0,W,H);
  // vignette
  const v = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.4,W/2,H/2,Math.max(W,H)*.75);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(40,20,0,.35)');
  ctx.fillStyle = v; ctx.fillRect(0,0,W,H);
  // compass toward the golden sunflower
  if (gold && !finished){
    const gx = gold.x - P.x, gy = gold.y - 60 - P.y, gd = Math.hypot(gx,gy);
    if (gd > 260){
      const ang = Math.atan2(gy,gx), r = Math.min(W,H)*.4;
      ctx.save(); ctx.translate(W/2 + Math.cos(ang)*r, H/2 + Math.sin(ang)*r); ctx.rotate(ang);
      ctx.globalAlpha = .7 + .3*Math.sin(t*5); ctx.fillStyle = '#ffd93d';
      ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-10,-11); ctx.lineTo(-4,0); ctx.lineTo(-10,11); ctx.fill(); ctx.restore();
    }
  }
  // rainbow after the final mission
  if (finished){
    const cols = ['#ff4d4d','#ff9f43','#ffd93d','#6bd66b','#4da6ff','#8e6bff'];
    ctx.save(); ctx.globalAlpha = .35; ctx.lineWidth = 16;
    cols.forEach((c,i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(W/2, H*1.05, Math.min(W*.5,H*.95)-i*16, Math.PI, 0); ctx.stroke(); });
    ctx.restore();
  }
  requestAnimationFrame(frame);
}
updateMissions();
toast('Welcome to Sunflower Valley 🌻');
requestAnimationFrame(frame);
