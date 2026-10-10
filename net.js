// Two-player co-op over WebRTC (PeerJS, bundled locally as peerjs.min.js).
// Fixed roles: whoever creates the room plays the boy, whoever joins plays the girl.
// Everything received from the other player is untrusted: it is type-checked,
// clamped and rate-limited, and never rendered as HTML.
(() => {
  const $ = id => document.getElementById(id);
  const PREFIX = 'sunflower-valley-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I, L, O, 0, 1
  const validCode = c => typeof c === 'string' && c.length === 6 && [...c].every(ch => ALPHA.includes(ch));
  const newCode = () => { const b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map(v => ALPHA[v % ALPHA.length]).join(''); };
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : null;

  let peer = null, conn = null, isHost = false, code = '', sendTimer = 0, joinTimer = 0, connected = false;
  let tokens = 60, lastRefill = performance.now();

  const status = msg => { $('mpstatus').textContent = msg; };
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };

  function teardown(msg){
    clearInterval(sendTimer); clearTimeout(joinTimer);
    NET.remote = null; NET.send = () => {}; NET.role = 'girl';
    connected = false;
    try { if (conn) conn.close(); } catch(e) {}
    try { if (peer) peer.destroy(); } catch(e) {}
    conn = peer = null;
    show('mpact', true); show('mpshare', false);
    status(msg || 'Playing solo. One of you creates a room, the other joins with the code.');
  }

  function allowMessage(){
    const now = performance.now();
    tokens = Math.min(60, tokens + (now - lastRefill) / 1000 * 40); lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  }

  function startRemote(role){
    if (connected) return;
    connected = true;
    NET.remote = {x:P.x, y:P.y, tx:P.x, ty:P.y, dir:1, vx:0, vy:0, walk:0, n:0, role};
    NET.send = msg => { if (conn && conn.open) conn.send(msg); };
    clearInterval(sendTimer);
    sendTimer = setInterval(() => NET.send({t:'s', x:Math.round(P.x), y:Math.round(P.y), d:P.dir, n:picked}), 66);
    clearTimeout(joinTimer);
    show('mpact', false); show('mpshare', false);
    status('Connected! You are the ' + NET.role + '. Explore together 🌻');
    toast('Together in the valley 👫');
  }

  function onData(d){
    if (!allowMessage() || !d || typeof d !== 'object') return;
    switch (d.t){
      case 'hi':                                     // host (boy) greets the guest (girl)
        if (!isHost && d.r === 'boy') startRemote('boy');
        break;
      case 'ack':                                    // guest confirms; host starts showing the girl
        if (isHost) startRemote('girl');
        break;
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

  function wire(c){
    conn = c;
    c.on('data', onData);
    c.on('close', () => { if (conn === c) teardown('Your friend left. Back to solo.'); });
    c.on('error', e => { if (conn === c) teardown('Connection problem (' + (e && e.type || 'unknown') + '). Back to solo.'); });
  }

  function host(){
    teardown(); isHost = true; NET.role = 'boy';
    status('Creating room…'); show('mpact', false);
    let tries = 0;
    const open = () => {
      code = newCode();
      peer = new Peer(PREFIX + code, {debug: 0});
      peer.on('open', () => {
        $('mpc').textContent = code; show('mpshare', true);
        status('Room ready. Send her the link and this code, and keep this tab open.');
      });
      peer.on('connection', c => {
        if (conn) { c.on('open', () => c.close()); return; }   // two players max
        wire(c);
        c.on('open', () => c.send({t:'hi', r:'boy'}));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch(e) {} });
      peer.on('error', err => {
        if (err.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch(e) {} open(); }
        else teardown('Could not create a room (' + (err.type || 'unknown') + '). Check your internet and try again.');
      });
    };
    open();
  }

  function join(c){
    if (!validCode(c)) { status('That code does not look right. It is 6 letters/numbers.'); return; }
    teardown(); isHost = false; code = c; NET.role = 'girl';
    status('Connecting…'); show('mpact', false);
    peer = new Peer({debug: 0});
    peer.on('open', () => {
      const dc = peer.connect(PREFIX + code, {serialization: 'json', reliable: true});
      wire(dc);
      dc.on('open', () => dc.send({t:'ack'}));
      joinTimer = setTimeout(() => { if (!connected) teardown('Could not connect. Check the code, and make sure he has created the room and kept his tab open.'); }, 15000);
    });
    peer.on('error', err => {
      teardown(err.type === 'peer-unavailable'
        ? 'No room with that code. Ask him to create the room first and keep his tab open.'
        : 'Could not connect (' + (err.type || 'unknown') + '). Try again, or switch networks (for example mobile data).');
    });
  }

  const siteUrl = () => location.origin + location.pathname;
  $('mpbtn').addEventListener('click', () => { const p = $('mp'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; });
  $('mphost').addEventListener('click', host);
  $('mpjoin').addEventListener('click', () => join($('mpcode').value.trim().toUpperCase()));
  $('mpcode').addEventListener('keydown', e => { if (e.key === 'Enter') join($('mpcode').value.trim().toUpperCase()); });
  $('mpcopy').addEventListener('click', () => {
    const text = 'Open ' + siteUrl() + ' , tap "Play together", choose "Join with a code" and enter: ' + code;
    const done = () => status('Invite copied. Send it to her.');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => status(text)); else status(text);
  });
})();
