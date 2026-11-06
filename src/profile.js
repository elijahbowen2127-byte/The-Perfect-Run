// Player profiles on this device: Admin, named users (name + password, no email) and Guest.
//
// Progress (Perfect Points and shop ranks, unlocks and goal counters, records, skins, last loadout) is kept per
// profile under 'perfectrun.u.<id>.*' (users) or 'perfectrun.admin.*'. Guest progress lives in memory only and is
// gone when the page closes. Settings (controls, audio, graphics) stay shared by the whole device.
// Admin sees everything unlocked and can delete user accounts (Settings > Accounts).
// Passwords are never stored: only a salted PBKDF2 hash.

const ACC = 'perfectrun.accounts', SES = 'perfectrun.session';
const LEGACY = ['meta', 'unlocks', 'records', 'skins', 'loadout', 'p2.skins', 'p2.loadout']; // progress saved before profiles existed
const mem = new Map();
let cur = null;

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch {} };

function accounts() {
  let a = null;
  try { a = JSON.parse(lsGet(ACC) || 'null'); } catch {}
  if (!a || typeof a !== 'object') a = {};
  a.users = Array.isArray(a.users) ? a.users : [];
  return a;
}
const saveAccounts = (a) => lsSet(ACC, JSON.stringify(a));

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
async function hashPw(pw, salt) {
  if (!crypto.subtle) throw new Error('This browser blocks secure sign-in here. Open the game over https.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}
const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);

export const Profile = {
  get cur() { return cur || { kind: 'guest', id: 'guest', name: 'Guest' }; },
  isAdmin() { return !!cur && cur.kind === 'admin'; },
  isGuest() { return !cur || cur.kind === 'guest'; },
  // The name this profile plays under (null for Guest, who picks their own).
  playName() { return cur && cur.kind !== 'guest' ? cur.name : null; },

  // Storage for a progress key such as 'perfectrun.meta'.
  scoped(k) {
    const c = this.cur;
    return c.kind === 'admin' ? k.replace(/^perfectrun\./, 'perfectrun.admin.') : c.kind === 'user' ? k.replace(/^perfectrun\./, 'perfectrun.u.' + c.id + '.') : null;
  },
  get(k) { const s = this.scoped(k); return s ? lsGet(s) : (mem.has(k) ? mem.get(k) : null); },
  set(k, v) { const s = this.scoped(k); if (s) lsSet(s, v); else mem.set(k, v); },

  users() { return accounts().users.map((u) => ({ id: u.id, name: u.name, created: u.created })); },
  hasAdmin() { return !!accounts().admin; },

  // Sign back in to the profile used last on this device (Guest only lasts while the tab is open).
  restore() {
    let s = null;
    try { s = JSON.parse(lsGet(SES) || 'null'); } catch {}
    if (!s) { try { if (sessionStorage.getItem(SES) === 'guest') s = { kind: 'guest' }; } catch {} }
    if (!s) return false;
    const a = accounts();
    if (s.kind === 'admin' && a.admin) { cur = { kind: 'admin', id: 'admin', name: a.admin.name || 'Admin' }; return true; }
    if (s.kind === 'user') { const u = a.users.find((x) => x.id === s.id); if (u) { cur = { kind: 'user', id: u.id, name: u.name }; return true; } }
    if (s.kind === 'guest') { cur = { kind: 'guest', id: 'guest', name: 'Guest' }; return true; }
    return false;
  },
  begin(p) {
    cur = p;
    if (p.kind === 'guest') { lsDel(SES); try { sessionStorage.setItem(SES, 'guest'); } catch {} }
    else { lsSet(SES, JSON.stringify({ kind: p.kind, id: p.id })); try { sessionStorage.removeItem(SES); } catch {} }
  },
  guest() { this.begin({ kind: 'guest', id: 'guest', name: 'Guest' }); },
  signOut() { cur = null; lsDel(SES); try { sessionStorage.removeItem(SES); } catch {} },

  async createUser(name, pw) {
    name = cleanName(name);
    if (name.length < 2) throw new Error('Pick a name with at least 2 letters.');
    if (/^admin$/i.test(name) || /^guest$/i.test(name)) throw new Error('That name is reserved. Pick another one.');
    if (String(pw).length < 4) throw new Error('Use a password with at least 4 characters.');
    const a = accounts();
    if (a.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is taken on this device.');
    const salt = newSalt();
    const u = { id: hex(crypto.getRandomValues(new Uint8Array(6))), name, salt, hash: await hashPw(pw, salt), created: Date.now() };
    // The first account made on a device keeps the progress that was saved before profiles existed.
    if (!a.migrated) {
      a.migrated = 1;
      for (const k of LEGACY) { const v = lsGet('perfectrun.' + k); if (v != null) lsSet('perfectrun.u.' + u.id + '.' + k, v); }
    }
    a.users.push(u);
    saveAccounts(a);
    this.begin({ kind: 'user', id: u.id, name: u.name });
  },
  async signIn(id, pw) {
    const u = accounts().users.find((x) => x.id === id);
    if (!u) throw new Error('That account no longer exists.');
    if ((await hashPw(pw, u.salt)) !== u.hash) throw new Error('Wrong password.');
    this.begin({ kind: 'user', id: u.id, name: u.name });
  },
  async setupAdmin(pw) {
    const a = accounts();
    if (a.admin) throw new Error('The admin password is already set on this device.');
    if (String(pw).length < 4) throw new Error('Use a password with at least 4 characters.');
    const salt = newSalt();
    a.admin = { name: 'Admin', salt, hash: await hashPw(pw, salt) };
    saveAccounts(a);
    this.begin({ kind: 'admin', id: 'admin', name: 'Admin' });
  },
  async signInAdmin(pw) {
    const a = accounts();
    if (!a.admin) throw new Error('No admin password is set on this device yet.');
    if ((await hashPw(pw, a.admin.salt)) !== a.admin.hash) throw new Error('Wrong password.');
    this.begin({ kind: 'admin', id: 'admin', name: a.admin.name || 'Admin' });
  },
  // Admin only: remove an account and everything it saved.
  deleteUser(id) {
    if (!this.isAdmin()) return false;
    const a = accounts();
    const before = a.users.length;
    a.users = a.users.filter((u) => u.id !== id);
    if (a.users.length === before) return false;
    saveAccounts(a);
    const pre = 'perfectrun.u.' + id + '.';
    try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(pre)) localStorage.removeItem(k); } } catch {}
    return true;
  },
};
