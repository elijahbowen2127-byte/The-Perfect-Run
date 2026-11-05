// Name tags for teammates: a crisp DOM tag above each player's head (name, health, distance).
// Teammates off screen get the same tag pinned to the screen edge with an arrow, so
// everyone can find each other quickly. Styles are injected here to keep the tag self-contained.
import * as THREE from 'three';
import { CLASS_BY_ID } from './data.js';

const CSS = `
.ally-tags { position: absolute; inset: 0; pointer-events: none; z-index: 12; overflow: hidden; }
.ally-tag { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; will-change: transform; --c: #fff; }
.ally-tag .at-name { font: 700 15px/1 var(--ui, system-ui), sans-serif; letter-spacing: .04em; color: var(--c); text-shadow: 0 1px 3px #000, 0 0 8px rgba(0,0,0,.8); white-space: nowrap; }
.ally-tag .at-bar { width: 64px; height: 5px; border-radius: 3px; background: rgba(0,0,0,.65); box-shadow: 0 0 0 1px rgba(0,0,0,.5); overflow: hidden; }
.ally-tag .at-bar i { display: block; height: 100%; background: linear-gradient(90deg, #ff5a4a, #6dff8a); transform-origin: left; }
.ally-tag .at-dist { font: 600 11px/1 var(--ui, system-ui), sans-serif; color: rgba(255,255,255,.75); text-shadow: 0 1px 2px #000; }
.ally-tag .at-arrow { display: none; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 14px solid var(--c); filter: drop-shadow(0 0 3px #000); }
.ally-tag.edge .at-arrow { display: block; }
.ally-tag.down .at-name { opacity: .55; text-decoration: line-through; }
.ally-tag.down .at-bar { display: none; }
.ally-tag .at-pip { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 9px solid var(--c); filter: drop-shadow(0 1px 2px #000); }
.ally-tag.edge .at-pip { display: none; }
.ally-tag.cseat .at-name::before { content: attr(data-seat); display: inline-block; margin-right: 5px; padding: 1px 5px; border-radius: 4px; font-size: 11px; letter-spacing: .08em; color: #0b0810; text-shadow: none; background: #4aa3ff; vertical-align: 1px; }
.ally-tag.cseat.p2 .at-name::before { background: #ff9a3c; }
`;

const _v = new THREE.Vector3();

export class AllyTags {
  constructor(game) {
    this.game = game;
    if (!document.getElementById('ally-tags-css')) {
      const s = document.createElement('style'); s.id = 'ally-tags-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    this.layer = document.createElement('div');
    this.layer.className = 'ally-tags';
    game.root.appendChild(this.layer);
    this.tags = new Map();
  }

  make(id) {
    const el = document.createElement('div');
    el.className = 'ally-tag';
    el.innerHTML = '<div class="at-arrow"></div><div class="at-name"></div><div class="at-bar"><i></i></div><div class="at-dist"></div><div class="at-pip"></div>';
    this.layer.appendChild(el);
    const t = { el, name: el.children[1], bar: el.children[2].firstChild, dist: el.children[3], arrow: el.children[0], last: '' };
    this.tags.set(id, t);
    return t;
  }

  // Leaving a game: drop every tag and hide the layer, so no name lingers over the lobby or the title.
  clear() { for (const t of this.tags.values()) t.el.remove(); this.tags.clear(); this.layer.style.display = 'none'; }

  update() {
    const g = this.game;
    if (g.mode !== 'game' || !g.player) { this.layer.style.display = 'none'; return; }
    this.layer.style.display = '';
    const W = g.vw(), H = g.vh(), cam = g.camera;
    cam.updateMatrixWorld();
    const seen = new Set();
    for (const pr of g.party.peers()) {
      if (pr.me || !pr.p || !pr.p.ig) continue;
      const v = g.views.players.get(pr.id);
      if (!v || !v.model.visible) continue;
      seen.add(pr.id);
      const t = this.tags.get(pr.id) || this.make(pr.id);
      const p = pr.p, cls = CLASS_BY_ID[p.c];
      const name = String(p.n || 'Player').slice(0, 16);
      if (t.last !== name) { t.name.textContent = name; t.last = name; }
      // Couch co-op: a coloured "P1" / "P2" chip so the tag matches that seat's frame colour.
      if (t.seat === undefined) { const sn = g.party.kind === 'local' && !g.bot && /^p[12]$/.test(pr.id) ? pr.id : ''; t.seat = sn; if (sn) { t.name.dataset.seat = sn.toUpperCase(); t.el.classList.add('cseat', sn); } }
      t.el.style.setProperty('--c', cls ? cls.css : '#fff');
      t.el.classList.toggle('down', !p.al);
      t.bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (p.hp || 0) / (p.mh || 100))) + ')';
      _v.set(v.pos.x, v.pos.y + 2.5 * (v.size || 1), v.pos.z); // above the head, even on a duel-sized fighter
      const d = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z);
      t.dist.textContent = Math.round(d) + ' m';
      _v.project(cam);
      let x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
      let edge = false, rot = 0;
      if (_v.z > 1) { x = W - x; y = H; edge = true; } // behind the camera: flip to the opposite side
      const m = 46;
      if (x < m || x > W - m || y < m + 18 || y > H - m - 30) {
        edge = true;
        const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
        const k = Math.min((W / 2 - m) / (Math.abs(dx) || 1e-3), (H / 2 - m - 24) / (Math.abs(dy) || 1e-3));
        x = cx + dx * k; y = cy + dy * k; rot = Math.atan2(dy, dx) + Math.PI / 2;
      }
      t.el.classList.toggle('edge', edge);
      t.arrow.style.transform = 'rotate(' + rot + 'rad)';
      t.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%, -100%)';
    }
    for (const [id, t] of this.tags) if (!seen.has(id)) { t.el.remove(); this.tags.delete(id); }
  }
}
