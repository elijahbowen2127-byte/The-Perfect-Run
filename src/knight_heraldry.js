// Painted heraldry and cloth textures for the knight designs (canvas, drawn once per skin).
import * as THREE from 'three';
import { canvasTex, css, weathering, hash, TAU } from './knight_kit.js';

// A charge painted on cloth: cross / chevron / bars, centred at (cx, cy) in a box w x h.
export function drawCharge(g, kind, cx, cy, w, h, C, o = {}) {
  const em = css(C.emblem), dark = 'rgba(0,0,0,0.35)';
  g.save();
  const fillShape = (draw) => {
    g.fillStyle = em; draw(); g.fill();
    g.strokeStyle = o.outline || 'rgba(40,20,15,0.55)'; g.lineWidth = o.lw || 2.5; g.stroke();
  };
  if (kind === 'cross') {
    const t = w * 0.2;
    fillShape(() => { g.beginPath(); g.moveTo(cx - t / 2, cy - h / 2); g.lineTo(cx + t / 2, cy - h / 2); g.lineTo(cx + t / 2, cy - t * 0.9); g.lineTo(cx + w / 2, cy - t * 0.9); g.lineTo(cx + w / 2, cy + t * 0.1); g.lineTo(cx + t / 2, cy + t * 0.1); g.lineTo(cx + t / 2, cy + h / 2); g.lineTo(cx - t / 2, cy + h / 2); g.lineTo(cx - t / 2, cy + t * 0.1); g.lineTo(cx - w / 2, cy + t * 0.1); g.lineTo(cx - w / 2, cy - t * 0.9); g.lineTo(cx - t / 2, cy - t * 0.9); g.closePath(); });
  } else if (kind === 'chevron') {
    for (let k = 0; k < 2; k++) {
      const yy = cy + k * h * 0.34, t = h * 0.13;
      fillShape(() => { g.beginPath(); g.moveTo(cx - w / 2, yy + h * 0.22); g.lineTo(cx, yy - h * 0.12); g.lineTo(cx + w / 2, yy + h * 0.22); g.lineTo(cx + w / 2, yy + h * 0.22 + t); g.lineTo(cx, yy - h * 0.12 + t); g.lineTo(cx - w / 2, yy + h * 0.22 + t); g.closePath(); });
    }
    for (let k = -1; k <= 1; k++) fillShape(() => { g.beginPath(); g.arc(cx + k * w * 0.3, cy - h * 0.36, w * 0.07, 0, TAU); });
  } else if (kind === 'bars') {
    const t = h * 0.13;
    for (let k = 0; k < 3; k++) fillShape(() => { g.beginPath(); g.rect(cx - w / 2, cy - h / 2 + k * h * 0.36, w, t); });
  }
  g.restore();
}

// Tabard / surcoat panel pair: front tile on the left half, back tile on the right half of a 1024 x 1024 canvas.
export function heraldryTexture(C, design = 1) {
  return canvasTex(1024, 1024, (g, W, H) => {
    for (let side = 0; side < 2; side++) {
      const x0 = side * 512;
      g.fillStyle = css(C.tabard); g.fillRect(x0, 0, 512, H);
      // woven stripe shading and a darker lining at the edges
      for (let i = 0; i < 512; i += 3) { g.fillStyle = `rgba(0,0,0,${0.018 + 0.02 * hash(i + side)})`; g.fillRect(x0 + i, 0, 1, H); }
      const edge = g.createLinearGradient(x0, 0, x0 + 512, 0); edge.addColorStop(0, 'rgba(60,40,30,0.35)'); edge.addColorStop(0.05, 'rgba(60,40,30,0)'); edge.addColorStop(0.95, 'rgba(60,40,30,0)'); edge.addColorStop(1, 'rgba(60,40,30,0.35)');
      g.fillStyle = edge; g.fillRect(x0, 0, 512, H);
      // hem band
      g.fillStyle = css(C.trim); g.fillRect(x0, H * 0.935, 512, H * 0.03);
      g.fillStyle = css(C.tabard2); g.fillRect(x0, H * 0.905, 512, H * 0.028);
      g.fillStyle = css(C.tabard2); g.fillRect(x0 + 6, 0, 10, H); g.fillRect(x0 + 496, 0, 10, H);
      // charge
      const kind = C.heraldry || 'cross';
      g.save(); g.beginPath(); g.rect(x0, 0, 512, H); g.clip();
      drawCharge(g, kind, x0 + 256, H * (kind === 'cross' ? 0.34 : 0.3), 330, kind === 'cross' ? 560 : 420, C);
      weathering(g, 512, H, 0.7, side + 3);
      g.restore();
    }
  });
}

// Long surcoat: one 2048 x 1024 canvas wrapped round the body (u = 0.5 is the front centre, u = 0 / 1 the back centre).
export function surcoatTexture(C) {
  return canvasTex(2048, 1024, (g, W, H) => {
    g.fillStyle = css(C.tabard); g.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i += 3) { g.fillStyle = `rgba(0,0,0,${0.015 + 0.02 * hash(i)})`; g.fillRect(i, 0, 1, H); }
    for (let j = 0; j < H; j += 4) { g.fillStyle = `rgba(255,255,255,${0.012 + 0.015 * hash(j + 77)})`; g.fillRect(0, j, W, 1); }
    // hem trim and a faint lining shadow
    g.fillStyle = css(C.tabard2); g.fillRect(0, H * 0.955, W, H * 0.045);
    g.fillStyle = css(C.trim); g.fillRect(0, H * 0.948, W, 4);
    const kind = C.heraldry || 'cross';
    for (const cx of [W * 0.5, 0, W]) {
      g.save(); g.beginPath(); g.rect(cx - 400, 0, 800, H); g.clip();
      if (kind === 'cross') {
        // a broad cross pattee: stem from the collar to the hem, arms level with the chest
        const stem = 118, arm = 300, sy = H * 0.05, cy = H * 0.24;
        g.fillStyle = css(C.emblem); g.beginPath();
        g.moveTo(cx - stem / 2, sy); g.lineTo(cx + stem / 2, sy); g.lineTo(cx + stem / 2, cy - stem * 0.6); g.lineTo(cx + arm, cy - stem * 0.6); g.lineTo(cx + arm, cy + stem * 0.45); g.lineTo(cx + stem / 2, cy + stem * 0.45); g.lineTo(cx + stem / 2, H * 0.94); g.lineTo(cx - stem / 2, H * 0.94); g.lineTo(cx - stem / 2, cy + stem * 0.45); g.lineTo(cx - arm, cy + stem * 0.45); g.lineTo(cx - arm, cy - stem * 0.6); g.lineTo(cx - stem / 2, cy - stem * 0.6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(50,20,15,0.45)'; g.lineWidth = 3; g.stroke();
      } else drawCharge(g, kind, cx, H * 0.34, 520, 620, C);
      g.restore();
    }
    weathering(g, W, H, 1.6, 11);
  }, true);
}

// Kite shield: 512 x 768, the device painted over a worn field with an iron-bound rim.
export function shieldTexture(C) {
  return canvasTex(512, 768, (g, W, H) => {
    g.fillStyle = css(C.tabard); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,70,50,${0.02 + 0.04 * hash(i)})`; g.fillRect(hash(i + 3) * W, 0, 1 + hash(i + 9) * 2, H); } // plank grain
    const kind = C.heraldry || 'cross';
    if (kind === 'cross') {
      g.fillStyle = css(C.emblem);
      g.fillRect(W * 0.5 - 40, 40, 80, H - 120); g.fillRect(40, H * 0.26 - 40, W - 80, 80);
      g.strokeStyle = 'rgba(40,15,10,0.5)'; g.lineWidth = 3; g.strokeRect(W * 0.5 - 40, 40, 80, H - 120); g.strokeRect(40, H * 0.26 - 40, W - 80, 80);
    } else drawCharge(g, kind, W / 2, H * 0.38, W * 0.7, H * 0.55, C);
    // worn edges, scratches and the colour flaking away at the rim
    g.strokeStyle = 'rgba(30,20,12,0.55)'; g.lineWidth = 16; g.strokeRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(230,225,215,${0.05 + 0.1 * hash(i + 40)})`; g.lineWidth = 1; g.beginPath(); const x = hash(i) * W, y = hash(i + 5) * H; g.moveTo(x, y); g.lineTo(x + (hash(i + 8) - 0.5) * 70, y + (hash(i + 2) - 0.5) * 70); g.stroke(); }
    weathering(g, W, H, 0.8, 5);
  });
}
