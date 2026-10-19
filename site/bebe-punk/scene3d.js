/* Le monstre et le bébé punk — la scène 3D (19/10/2026).
   Des biberons-grenades tombent du ciel, traversent le brouillard et la cendre,
   et sont aspirés par le trou noir en bas de l'écran : Fall. Jump. Repeat.
   On clique dessus : feu orange et geyser de lait. Three.js r160, version exacte. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const COUL = {
  kaki: 0x59603f, metal: 0x9aa0a6, tetine: 0xeadfc4, bleu: 0x3aa2ff,
  orange: 0xff8a2b, feu: 0xffc070, lait: 0xf3eee2, boue: 0x2a2018, brume: 0x1b1d20
};

/* ---------------------------------------------------------------- textures dessinées */
function texturePoint(doux) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(doux ? 0.25 : 0.5, 'rgba(255,255,255,.85)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------------------------------------------------------------- le biberon-grenade */
function fabriquerGrenade() {
  const groupe = new THREE.Group();
  // corps : un ananas de fonte, tourné puis cabossé en quadrillage
  const profil = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, y = -0.72 + t * 1.38;
    const r = 0.5 * Math.pow(Math.sin(Math.PI * (0.04 + t * 0.92)), 0.75);
    profil.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  const corpsGeo = new THREE.LatheGeometry(profil, 28);
  const pos = corpsGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.4) * Math.pow(Math.abs(Math.cos(v.y * 7.5)), 0.4);
    v.x *= k; v.z *= k; pos.setXYZ(i, v.x, v.y, v.z);
  }
  corpsGeo.computeVertexNormals();
  const corps = new THREE.Mesh(corpsGeo, new THREE.MeshStandardMaterial({ color: COUL.kaki, roughness: 0.62, metalness: 0.35, flatShading: true }));
  groupe.add(corps);
  const metal = new THREE.MeshStandardMaterial({ color: COUL.metal, roughness: 0.32, metalness: 0.9 });
  // bague du biberon
  const bague = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.22, 18), metal);
  bague.position.y = 0.72; groupe.add(bague);
  // tétine
  const pt = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = t < 0.25 ? 0.19 - t * 0.3 : 0.11 - (t - 0.25) * 0.08 + 0.03 * Math.sin(Math.min(1, (t - 0.25) / 0.75) * Math.PI);
    pt.push(new THREE.Vector2(Math.max(0.005, t > 0.97 ? 0.005 : r), t * 0.46));
  }
  const tetine = new THREE.Mesh(new THREE.LatheGeometry(pt, 18), new THREE.MeshStandardMaterial({ color: COUL.tetine, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.92 }));
  tetine.position.y = 0.82; groupe.add(tetine);
  // levier et goupille
  const levier = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.13), metal);
  levier.position.set(0.3, 0.42, 0); levier.rotation.z = -0.12; groupe.add(levier);
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 22), metal);
  anneau.position.set(0.2, 0.74, 0.12); anneau.rotation.y = 1.1; groupe.add(anneau);
  return groupe;
}

/* ---------------------------------------------------------------- le trou noir (tourbillon) */
function fabriquerTrou() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTemps: { value: 0 }, uForce: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTemps; uniform float uForce;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float bruit(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float tourbillon = a + 2.6 / (r + 0.18) - uTemps * 1.4 * uForce;
        float bandes = 0.5 + 0.5 * sin(tourbillon * 5.0 + bruit(vec2(a * 3.0, r * 8.0 - uTemps)) * 3.0);
        float grain = bruit(vec2(tourbillon * 2.0, r * 14.0));
        vec3 boue = mix(vec3(0.09,0.07,0.05), vec3(0.32,0.29,0.27), bandes * grain);
        boue = mix(boue, vec3(0.55,0.57,0.6), smoothstep(0.75, 1.0, r) * 0.5);
        float fond = smoothstep(0.42, 0.12, r);
        vec3 c = mix(boue, vec3(0.0), fond);
        c += vec3(0.23,0.64,1.0) * smoothstep(0.18, 0.0, abs(r - 0.36)) * 0.10 * uForce;
        float alpha = smoothstep(1.0, 0.82, r);
        gl_FragColor = vec4(c, alpha);
      }`
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
}

/* ---------------------------------------------------------------- la scène */
export function demarrer(canvas, opts = {}) {
  const calme = !!opts.calme, petit = !!opts.petit;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !petit, powerPreference: 'low-power' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, petit ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COUL.brume, 0.035);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.HemisphereLight(0xaab0b8, 0x1a1410, 1.1));
  const lune = new THREE.DirectionalLight(0xdfe6ee, 1.1); lune.position.set(-4, 6, 6); scene.add(lune);
  const crete = new THREE.DirectionalLight(COUL.bleu, 1.8); crete.position.set(5, -2, -4); scene.add(crete);
  const feu = new THREE.PointLight(COUL.orange, 0, 14, 1.6); scene.add(feu);
  const braise = new THREE.PointLight(COUL.orange, 0.6, 9, 2); scene.add(braise);

  // dimensions visibles au plan z = 0
  let L = 10, H = 10;
  function tailles() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    H = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    L = H * camera.aspect;
  }
  tailles();

  /* le trou */
  const trouGroupe = new THREE.Group();
  const trou = fabriquerTrou();
  trouGroupe.add(trou);
  trouGroupe.rotation.x = -1.15;
  scene.add(trouGroupe);
  let rayonTrou = 1.5, rayonCible = 1.5, finale = 0;

  /* particules en spirale autour du trou */
  const NS = petit ? 160 : 320;
  const spiraleGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(NS * 3), sr = new Float32Array(NS), sa = new Float32Array(NS);
  for (let i = 0; i < NS; i++) { sr[i] = Math.random(); sa[i] = Math.random() * Math.PI * 2; }
  spiraleGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spirale = new THREE.Points(spiraleGeo, new THREE.PointsMaterial({ size: 0.07, map: texturePoint(true), color: 0xb9bcc0, transparent: true, opacity: 0.7, depthWrite: false }));
  trouGroupe.add(spirale);

  /* cendre et brouillard en suspension */
  const NC = petit ? 260 : 600;
  const cendreGeo = new THREE.BufferGeometry();
  const cp = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) { cp[i * 3] = (Math.random() - 0.5) * 30; cp[i * 3 + 1] = (Math.random() - 0.5) * 20; cp[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1; }
  cendreGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const cendre = new THREE.Points(cendreGeo, new THREE.PointsMaterial({ size: 0.06, map: texturePoint(false), color: 0x9a9ea4, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(cendre);
  const brumeGeo = new THREE.BufferGeometry();
  const NB = petit ? 14 : 26, bp = new Float32Array(NB * 3);
  for (let i = 0; i < NB; i++) { bp[i * 3] = (Math.random() - 0.5) * 26; bp[i * 3 + 1] = (Math.random() - 0.5) * 14; bp[i * 3 + 2] = -3 - Math.random() * 4; }
  brumeGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const brume = new THREE.Points(brumeGeo, new THREE.PointsMaterial({ size: 9, map: texturePoint(true), color: 0x7d8288, transparent: true, opacity: 0.07, depthWrite: false }));
  scene.add(brume);

  /* explosions : feu (additif) et lait (opaque, avec gravité) */
  function systeme(n, taille, additif) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3).fill(9999), c = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.PointsMaterial({ size: taille, map: texturePoint(!additif), vertexColors: true, transparent: true, depthWrite: false,
      blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    return { pts, p, c, v: new Float32Array(n * 3), vie: new Float32Array(n), n, i: 0 };
  }
  const flammes = systeme(petit ? 220 : 420, 0.32, true);
  const lait = systeme(petit ? 220 : 420, 0.2, false);
  const coulFeu = [new THREE.Color(COUL.orange), new THREE.Color(COUL.feu), new THREE.Color(0xff5a1a)];
  const coulLait = [new THREE.Color(COUL.lait), new THREE.Color(0xfffaf0), new THREE.Color(0x3b2e22)];
  function emettre(s, centre, nombre, vitesse, couleurs, haut) {
    for (let k = 0; k < nombre; k++) {
      const i = s.i; s.i = (s.i + 1) % s.n;
      s.p[i * 3] = centre.x; s.p[i * 3 + 1] = centre.y; s.p[i * 3 + 2] = centre.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      const f = vitesse * (0.35 + Math.random() * 0.65);
      s.v[i * 3] = Math.cos(a) * Math.cos(e) * f;
      s.v[i * 3 + 1] = Math.sin(e) * f * 0.6 + haut * (0.6 + Math.random());
      s.v[i * 3 + 2] = Math.sin(a) * Math.cos(e) * f;
      s.vie[i] = 1;
      const c = couleurs[(Math.random() * couleurs.length) | 0];
      s.c[i * 3] = c.r; s.c[i * 3 + 1] = c.g; s.c[i * 3 + 2] = c.b;
    }
  }
  function animerSysteme(s, dt, gravite, frein, usure) {
    for (let i = 0; i < s.n; i++) {
      if (s.vie[i] <= 0) continue;
      s.vie[i] -= dt * usure;
      if (s.vie[i] <= 0) { s.p[i * 3 + 1] = 9999; continue; }
      s.v[i * 3 + 1] -= gravite * dt;
      s.v[i * 3] *= frein; s.v[i * 3 + 1] *= frein; s.v[i * 3 + 2] *= frein;
      s.p[i * 3] += s.v[i * 3] * dt; s.p[i * 3 + 1] += s.v[i * 3 + 1] * dt; s.p[i * 3 + 2] += s.v[i * 3 + 2] * dt;
      const k = Math.max(0, s.vie[i]);
      s.c[i * 3] *= 0.985 + 0.015 * k; s.c[i * 3 + 1] *= 0.975 + 0.025 * k; s.c[i * 3 + 2] *= 0.97 + 0.03 * k;
    }
    s.pts.geometry.attributes.position.needsUpdate = true;
    s.pts.geometry.attributes.color.needsUpdate = true;
  }

  /* les biberons-grenades */
  const modele = fabriquerGrenade();
  const N = petit ? 5 : 8;
  const grenades = [];
  function placer(g, auHasard) {
    g.userData.etat = 'chute';
    g.userData.t = 0;
    g.userData.x0 = (Math.random() - 0.5) * L * 0.9;
    g.position.set(g.userData.x0, auHasard ? (Math.random() - 0.1) * H * 0.6 : H / 2 + 1 + Math.random() * 3, (Math.random() - 0.5) * 3);
    g.userData.v = 1.1 + Math.random() * 1.0;
    g.userData.rot = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2);
    const e = (petit ? 0.5 : 0.62) + Math.random() * 0.35;
    g.userData.echelle = e; g.scale.setScalar(e);
    g.visible = true;
  }
  for (let i = 0; i < N; i++) {
    const g = modele.clone(true);
    g.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    placer(g, true);
    scene.add(g); grenades.push(g);
  }
  // la vedette : une grande grenade qui tourne près du titre (écrans larges seulement)
  const vedette = modele.clone(true);
  vedette.scale.setScalar(1.35);
  vedette.userData = { etat: 'vedette', echelle: 1.35 };
  scene.add(vedette);

  function exploser(g) {
    const c = g.getWorldPosition(new THREE.Vector3());
    emettre(flammes, c, petit ? 70 : 140, 6, coulFeu, 0.8);
    emettre(lait, c, petit ? 80 : 160, 4.2, coulLait, 4.5);
    feu.position.copy(c); feu.intensity = 60;
    secousse = 0.35;
    g.visible = false;
    g.userData.etat = 'detruite'; g.userData.t = 0;
  }

  /* ---------------------------------------------------------------- boucle */
  const horloge = new THREE.Clock();
  let actif = true, enBoucle = false, secousse = 0, temps = 0, progression = 0;
  const pos3 = new THREE.Vector3();

  function miseEnPlace() {
    const bas = -H / 2;
    // le trou grandit quand on arrive au trou final de la page
    rayonCible = Math.min(L, H) * (0.16 + 0.26 * finale);
    // au trou final, il remonte au-dessus du pied de page
    trouGroupe.position.set(0, bas + rayonCible * 0.32 + H * 0.3 * finale, 0);
    const large = camera.aspect > 1.15;
    vedette.visible = large && vedette.userData.etat === 'vedette';
    vedette.position.set(L * 0.3, H * 0.08, 1.5);
  }

  function image(dt) {
    temps += dt;
    miseEnPlace();
    rayonTrou += (rayonCible - rayonTrou) * Math.min(1, dt * 3);
    trouGroupe.scale.setScalar(rayonTrou);
    trou.material.uniforms.uTemps.value = temps;
    trou.material.uniforms.uForce.value = 1 + finale;
    braise.position.set(trouGroupe.position.x, trouGroupe.position.y + 0.4, 1.5);
    braise.intensity = 0.5 + Math.sin(temps * 7) * 0.15 + Math.random() * 0.15;

    // spirale aspirée
    for (let i = 0; i < NS; i++) {
      sr[i] -= dt * (0.08 + 0.25 * (1 - sr[i]));
      if (sr[i] < 0.12) { sr[i] = 0.95 + Math.random() * 0.05; }
      sa[i] += dt * (0.6 / (sr[i] + 0.1));
      sp[i * 3] = Math.cos(sa[i]) * sr[i];
      sp[i * 3 + 1] = Math.sin(sa[i]) * sr[i];
      sp[i * 3 + 2] = 0.02 + (1 - sr[i]) * -0.15;
    }
    spiraleGeo.attributes.position.needsUpdate = true;

    // cendre qui monte doucement
    for (let i = 0; i < NC; i++) {
      cp[i * 3 + 1] += dt * 0.18; cp[i * 3] += Math.sin(temps * 0.3 + i) * dt * 0.05;
      if (cp[i * 3 + 1] > 10) cp[i * 3 + 1] = -10;
    }
    cendreGeo.attributes.position.needsUpdate = true;
    brume.rotation.z = Math.sin(temps * 0.05) * 0.05;
    brume.position.x = Math.sin(temps * 0.07) * 1.5;

    // la chute des grenades, jusqu'au trou
    const tc = trouGroupe.position;
    for (const g of grenades) {
      const u = g.userData;
      u.t += dt;
      if (u.etat === 'chute') {
        g.position.y -= u.v * dt * (1 + 0.6 * finale);
        const proche = 1 - THREE.MathUtils.clamp((g.position.y - tc.y) / (H * 0.8), 0, 1);
        const xCible = THREE.MathUtils.lerp(u.x0, tc.x, Math.pow(proche, 1.6));
        g.position.x += (xCible - g.position.x) * Math.min(1, dt * 2.5);
        g.position.x += Math.sin(u.t * 1.3 + u.x0) * dt * 0.25;
        g.position.z += (0 - g.position.z) * dt * 0.4 * proche;
        g.rotation.x += u.rot.x * dt; g.rotation.y += u.rot.y * dt; g.rotation.z += u.rot.z * dt;
        if (g.position.y < tc.y + rayonTrou * 0.25) { u.etat = 'aspiree'; u.t = 0; u.angle = Math.atan2(g.position.z - tc.z, g.position.x - tc.x); u.r0 = Math.max(0.3, Math.abs(g.position.x - tc.x)); }
      } else if (u.etat === 'aspiree') {
        const k = Math.min(1, u.t / 1.1);
        u.angle += dt * (3 + 9 * k);
        const r = u.r0 * (1 - k);
        g.position.set(tc.x + Math.cos(u.angle) * r, tc.y - k * 0.6, tc.z + Math.sin(u.angle) * r * 0.4);
        g.scale.setScalar(u.echelle * (1 - k * 0.95));
        g.rotation.y += dt * 8;
        if (k >= 1) placer(g, false);
      } else if (u.etat === 'detruite') {
        if (u.t > 1.4) placer(g, false);
      }
    }
    // la vedette
    if (vedette.userData.etat === 'vedette') {
      vedette.rotation.y += dt * 0.6; vedette.rotation.z = Math.sin(temps * 0.8) * 0.25;
      vedette.position.y += Math.sin(temps * 1.2) * 0.15;
      vedette.scale.setScalar(Math.min(1.35, vedette.scale.x + dt * 0.8));
    } else if (vedette.userData.etat === 'detruite') {
      vedette.userData.t += dt;
      if (vedette.userData.t > 2.2) { vedette.userData.etat = 'vedette'; vedette.scale.setScalar(0.01); }
    }

    animerSysteme(flammes, dt, -0.6, 0.94, 1.1);
    animerSysteme(lait, dt, 6.5, 0.985, 0.55);
    feu.intensity *= Math.pow(0.02, dt);

    // secousse de caméra
    secousse = Math.max(0, secousse - dt);
    const s = secousse * secousse * 1.2;
    camera.position.x = (Math.random() - 0.5) * s;
    camera.position.y = (Math.random() - 0.5) * s - progression * 0.6;
    camera.lookAt(0, -progression * 0.6, 0);

    renderer.render(scene, camera);
  }

  function boucle() {
    if (!actif || calme) { enBoucle = false; return; }
    enBoucle = true;
    const dt = Math.min(0.05, horloge.getDelta());
    image(dt);
    requestAnimationFrame(boucle);
  }

  addEventListener('resize', () => { tailles(); if (calme) image(0); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) actif = false; else api.actif(true); });

  if (calme) { image(0.016); } else { horloge.getDelta(); boucle(); }

  const rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const api = {
    actif(oui) {
      if (document.hidden) oui = false;
      actif = oui;
      if (oui && !enBoucle && !calme) { horloge.getDelta(); boucle(); }
    },
    progression(p) {
      progression = p;
      // le trou s'ouvre en grand dans le dernier écran de la page
      finale = THREE.MathUtils.clamp((p - 0.9) / 0.1, 0, 1);
      if (calme) image(0);
    },
    toucher(x, y) {
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      const cibles = grenades.filter(g => g.visible && g.userData.etat === 'chute');
      if (vedette.visible) cibles.push(vedette);
      const touche = rc.intersectObjects(cibles, true)[0];
      if (!touche) return false;
      let g = touche.object; while (g.parent && g.parent !== scene) g = g.parent;
      exploser(g);
      if (calme) image(0);
      return true;
    },
    boomGeneral() {
      const visibles = grenades.filter(g => g.visible && g.userData.etat === 'chute');
      if (vedette.visible) visibles.unshift(vedette);
      visibles.slice(0, 4).forEach((g, i) => setTimeout(() => exploser(g), i * 140));
      if (calme) setTimeout(() => image(0), 700);
    },
    retomber() {
      grenades.forEach(g => placer(g, false));
    }
  };
  return api;
}
