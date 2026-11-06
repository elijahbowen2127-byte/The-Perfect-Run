// Networking. Everything is "presence": each player publishes one object
// (their state + recent events) and reads everyone else's. The host also
// publishes the world. Three transports share that model:
//  - RoomParty: claude.ai artifact live room (when opened from the Claude link)
//  - PeerParty: WebRTC via PeerJS (when hosted anywhere else, e.g. GitHub Pages)
//  - BCParty:   BroadcastChannel between tabs on one machine (local testing)
// Solo play uses SoloParty with the exact same interface.

const FLUSH_MS = 50;
const randId = () => Math.random().toString(36).slice(2, 10);

export function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

class BaseParty {
  constructor() {
    this.mine = {};
    this.pending = null;
    this.listeners = new Set();
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
    this.status = 'connecting';
  }
  set(patch) {
    Object.assign(this.mine, patch);
    this.pending = Object.assign(this.pending || {}, patch);
  }
  flush() {}
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emitChange() { for (const f of this.listeners) f(); }
  leave() { clearInterval(this.timer); }
}

export class SoloParty extends BaseParty {
  constructor() { super(); this.myId = 'solo'; this.kind = 'solo'; this.status = 'ok'; }
  peers() { return [{ id: this.myId, me: true, p: this.mine }]; }
}

// ---------- couch co-op: two seats in one page share an in-memory hub ----------
const LOCAL_WATCH = ['n', 'ch', 'sk', 'c', 'rdy', 'ls', 'ig', 'host', 'cd']; // presence keys that wake the other seat (sk = skin; per-frame keys like sb/sl are read directly, no wake needed)
export const makeLocalHub = () => ({ members: new Map() });
export class LocalParty extends BaseParty {
  constructor(hub, id) {
    super();
    this.kind = 'local'; this.hub = hub; this.myId = id; this.status = 'ok';
    hub.members.set(id, this);
    for (const m of hub.members.values()) if (m !== this) m.emitChange();
  }
  // The other seat reads our presence directly, so wake it the moment something it shows
  // (name, pick, step, ready, in-game) changes. Per-frame fields are ignored to stay cheap.
  set(patch) {
    let changed = false;
    for (const k of LOCAL_WATCH) if (k in patch && this.mine[k] !== patch[k]) { changed = true; break; }
    if (!changed && patch.wp && String(patch.wp) !== String(this.mine.wp)) changed = true;
    super.set(patch);
    if (changed) for (const m of this.hub.members.values()) if (m !== this) m.emitChange();
  }
  peers() {
    const out = [{ id: this.myId, me: true, p: this.mine }];
    for (const [id, m] of this.hub.members) if (m !== this) out.push({ id, me: false, p: m.mine });
    return out;
  }
  leave() { super.leave(); this.hub.members.delete(this.myId); for (const m of this.hub.members.values()) m.emitChange(); }
}

// ---------- claude.ai artifact room ----------
let roomPromise = null;
export function getRoom() {
  if (roomPromise) return roomPromise;
  roomPromise = (async () => {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return null;
      return await window.claude.use('room');
    } catch { return null; }
  })();
  return roomPromise;
}

export class RoomLobby {
  constructor(room) {
    this.room = room;
    this.kind = 'room';
    this.listeners = new Set();
    this.off = room.onPeers(() => { for (const f of this.listeners) f(); }, () => {});
  }
  parties() {
    const out = [];
    for (const p of this.room.peers()) {
      const pr = p.presence && p.presence.party;
      if (pr && typeof pr.code === 'string') out.push({ ...pr, me: p.isMe });
    }
    return out;
  }
  advertise(info) { this.room.presence({ party: info || null }).catch(() => {}); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

export class RoomParty extends BaseParty {
  static async create(room, code) {
    const nr = await room.join('pr-' + code.toLowerCase());
    return new RoomParty(nr);
  }
  constructor(nr) {
    super();
    this.nr = nr;
    this.kind = 'room';
    this.myId = null;
    this.status = 'ok';
    this.off = nr.onPeers(() => this.emitChange(), (e) => { this.status = 'error:' + e.code; this.emitChange(); });
  }
  flush() {
    if (!this.pending) return;
    const patch = this.pending;
    this.pending = null;
    this.nr.presence(patch).catch((e) => { this.lastError = e && e.code; });
  }
  peers() {
    const list = this.nr.peers();
    const out = [];
    let sawMe = false;
    for (const p of list) {
      const me = p.isMe && p.sameTab;
      if (me) { this.myId = p.peer; sawMe = true; out.push({ id: p.peer, me: true, p: this.mine }); }
      else if (p.kind === 'viewer') out.push({ id: p.peer, me: false, p: p.presence || {} });
    }
    if (!sawMe) out.push({ id: this.myId || 'me', me: true, p: this.mine });
    return out;
  }
  leave() { super.leave(); this.off && this.off(); this.nr.leave().catch(() => {}); }
}

// ---------- BroadcastChannel (same machine, multiple tabs) ----------
export class BCLobby {
  constructor() {
    this.kind = 'bc';
    this.id = randId();
    this.ch = new BroadcastChannel('perfect-run-lobby');
    this.seen = new Map();
    this.info = null;
    this.listeners = new Set();
    this.ch.onmessage = (e) => {
      const m = e.data;
      if (m.id === this.id) return;
      if (m.info) this.seen.set(m.id, { info: m.info, at: Date.now() });
      else this.seen.delete(m.id);
      for (const f of this.listeners) f();
    };
    this.timer = setInterval(() => {
      this.ch.postMessage({ id: this.id, info: this.info });
      const now = Date.now();
      for (const [k, v] of this.seen) if (now - v.at > 3000) this.seen.delete(k);
    }, 500);
  }
  parties() {
    const out = [...this.seen.values()].map((v) => v.info);
    if (this.info) out.push({ ...this.info, me: true });
    return out;
  }
  advertise(info) { this.info = info; this.ch.postMessage({ id: this.id, info }); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

export class BCParty extends BaseParty {
  constructor(code) {
    super();
    this.kind = 'bc';
    this.myId = randId();
    this.ch = new BroadcastChannel('perfect-run-' + code);
    this.table = new Map();
    this.status = 'ok';
    this.ch.onmessage = (e) => {
      const m = e.data;
      if (m.bye) { this.table.delete(m.id); this.emitChange(); return; }
      const had = this.table.has(m.id);
      this.table.set(m.id, { p: m.p, at: Date.now() });
      if (!had) this.emitChange();
    };
    this.lastFull = 0;
  }
  flush() {
    const now = Date.now();
    if (this.pending || now - this.lastFull > 500) {
      this.pending = null;
      this.lastFull = now;
      this.ch.postMessage({ id: this.myId, p: this.mine });
    }
    for (const [k, v] of this.table) if (now - v.at > 4000) { this.table.delete(k); this.emitChange(); }
  }
  peers() {
    const out = [{ id: this.myId, me: true, p: this.mine }];
    for (const [id, v] of this.table) out.push({ id, me: false, p: v.p });
    return out;
  }
  leave() { super.leave(); this.ch.postMessage({ id: this.myId, bye: true }); this.ch.close(); }
}

// ---------- PeerJS / WebRTC (star topology through the host) ----------
let peerLib = null;
function loadPeerJS() {
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    if (window.Peer) return res(window.Peer);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(window.Peer);
    s.onerror = () => { peerLib = null; rej(new Error('Could not load the multiplayer library')); };
    document.head.appendChild(s);
  });
  return peerLib;
}

// Relay options (tests point this at a local PeerServer; the game uses the free public PeerJS relay).
const peerOpts = () => (typeof window !== 'undefined' && window.__peerOpts) || {};

// ---------- Quickplay without a server of our own (GitHub site) ----------
// The public PeerJS relay cannot list games, but it does refuse a name that is already taken. So every public party
// hosted on the site claims one numbered spot (perfect-run-qp-0 .. 19) while it sits in the lobby. Finding games means
// knocking on all the spots at once: an open party answers with its code, name and head count, then hangs up.
export const QP_SLOTS = 20;
const qpId = (i) => 'perfect-run-qp-' + i;
export class PeerSlotLobby {
  constructor() { this.kind = 'peer'; this.info = null; this.slot = null; this.claiming = false; this.found = []; this.listeners = new Set(); }
  parties() { return this.found.slice(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const f of this.listeners) f(); }
  advertise(info) {
    this.info = info || null;
    if (this.info && !this.slot && !this.claiming) this.claim().catch(() => {});
    else if (!this.info && this.slot) { const s = this.slot; this.slot = null; try { s.destroy(); } catch {} }
  }
  async claim() {
    this.claiming = true;
    try {
      const Peer = await loadPeerJS();
      const order = [...Array(QP_SLOTS).keys()].sort(() => Math.random() - 0.5);
      for (const i of order) {
        if (!this.info) return;
        const p = await new Promise((res) => {
          let opened = false;
          const peer = new Peer(qpId(i), peerOpts());
          const t = setTimeout(() => { try { peer.destroy(); } catch {} res(null); }, 8000);
          peer.on('open', () => { opened = true; clearTimeout(t); res(peer); });
          peer.on('error', () => { if (opened) return; clearTimeout(t); try { peer.destroy(); } catch {} res(null); });
        });
        if (!p) continue;
        if (!this.info) { try { p.destroy(); } catch {} return; }
        this.slot = p;
        p.on('connection', (c) => {
          c.on('open', () => { c.send({ t: 'qp', info: this.info }); setTimeout(() => { try { c.close(); } catch {} }, 1500); });
        });
        p.on('disconnected', () => { if (this.slot === p) { try { p.reconnect(); } catch {} } });
        return;
      }
    } finally { this.claiming = false; }
  }
  // Knock on every spot for a few seconds and keep whoever answers.
  async scan(ms = 6000) {
    const Peer = await loadPeerJS();
    const me = new Peer(peerOpts());
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Could not reach the game relay. Check your connection and try again.')), 10000);
      me.on('open', () => { clearTimeout(t); res(); });
      me.on('error', () => { if (me.open) return; clearTimeout(t); rej(new Error('Could not reach the game relay. Check your connection and try again.')); });
    });
    const found = new Map();
    let n = 0, done = 0, finish;
    const over = new Promise((r) => { finish = r; setTimeout(r, ms); });
    const tick = () => { if (++done >= n) finish(); };
    me.on('error', (e) => { if (e && e.type === 'peer-unavailable') tick(); }); // an empty spot answers fast
    for (let i = 0; i < QP_SLOTS; i++) {
      if (this.slot && this.slot.id === qpId(i)) continue;
      n++;
      const c = me.connect(qpId(i), { reliable: true, serialization: 'json' });
      c.on('data', (m) => { if (m && m.t === 'qp' && m.info && typeof m.info.code === 'string') found.set(m.info.code, m.info); tick(); });
    }
    await over;
    try { me.destroy(); } catch {}
    this.found = [...found.values()];
    this.emit();
    return this.found;
  }
}

export class PeerParty extends BaseParty {
  static async create(code, asHost) {
    const Peer = await loadPeerJS();
    const party = new PeerParty(code, asHost);
    await party.start(Peer);
    return party;
  }
  constructor(code, asHost) {
    super();
    this.kind = 'peer';
    this.code = code;
    this.asHost = asHost;
    this.table = new Map(); // id -> presence (host: from clients; client: from host relay)
    this.conns = new Map();
    this.hostConn = null;
    this.lastSent = 0;
  }
  start(Peer) {
    const hostId = 'perfect-run-' + this.code.toLowerCase();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting')), 15000);
      this.peer = this.asHost ? new Peer(hostId, peerOpts()) : new Peer(peerOpts());
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        this.status = 'error:' + (err.type || 'unknown');
        this.emitChange();
        reject(new Error(err.type === 'unavailable-id' ? 'That party code is already in use' : err.type === 'peer-unavailable' ? 'Party not found' : 'Connection failed (' + err.type + ')'));
      });
      this.peer.on('open', (id) => {
        this.myId = id;
        if (this.asHost) {
          this.status = 'ok';
          this.peer.on('connection', (conn) => {
            conn.on('open', () => { this.conns.set(conn.peer, conn); this.emitChange(); });
            conn.on('data', (m) => { if (m && m.t === 'p') { this.table.set(conn.peer, m.p); } });
            conn.on('close', () => { this.conns.delete(conn.peer); this.table.delete(conn.peer); this.emitChange(); });
          });
          clearTimeout(timeout);
          resolve();
        } else {
          const conn = this.peer.connect(hostId, { reliable: true, serialization: 'json' });
          this.hostConn = conn;
          conn.on('open', () => { this.status = 'ok'; clearTimeout(timeout); resolve(); });
          conn.on('data', (m) => {
            if (m && m.t === 'all') {
              const prev = this.table.size;
              this.table = new Map(Object.entries(m.ps).filter(([k]) => k !== this.myId));
              if (this.table.size !== prev) this.emitChange();
            }
          });
          conn.on('close', () => { this.status = 'closed'; this.table.clear(); this.emitChange(); });
        }
      });
    });
  }
  flush() {
    const now = Date.now();
    if (this.asHost) {
      const ps = { [this.myId]: this.mine };
      for (const [k, v] of this.table) ps[k] = v;
      const msg = { t: 'all', ps };
      for (const c of this.conns.values()) if (c.open) c.send(msg);
    } else if (this.hostConn && this.hostConn.open && (this.pending || now - this.lastSent > 500)) {
      this.pending = null;
      this.lastSent = now;
      this.hostConn.send({ t: 'p', p: this.mine });
    }
  }
  peers() {
    const out = [{ id: this.myId, me: true, p: this.mine }];
    for (const [id, p] of this.table) out.push({ id, me: false, p });
    return out;
  }
  leave() { super.leave(); try { this.peer && this.peer.destroy(); } catch {} }
}
