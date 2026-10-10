// Two-player co-op over WebRTC (PeerJS, bundled locally as peerjs.min.js).
// Everything received from the other player is untrusted: it is type-checked,
// clamped and rate-limited, and never rendered as HTML or text.
(() => {
  const $ = id => document.getElementById(id);
  const PREFIX = 'sunflower-valley-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I, L, O, 0, 1
  const validCode = c => typeof c === 'string' && c.length === 6 && [...c].every(ch => ALPHA.includes(ch));
  const newCode = () => {
    const b = new Uint8Array(6); crypto.getRandomValues(b);
    return [...b].map(v => ALPHA[v % ALPHA.length]).join('');
  };
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : null;

  let peer = null, conn = null, isHost = false, code = '', sendTimer = 0, joinTimer = 0;
  let tokens = 60, lastRefill = performance.now();

  const status = msg => { $('mpstatus').textContent = msg; };
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };

  function teardown(msg){
    clearInterval(sendTimer); clearTimeout(joinTimer);
    NET.remote = null; NET.send = () => {}; NET.role = 'girl';
    try { if (conn) conn.close(); } catch(e) {}
    try { if (peer) peer.destroy(); } catch(e) {}
    conn = peer = null;
    show('mpact', true); show('mpshare', false);
    status(msg || 'Playing solo. Invite a friend to explore the valley with you.');
  }

  function allowMessage(){
    const now = performance.now();
    tokens = Math.min(60, tokens + (now - lastRefill) / 1000 * 40); lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  }

  function onData(d){
    if (!allowMessage() || !d || typeof d !== 'object') return;
    switch (d.t){
      case 'hi': {                                   // host announces its role; guest takes the other
        if (isHost || (d.r !== 'girl' && d.r !== 'boy')) return;
        NET.role = d.r === 'girl' ? 'boy' : 'girl';
        startRemote(d.r);
        break;
      }
      case 'ack': {                                  // guest confirms; host starts rendering the guest
        if (!isHost) return;
        startRemote(NET.role === 'girl' ? 'boy' : 'girl');
        break;
      }
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

  function startRemote(role){
    NET.remote = {x:P.x, y:P.y, tx:P.x, ty:P.y, dir:1, vx:0, vy:0, walk:0, n:0, role};
    NET.send = msg => { if (conn && conn.open) conn.send(msg); };
    clearInterval(sendTimer);
    sendTimer = setInterval(() => NET.send({t:'s', x:Math.round(P.x), y:Math.round(P.y), d:P.dir, n:picked}), 66);
    clearTimeout(joinTimer);
    show('mpact', false); show('mpshare', isHost);
    status(isHost ? 'Friend joined! Explore together.' : 'Connected! Explore together.');
    toast('Your friend is here 👫');
  }

  function wire(c){
    conn = c;
    c.on('data', onData);
    c.on('close', () => { if (conn === c) teardown('Your friend left. Back to solo.'); });
    c.on('error', () => { if (conn === c) teardown('Connection problem. Back to solo.'); });
  }

  function host(role){
    teardown(); isHost = true; NET.role = role;
    let tries = 0;
    const open = () => {
      code = newCode();
      peer = new Peer(PREFIX + code, {debug: 0});
      peer.on('open', () => {
        $('mpc').textContent = code; show('mpact', false); show('mpshare', true);
        status('Room ready. Share the code or link and wait for your friend…');
      });
      peer.on('connection', c => {
        if (conn) { c.on('open', () => c.close()); return; }   // two players max
        wire(c);
        c.on('open', () => c.send({t:'hi', r:role}));
      });
      peer.on('error', err => {
        if (err.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch(e) {} open(); }
        else teardown('Could not create a room. Check your connection and try again.');
      });
    };
    open();
  }

  function join(c){
    if (!validCode(c)) { status('That code does not look right.'); return; }
    teardown(); isHost = false; code = c;
    status('Connecting…'); show('mpact', false);
    peer = new Peer({debug: 0});
    peer.on('open', () => {
      const dc = peer.connect(PREFIX + code, {serialization: 'json', reliable: true});
      wire(dc);
      dc.on('open', () => dc.send({t:'ack'}));
      joinTimer = setTimeout(() => { if (!NET.remote) teardown('Could not find that room. Check the code.'); }, 12000);
    });
    peer.on('error', () => teardown('Could not connect. Check the code and try again.'));
  }

  $('mpbtn').addEventListener('click', () => { const p = $('mp'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; });
  $('mphostg').addEventListener('click', () => host('girl'));
  $('mphostb').addEventListener('click', () => host('boy'));
  $('mpjoin').addEventListener('click', () => join($('mpcode').value.trim().toUpperCase()));
  $('mpcopy').addEventListener('click', () => {
    const url = location.origin + location.pathname + '?room=' + code;
    const done = () => status('Invite link copied. Send it to your friend.');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => status(url)); else status(url);
  });

  const room = new URLSearchParams(location.search).get('room');
  if (room && validCode(room.toUpperCase())){ $('mp').style.display = 'block'; join(room.toUpperCase()); }
})();
