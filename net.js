// Two-player co-op through a public MQTT-over-WebSocket relay (mqtt.js, bundled locally).
// Both browsers connect OUT to the relay, so no direct peer link (WebRTC/NAT) is needed.
// Roles are fixed: whoever creates the room plays the boy, whoever joins plays the girl.
// Everything received is untrusted: size-limited, type-checked, clamped, rate-limited,
// accepted only from the one paired player, and never rendered as HTML.
(() => {
  const $ = id => document.getElementById(id);
  const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];  // both used at once for reliability
  const ROOT = 'sunflower-valley-v2/';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I, L, O, 0, 1
  const rand = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(v => ALPHA[v % ALPHA.length]).join(''); };
  const validCode = c => typeof c === 'string' && c.length === 6 && [...c].every(ch => ALPHA.includes(ch));
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : null;
  const dec = new TextDecoder();

  let clients = [], topic = '', me = rand(8), partner = '', isHost = false, code = '', connected = false;
  let sendTimer = 0, helloTimer = 0, giveUpTimer = 0, relayTimer = 0, watchTimer = 0, lastSeen = 0, relayReady = false;
  let tokens = 120, lastRefill = performance.now();

  const status = msg => { $('mpstatus').textContent = msg; };
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };

  function pub(obj){
    if (!topic) return;
    const s = JSON.stringify(Object.assign({}, obj, {f: me}));
    for (const c of clients) if (c.connected) { try { c.publish(topic, s, {qos: 0}); } catch(e) {} }
  }

  function clearTimers(){ clearInterval(sendTimer); clearInterval(helloTimer); clearInterval(watchTimer); clearTimeout(giveUpTimer); clearTimeout(relayTimer); }

  function teardown(msg){
    if (topic && connected) pub({t:'bye'});
    clearTimers();
    for (const c of clients) { try { c.end(true); } catch(e) {} }
    clients = []; topic = ''; partner = ''; connected = false; relayReady = false;
    NET.remote = null; NET.send = () => {}; NET.role = 'girl';
    show('mpact', true); show('mpshare', false);
    status(msg || 'Playing solo. One of you creates a room, the other joins with the code.');
  }

  function allowMessage(){
    const now = performance.now();
    tokens = Math.min(120, tokens + (now - lastRefill) / 1000 * 80); lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  }

  function startRemote(role){
    if (connected) return;
    connected = true; lastSeen = performance.now();
    NET.remote = {x:P.x, y:P.y, tx:P.x, ty:P.y, dir:1, vx:0, vy:0, walk:0, n:0, role};
    NET.send = msg => { if (connected) pub(msg); };
    clearInterval(helloTimer); clearTimeout(giveUpTimer);
    clearInterval(sendTimer);
    sendTimer = setInterval(() => pub({t:'s', x:Math.round(P.x), y:Math.round(P.y), d:P.dir, n:picked}), 80);
    clearInterval(watchTimer);
    watchTimer = setInterval(() => { if (connected && performance.now() - lastSeen > 9000) lostPartner('Your friend disconnected.'); }, 2000);
    show('mpact', false); show('mpshare', false);
    status('Connected! You are the ' + NET.role + '. Explore together 🌻');
    toast('Together in the valley 👫');
  }

  function lostPartner(msg){
    if (!isHost) { teardown(msg + ' Back to solo.'); return; }
    // host stays in the room so she can rejoin with the same code
    connected = false; partner = ''; NET.remote = null; NET.send = () => {};
    clearInterval(sendTimer); clearInterval(watchTimer);
    show('mpshare', true);
    status(msg + ' The room is still open. She can rejoin with the same code.');
  }

  function onMessage(payload){
    if (!payload || payload.length > 600) return;
    let d; try { d = JSON.parse(dec.decode(payload)); } catch(e) { return; }
    if (!d || typeof d !== 'object' || typeof d.f !== 'string' || d.f.length !== 8 || d.f === me) return;
    if (!allowMessage()) return;

    if (d.t === 'join') {                         // guest knocking; host pairs with the first one
      if (!isHost) return;
      if (!partner) partner = d.f;
      if (d.f !== partner) return;
      pub({t:'hi', to: d.f});
      startRemote('girl'); lastSeen = performance.now();
      return;
    }
    if (d.t === 'hi') {                           // host answering the guest
      if (isHost || d.to !== me || connected) return;
      partner = d.f; startRemote('boy');
      return;
    }
    if (d.f !== partner || !connected) return;    // everything else: only from the paired player
    lastSeen = performance.now();
    switch (d.t) {
      case 'bye': lostPartner('Your friend left.'); break;
      case 's': {
        const R = NET.remote; if (!R) return;
        const x = num(d.x, 0, WW), y = num(d.y, 0, WH), n = num(d.n, 0, 9999);
        if (x === null || y === null || n === null) return;
        R.tx = x; R.ty = y; R.dir = d.d === -1 ? -1 : 1; R.n = Math.floor(n);
        break;
      }
      case 'i': applyRemoteItem(d.i); break;
      case 'c': applyRemoteCake(); break;
    }
  }

  function openRelays(onReady){
    topic = ROOT + code;
    relayTimer = setTimeout(() => { if (!relayReady) teardown('Could not reach the game relay. Your network may block it. Try mobile data or another Wi-Fi.'); }, 15000);
    for (const url of BROKERS) {
      let c;
      try { c = mqtt.connect(url, {clean: true, connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 30, clientId: 'sv_' + me + '_' + rand(4)}); } catch(e) { continue; }
      c.on('connect', () => {
        c.subscribe(topic, {qos: 0}, err => {
          if (err) return;
          if (!relayReady) { relayReady = true; clearTimeout(relayTimer); onReady(); }
        });
      });
      c.on('message', (t, payload) => onMessage(payload));
      c.on('error', () => {});
      clients.push(c);
    }
  }

  function host(){
    teardown(); isHost = true; NET.role = 'boy'; code = rand(6);
    $('mpc').textContent = code; show('mpact', false); show('mpshare', true);
    status('Connecting to the relay…');
    openRelays(() => status('Room ready! Send her the code and keep this tab open.'));
  }

  function join(c){
    if (!validCode(c)) { status('That code does not look right. It has 6 letters/numbers.'); return; }
    teardown(); isHost = false; NET.role = 'girl'; code = c;
    show('mpact', false);
    status('Connecting to the relay…');
    openRelays(() => {
      status('Looking for the room…');
      pub({t:'join'});
      helloTimer = setInterval(() => pub({t:'join'}), 1000);
      giveUpTimer = setTimeout(() => teardown('No one is in room ' + c + '. Check the code, and make sure he has created the room and kept his tab open.'), 25000);
    });
  }

  addEventListener('beforeunload', () => { if (connected) pub({t:'bye'}); });

  const siteUrl = () => location.origin + location.pathname;
  $('mpbtn').addEventListener('click', () => { const p = $('mp'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; });
  $('mphost').addEventListener('click', host);
  $('mpjoin').addEventListener('click', () => join($('mpcode').value.trim().toUpperCase()));
  $('mpcode').addEventListener('keydown', e => { if (e.key === 'Enter') join($('mpcode').value.trim().toUpperCase()); });
  $('mpcopy').addEventListener('click', () => {
    const text = 'Open ' + siteUrl() + ' , tap "Play together", type this code and press Join: ' + code;
    const done = () => status('Invite copied. Send it to her.');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => status(text)); else status(text);
  });

  const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if (validCode(room)) { $('mp').style.display = 'block'; $('mpcode').value = room; }
})();
