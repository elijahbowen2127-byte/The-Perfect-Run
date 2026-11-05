// Bakes an animation clip from one humanoid rig onto another by copying each
// bone's world-space rotation change from its rest pose. Works across Mixamo
// and Ready Player Me rigs whose bones have different local axes.
import * as THREE from 'three';

export const boneKey = (name) => name.replace(/^mixamorig[:_]?/, '').replace(/^.*[:|]/, '');

function bonesOf(root) {
  const map = new Map();
  root.traverse((o) => { if (o.isBone && !map.has(boneKey(o.name))) map.set(boneKey(o.name), o); });
  return map;
}

// Put a rig in its bind pose (the pose the mesh was skinned in).
export function bindPose(root) {
  const done = new Set();
  root.traverse((o) => { if (o.isSkinnedMesh && !done.has(o.skeleton)) { done.add(o.skeleton); o.skeleton.pose(); } });
  root.updateMatrixWorld(true);
}

// Rigs face different ways (+Z or -Z); find the yaw that makes the left arm point +X.
function facing(root, bones) {
  root.updateMatrixWorld(true);
  const a = bones.get('LeftArm'), f = bones.get('LeftForeArm');
  const q = new THREE.Quaternion();
  if (!a || !f) return q;
  const d = f.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3()));
  return q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-d.z, d.x));
}

function restWorld(root, bones) {
  root.updateMatrixWorld(true);
  const out = new Map();
  for (const [k, b] of bones) out.set(k, b.getWorldQuaternion(new THREE.Quaternion()));
  return out;
}

// Snapshot local transforms so we can restore the rest pose.
function saveLocal(bones) {
  const s = new Map();
  for (const [k, b] of bones) s.set(k, [b.position.clone(), b.quaternion.clone()]);
  return s;
}
function loadLocal(bones, s) { for (const [k, b] of bones) { const v = s.get(k); b.position.copy(v[0]); b.quaternion.copy(v[1]); } }

/**
 * src: { root, clip } with root at its rest pose. tgt: root at its rest pose.
 * Returns a clip with quaternion tracks for every shared bone, plus a scaled
 * hips height track so crouches and jumps keep their weight.
 */
export function retargetClip(srcRoot, clip, tgtRoot, { fps = 30, hipsMove = true } = {}) {
  const sb = bonesOf(srcRoot), tb = bonesOf(tgtRoot);
  const keys = [...tb.keys()].filter((k) => sb.has(k));
  const sSave = saveLocal(sb), tSave = saveLocal(tb);
  const sRest = restWorld(srcRoot, sb), tRest = restWorld(tgtRoot, tb);
  const Fs = facing(srcRoot, sb), Ft = facing(tgtRoot, tb), FsI = Fs.clone().invert(), FtI = Ft.clone().invert();
  const srcHips = sb.get('Hips'), tgtHips = tb.get('Hips');
  const sHipY = srcHips ? srcHips.getWorldPosition(new THREE.Vector3()).y : 1;
  const tHipY = tgtHips ? tgtHips.getWorldPosition(new THREE.Vector3()).y : 1;
  const hipScale = sHipY > 0.0001 ? tHipY / sHipY : 1;
  const tHipLocal = tgtHips ? tgtHips.position.clone() : null;
  const tHipParentInv = tgtHips && tgtHips.parent ? tgtHips.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const sHipRestW = srcHips ? srcHips.getWorldPosition(new THREE.Vector3()) : null;
  const tHipRestW = tgtHips ? tgtHips.getWorldPosition(new THREE.Vector3()) : null;

  const mixer = new THREE.AnimationMixer(srcRoot);
  const action = mixer.clipAction(clip); action.play();
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(n);
  const vals = new Map(keys.map((k) => [k, new Float32Array(n * 4)]));
  const hipVals = new Float32Array(n * 3);
  // Order target bones parent-first so parent world rotations are ready.
  const order = [];
  tgtRoot.traverse((o) => { if (o.isBone && keys.includes(boneKey(o.name)) && tb.get(boneKey(o.name)) === o) order.push(boneKey(o.name)); });
  const delta = new THREE.Quaternion(), w = new THREE.Quaternion(), pw = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const tWorld = new Map();
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, (i / (n - 1)) * clip.duration);
    times[i] = t;
    mixer.setTime(t);
    srcRoot.updateMatrixWorld(true);
    tWorld.clear();
    for (const k of order) {
      const s = sb.get(k), tbn = tb.get(k);
      s.getWorldQuaternion(w);
      delta.copy(w).multiply(sRest.get(k).clone().invert());
      // Move the change into the target's facing: Ft * Fs^-1 * delta * Fs * Ft^-1.
      delta.premultiply(FsI).multiply(Fs).premultiply(Ft).multiply(FtI);
      const tw = delta.clone().multiply(tRest.get(k));
      tWorld.set(k, tw);
      // Parent world rotation on the target: from an already-solved parent, else its rest.
      let p = tbn.parent; let pk = p && p.isBone ? boneKey(p.name) : null;
      if (pk && tWorld.has(pk)) pw.copy(tWorld.get(pk));
      else if (p) p.getWorldQuaternion(pw); else pw.identity();
      const local = pw.clone().invert().multiply(tw);
      local.toArray(vals.get(k), i * 4);
    }
    if (tgtHips && srcHips && hipsMove) {
      srcHips.getWorldPosition(tmp);
      const d = tmp.sub(sHipRestW).multiplyScalar(hipScale);
      const wp = tHipRestW.clone().add(new THREE.Vector3(0, d.y, 0)).applyMatrix4(tHipParentInv);
      wp.toArray(hipVals, i * 3);
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcRoot);
  loadLocal(sb, sSave); loadLocal(tb, tSave);
  srcRoot.updateMatrixWorld(true); tgtRoot.updateMatrixWorld(true);
  const tracks = order.map((k) => new THREE.QuaternionKeyframeTrack(tb.get(k).name + '.quaternion', times, vals.get(k)));
  if (tgtHips && srcHips && hipsMove) tracks.push(new THREE.VectorKeyframeTrack(tgtHips.name + '.position', times, hipVals));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Some rigs (e.g. the Veteran) are skinned in an A-pose with bent forearms and ship no T-pose
// clip. Retargeting copies each bone's rotation CHANGE from the X Bot's T-pose, so on such a
// rig the arms would be rotated down a second time and fold across or behind the body. This
// bakes the arms into a true T-pose (upper arm, forearm and hand along the side axis) so the
// X Bot's deltas land where they were authored.
export function tposeArms(root) {
  const bones = bonesOf(root);
  root.updateMatrixWorld(true);
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const q = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
  for (const side of ['Left', 'Right']) {
    const arm = bones.get(side + 'Arm'), fore = bones.get(side + 'ForeArm'), hand = bones.get(side + 'Hand');
    const mid = bones.get(side + 'HandMiddle1');
    if (!arm || !fore || !hand) continue;
    const sgn = Math.sign(wp(fore).x - wp(arm).x) || 1;
    const aim = new THREE.Vector3(sgn, 0, 0);
    for (const [b, child] of [[arm, fore], [fore, hand], [hand, mid]]) {
      if (!b || !child) continue;
      const d = wp(child).sub(wp(b)).normalize();
      q.setFromUnitVectors(d, aim);
      b.getWorldQuaternion(qw);
      qw.premultiply(q);
      b.parent.getWorldQuaternion(qp);
      b.quaternion.copy(qp.invert().multiply(qw));
      b.updateMatrixWorld(true);
    }
  }
  root.updateMatrixWorld(true);
}
