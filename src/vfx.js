// Spell effects that need more than particles: the 唤魂 (soul raising) channel —
// a rune circle marking the area around the summoner, a smaller one under every corpse, and streams of soul wisps
// flowing from each corpse into the summoner's hands.
import * as THREE from 'three';
import { glowSprite } from './gfx.js';

function runeTex() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), m = S / 2;
  g.translate(m, m); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const ring = (r, w, a = 1) => { g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  ring(m - 8, 6); ring(m - 22, 2, 0.8); ring(m * 0.62, 3, 0.9); ring(m * 0.56, 1.5, 0.6);
  // rune marks between the outer rings
  for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.globalAlpha = 0.9; g.lineWidth = 3; g.beginPath();
    const r0 = m - 52, k = i % 3; if (k === 0) { g.moveTo(-8, -r0 - 14); g.lineTo(0, -r0 + 10); g.lineTo(8, -r0 - 14); } else if (k === 1) { g.moveTo(0, -r0 - 16); g.lineTo(0, -r0 + 12); g.moveTo(-7, -r0 - 2); g.lineTo(7, -r0 - 2); }
    else { g.arc(0, -r0, 9, 0.3, Math.PI * 2 - 0.3); } g.stroke(); g.restore(); }
  // inner star
  g.globalAlpha = 0.75; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5, r = m * 0.56; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke();
  // soft glow fill
  g.globalAlpha = 1; const gr = g.createRadialGradient(0, 0, 0, 0, 0, m); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
let RUNE = null;
export function runeCircle(radius, col, opacity) {
  RUNE = RUNE || runeTex();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: RUNE, color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.renderOrder = 3; return m;
}
const COL = 0x5ff6e6, WISPS = 7;
// one channel: create on cast, update every frame with the summoner's position and the channel progress k (0..1), dispose at the end
export class SoulChannel {
  constructor(scene, P, corpses, radius) {
    this.scene = scene; this.g = new THREE.Group(); scene.add(this.g); this.t = 0;
    this.area = runeCircle(radius, COL, 0); this.g.add(this.area);
    this.me = runeCircle(1.1, COL, 0); this.g.add(this.me);
    this.links = corpses.map(c => { const ring = runeCircle(0.75, COL, 0); ring.position.set(c.x, 0.04, c.z); this.g.add(ring);
      const wisps = []; for (let i = 0; i < WISPS; i++) { const s = glowSprite(i % 3 ? COL : 0xe8fffc, i % 3 ? 0.55 : 0.32, 0.9); this.g.add(s); wisps.push({ s, ph: i / WISPS, side: (Math.random() - 0.5) * 1.4 }); }
      const core = glowSprite(COL, 1.3, 0.0); core.position.set(c.x, 0.35, c.z); this.g.add(core);
      return { c, ring, wisps, core }; });
  }
  update(dt, P, k, parts) {
    this.t += dt; const fadeIn = Math.min(1, this.t * 5), pulse = 0.85 + Math.sin(this.t * 10) * 0.15;
    this.area.position.set(P.x, 0.035, P.z); this.area.rotation.y += dt * 0.25; this.area.material.opacity = 0.32 * fadeIn * pulse;
    this.me.position.set(P.x, 0.045, P.z); this.me.rotation.y -= dt * 1.4; this.me.material.opacity = (0.7 + 0.3 * k) * fadeIn; this.me.scale.setScalar(0.9 + 0.25 * k);
    const hx = P.x + Math.sin(P.face) * 0.35, hz = P.z + Math.cos(P.face) * 0.35, hy = 1.05;
    for (const L of this.links) { const c = L.c; L.ring.rotation.y += dt * 2.2; L.ring.material.opacity = (0.55 + 0.45 * k) * fadeIn; L.ring.scale.setScalar(1 + 0.15 * Math.sin(this.t * 8));
      L.core.material.opacity = (0.35 + 0.5 * k) * fadeIn; L.core.scale.setScalar(1.0 + 0.6 * k);
      const mx = (c.x + hx) / 2, mz = (c.z + hz) / 2, dx = hx - c.x, dz = hz - c.z, d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
      for (const w of L.wisps) { const u = (w.ph + this.t * (0.9 + 0.6 * k)) % 1, iu = 1 - u, bend = Math.sin(this.t * 3 + w.ph * 9) * 0.35 + w.side;
        // quadratic bezier: corpse -> raised, slightly bent middle -> summoner's hands
        const cx = mx + nx * bend, cz = mz + nz * bend, cy = 1.4 + d * 0.12;
        w.s.position.set(iu * iu * c.x + 2 * iu * u * cx + u * u * hx, iu * iu * 0.35 + 2 * iu * u * cy + u * u * hy, iu * iu * c.z + 2 * iu * u * cz + u * u * hz);
        w.s.material.opacity = Math.sin(Math.PI * u) * 0.95 * fadeIn; }
      if (Math.random() < dt * 14) parts.emit(c.x, 0.2, c.z, 1, { col: COL, spd: 0.25, up: 1.4, grav: -0.8, life: 0.7, size: 0.22, spread: 0.5 }); }
  }
  drop(c) { const i = this.links.findIndex(L => L.c === c); if (i < 0) return; const L = this.links[i]; for (const o of [L.ring, L.core, ...L.wisps.map(w => w.s)]) this.g.remove(o); this.links.splice(i, 1); }
  dispose() { this.scene.remove(this.g); this.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}

// ---------- the crypt door portal: a sheet of swirling blue light filling a doorway (w × h, bottom edge at y = 0) ----------
export function portalMesh(w, h) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uA: { value: w / h } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uT, uA;
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * uA, vUv.y - 0.45);                  // aspect-correct, centre a little below the middle
        float r = length(p), a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 16.0 - uT * 2.6) * 0.5 + sin(a * 5.0 - r * 22.0 + uT * 1.7) * 0.35 + sin(r * 30.0 - uT * 4.0) * 0.15;
        float band = smoothstep(0.1, 0.9, sw * 0.5 + 0.5);
        vec3 col = mix(vec3(0.03, 0.10, 0.30), vec3(0.25, 0.80, 1.0), band * 0.75);
        col += vec3(0.55, 0.9, 1.0) * exp(-r * r * 9.0) * (0.55 + 0.15 * sin(uT * 3.3));  // bright core
        float e = min(min(vUv.x, 1.0 - vUv.x) * uA, 1.0 - vUv.y);                      // distance to the frame
        col += vec3(0.5, 0.95, 1.0) * smoothstep(0.12, 0.0, e) * 0.9;                    // bright rim along the frame
        float rise = fract(vUv.y * 3.0 - uT * 0.6); col += vec3(0.3, 0.7, 1.0) * smoothstep(0.92, 1.0, rise) * 0.25 * (1.0 - vUv.y);
        float fade = smoothstep(0.0, 0.06, vUv.y);                                        // softer where it meets the floor
        gl_FragColor = vec4(col * fade * (0.85 + 0.15 * sin(uT * 2.0)), 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
}
