import * as THREE from 'three';
import { LANES, clamp, moveLane, scoreRun, canAvoid, nextSpawnDelay } from './game-logic.js';
import './style.css';

const canvas = document.querySelector('#game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10292b);
scene.fog = new THREE.FogExp2(0x10292b, 0.012);
const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.1, 140);
camera.position.set(0, 5.7, 11.3);
camera.lookAt(0, 1.1, -8);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const hemi = new THREE.HemisphereLight(0xdaf6e8, 0x533b2f, 1.8);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xffd39b, 3.1);
moon.position.set(-5, 10, 7); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -9; moon.shadow.camera.right = 9; moon.shadow.camera.top = 12; moon.shadow.camera.bottom = -10;
moon.shadow.bias = -0.00025; scene.add(moon); scene.add(moon.target);
const turquoiseGlow = new THREE.PointLight(0x4dc4b3, 13, 28, 1.8); turquoiseGlow.position.set(0, 5, -12); scene.add(turquoiseGlow);
const warmGlow = new THREE.PointLight(0xf39c58, 9, 19, 1.7); warmGlow.position.set(-5.3, 4.8, -15); scene.add(warmGlow);

const mats = {
  tile: new THREE.MeshStandardMaterial({ color: 0x316a68, roughness: .55, metalness: .08 }),
  tileDark: new THREE.MeshStandardMaterial({ color: 0x204e50, roughness: .68 }),
  grout: new THREE.MeshStandardMaterial({ color: 0x15383b, roughness: .9 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xcbb995, roughness: .75 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc48b4d, roughness: .3, metalness: .66 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x152b2b, roughness: .82 }),
  steam: new THREE.MeshStandardMaterial({ color: 0xe3e8d3, roughness: .9 }),
};
const standard = (color, roughness = .6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 18, 14);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
function mesh(geometry, material, parent = scene, position = [0, 0, 0], scale = [1, 1, 1]) {
  const obj = new THREE.Mesh(geometry, material); obj.position.set(...position); obj.scale.set(...scale); parent.add(obj); return obj;
}

// Endless tiled floor: large modular slabs plus inset grout lines provide readable perspective.
const floorMat = standard(0x265754, .62, .05);
const floorSegments = [];
for (let s = 0; s < 7; s++) {
  const group = new THREE.Group(); group.position.z = 12 - s * 12;
  const slab = mesh(boxGeo, floorMat, group, [0, -.22, -5], [9.6, .4, 12]); slab.receiveShadow = true;
  for (let i = 0; i < 7; i++) {
    mesh(boxGeo, mats.grout, group, [0, -.005, -11 + i * 2], [9.55, .025, .045]);
  }
  for (const x of [-3.75, -1.25, 1.25, 3.75]) mesh(boxGeo, mats.grout, group, [x, -.005, -5], [.035, .025, 12]);
  // central lane inlay and subtle brass lane markers
  for (const x of [-1.18, 1.18]) mesh(boxGeo, mats.brass, group, [x, .002, -5], [.025, .012, 12]);
  scene.add(group); floorSegments.push(group);
}

// Hammam side walls, repeating tile panels, marble plinths, columns and warm lantern niches.
const wallSegments = [];
for (let i = 0; i < 5; i++) {
  const group = new THREE.Group(); group.position.z = 7 - i * 18;
  for (const side of [-1, 1]) {
    mesh(boxGeo, mats.tileDark, group, [side * 5.2, 2.5, -8], [.65, 5.3, 18]);
    mesh(boxGeo, mats.cream, group, [side * 4.84, .34, -8], [.12, .65, 18]);
    mesh(boxGeo, mats.brass, group, [side * 4.84, .72, -8], [.1, .055, 18]);
    // tile panel seams
    for (let j = 0; j < 8; j++) mesh(boxGeo, mats.tile, group, [side * 4.855, 1.35 + j * .48, -16 + j * 2.1], [.025, .37, .018]);
    // carved pillar and crown every module
    const pillarX = side * 4.52;
    mesh(boxGeo, mats.tile, group, [pillarX, 2.6, -15], [.34, 5.2, .5]);
    mesh(boxGeo, mats.brass, group, [pillarX, 4.45, -15], [.45, .12, .62]);
    mesh(boxGeo, mats.brass, group, [pillarX, .35, -15], [.45, .16, .62]);
    // glowing wall lamp
    const lamp = mesh(new THREE.SphereGeometry(.16, 12, 12), standard(0xffbc70, .3, .2), group, [side * 4.47, 3.45, -6]);
    const lantern = new THREE.PointLight(0xf6a360, 5.8, 7, 2); lantern.position.set(side * 4.05, 3.4, -6); group.add(lantern);
    mesh(cylGeo, mats.brass, group, [side * 4.5, 3.45, -6], [.34, .08, .34]).rotation.x = Math.PI / 2;
    lamp.castShadow = false;
  }
  // distant arches, softened by fog
  const archMat = standard(0x122e31, .8);
  for (const x of [-3.5, 0, 3.5]) {
    mesh(boxGeo, archMat, group, [x, 2.4, -16.9], [2.2, 4.8, .25]);
    mesh(new THREE.TorusGeometry(1.08, .12, 8, 20, Math.PI), mats.brass, group, [x, 4.8, -16.72], [1, 1, 1]).rotation.z = Math.PI;
  }
  scene.add(group); wallSegments.push(group);
}

// Hanging brass lanterns and drifting steam pearls deepen the long corridor.
const decor = [];
for (let i = 0; i < 7; i++) {
  const g = new THREE.Group(); g.position.set(i % 2 ? -2.7 : 2.7, 0, -4 - i * 13);
  mesh(cylGeo, mats.brass, g, [0, 5.7, 0], [.07, .8, .07]);
  mesh(new THREE.OctahedronGeometry(.42, 0), standard(0xffbd74, .28, .35), g, [0, 5.1, 0], [.62, .9, .62]);
  const light = new THREE.PointLight(0xffa656, 4, 9, 2); light.position.set(0, 5.1, 0); g.add(light);
  scene.add(g); decor.push(g);
}

// Player: hand-built stylized cockroach with a polished amber carapace, segmented shell, eyes and feelers.
const player = new THREE.Group(); scene.add(player); player.position.set(0, 0, 0.8);
const bugRoot = new THREE.Group(); player.add(bugRoot);
const shellMat = new THREE.MeshStandardMaterial({ color: 0x9b4d24, roughness: .28, metalness: .22, clearcoat: .8, clearcoatRoughness: .2 });
const shellTop = standard(0xd18a43, .3, .22);
const headMat = standard(0x5b301f, .4, .12);
const legMat = standard(0x42271d, .4, .15);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x080e0e, roughness: .12, metalness: .05 });
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffe2a2 });
mesh(sphereGeo, shellMat, bugRoot, [0, .82, .05], [.52, .32, .95]);
mesh(sphereGeo, shellTop, bugRoot, [0, 1.02, -.05], [.49, .2, .74]);
// shell centre seam and abdominal segments
mesh(boxGeo, standard(0x542a19, .45), bugRoot, [0, 1.08, .02], [.018, .025, 1.15]);
for (let n = 0; n < 4; n++) {
  const plate = mesh(new THREE.TorusGeometry(.45 - n * .015, .035, 8, 24, Math.PI), standard(n % 2 ? 0x76391f : 0xa75c2b, .34, .16), bugRoot, [0, .84 - n * .017, .62 - n * .28], [1, .8, 1]);
  plate.rotation.z = Math.PI;
}
mesh(sphereGeo, headMat, bugRoot, [0, .79, -.76], [.32, .27, .31]);
mesh(new THREE.SphereGeometry(1, 18, 12), shellTop, bugRoot, [0, 1.0, -.48], [.42, .15, .28]);
for (const side of [-1, 1]) {
  mesh(sphereGeo, eyeMat, bugRoot, [side * .22, .88, -.92], [.09, .105, .07]);
  mesh(sphereGeo, glintMat, bugRoot, [side * .245, .92, -.97], [.025, .027, .018]);
}
const feelerMat = new THREE.LineBasicMaterial({ color: 0x3b2418, linewidth: 2 });
for (const side of [-1, 1]) {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .1, .97, -.95), new THREE.Vector3(side * .22, 1.45, -1.1), new THREE.Vector3(side * .42, 1.63, -1.5), new THREE.Vector3(side * .52, 1.53, -1.95)]);
  bugRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)), feelerMat));
}
const legs = [];
for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
  const pivot = new THREE.Group(); pivot.position.set(side * .34, .7, .48 - i * .47); bugRoot.add(pivot);
  const upper = mesh(cylGeo, legMat, pivot, [side * .31, -.05, 0], [.085, .72, .085]); upper.rotation.z = side * -.55;
  const joint = mesh(sphereGeo, shellTop, pivot, [side * .62, -.36, 0], [.07, .07, .07]);
  const lower = mesh(cylGeo, legMat, pivot, [side * .69, -.58, -.06], [.055, .56, .055]); lower.rotation.z = side * .25;
  legs.push({ pivot, side, index: i });
}
const wingL = mesh(sphereGeo, standard(0xc0753a, .3, .18), bugRoot, [-.16, 1.15, -.02], [.25, .09, .57]); wingL.rotation.z = -.11;
const wingR = mesh(sphereGeo, standard(0xc0753a, .3, .18), bugRoot, [.16, 1.15, -.02], [.25, .09, .57]); wingR.rotation.z = .11;
player.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

// World object builders
const active = [];
const crumbs = [];
const crumbGold = new THREE.MeshStandardMaterial({ color: 0xffd77d, roughness: .24, metalness: .58, emissive: 0x754312, emissiveIntensity: .3 });
const crumbCream = standard(0xf0bc69, .38, .18);
function makeObstacle(type, lane, z) {
  const group = new THREE.Group(); group.position.set(LANES[lane], 0, z); group.userData = { kind: 'obstacle', type, lane, passed: false };
  if (type === 'jump') {
    // slick soap bar, bright edge makes the jump cue clear
    mesh(boxGeo, standard(0xd5d7bd, .32, .03), group, [0, .31, 0], [1.05, .55, .75]);
    mesh(boxGeo, standard(0xe8bd68, .3, .1), group, [0, .6, 0], [1.07, .09, .77]);
    for (let i = 0; i < 3; i++) mesh(sphereGeo, standard(0xf4f2dd, .2), group, [(-1 + i) * .25, .69, -.03], [.12, .025, .12]);
  } else if (type === 'slide') {
    // pipe spanning overhead: slide below
    const pipeMat = standard(0xc37846, .3, .62);
    mesh(cylGeo, pipeMat, group, [0, 1.72, 0], [.13, 1.2, .13]).rotation.z = Math.PI / 2;
    for (const x of [-.48, .48]) mesh(cylGeo, mats.brass, group, [x, 1.72, 0], [.23, .16, .23]).rotation.z = Math.PI / 2;
    mesh(boxGeo, standard(0x354e49, .5, .2), group, [0, 1.38, .02], [1.15, .12, .85]);
  } else {
    // tall copper wash bucket / hamper: route around it
    mesh(cylGeo, standard(0x96613d, .38, .42), group, [0, .58, 0], [.85, 1.15, .85]);
    mesh(cylGeo, mats.brass, group, [0, 1.16, 0], [.87, .12, .87]);
    mesh(cylGeo, standard(0x314e49, .4, .25), group, [0, 1.24, 0], [.7, .06, .7]);
    const handle = mesh(new THREE.TorusGeometry(.39, .045, 8, 24, Math.PI), mats.brass, group, [0, 1.16, 0], [1, 1, 1]); handle.rotation.z = Math.PI;
  }
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(group); active.push(group); return group;
}
function makeCrumb(lane, z, index) {
  const g = new THREE.Group(); g.position.set(LANES[lane], 0, z); g.userData = { kind: 'crumb', collected: false, index };
  mesh(new THREE.TorusGeometry(.22, .07, 8, 18), crumbGold, g, [0, .7, 0]);
  mesh(new THREE.SphereGeometry(.095, 12, 10), crumbCream, g, [0, .7, 0], [1, .65, .65]);
  const halo = new THREE.PointLight(0xffc96e, .5, 2, 2); halo.position.y = .7; g.add(halo);
  scene.add(g); crumbs.push(g); return g;
}

const state = { mode: 'menu', lane: 1, laneX: 0, speed: 8.8, distance: 0, crumbCount: 0, jumpY: 0, jumpVelocity: 0, jumpTime: 0, slideTime: 0, spawnTimer: 1.15, elapsed: 0, score: 0, best: Number(localStorage.getItem('hamamRunnerBest') || 0), flash: 0, shake: 0 };
const $ = id => document.getElementById(id);
const hud = document.querySelector('.hud');
const bestDisplay = $('best-score');
const format = n => String(Math.max(0, Math.floor(n))).padStart(5, '0');
bestDisplay.textContent = format(state.best);
$('intro-best').textContent = format(state.best);
let audioContext = null, soundOn = true, toastTimer = 0;
function audio() { if (!soundOn) return; try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); return audioContext; } catch { return null; } }
function tone(freq, duration = .12, type = 'sine', volume = .045, endFreq = freq) {
  const ctx = audio(); if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
}
function chirp() { tone(740, .09, 'sine', .045, 1180); setTimeout(() => tone(980, .12, 'sine', .03, 1320), 45); }
function showToast(text) { const el = $('toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 1250); }
function setMode(mode) {
  state.mode = mode;
  hud.hidden = !['running', 'paused'].includes(mode);
  $('pause-button').hidden = mode !== 'running';
  $('touch-controls').hidden = mode !== 'running' || matchMedia('(min-width: 701px)').matches;
  $('pause-overlay').hidden = mode !== 'paused'; $('result-overlay').hidden = mode !== 'over';
}
function resetRun() {
  for (const item of [...active, ...crumbs]) scene.remove(item);
  active.length = 0; crumbs.length = 0;
  state.lane = 1; state.laneX = 0; state.speed = 8.8; state.distance = 0; state.crumbCount = 0;
  state.jumpY = 0; state.jumpVelocity = 0; state.jumpTime = 0; state.slideTime = 0; state.spawnTimer = .9; state.elapsed = 0; state.flash = 0; state.shake = 0;
  player.position.set(0, 0, .8); bugRoot.scale.set(1, 1, 1); bugRoot.rotation.set(0, 0, 0);
  $('distance').textContent = '000'; $('crumb-count').textContent = '0'; $('speed-label').textContent = 'RAHAT';
}
function startRun() { resetRun(); setMode('running'); $('intro-overlay').classList.add('leaving'); audio(); tone(440, .16, 'triangle', .03, 710); }
function pauseRun() { if (state.mode === 'running') setMode('paused'); }
function resumeRun() { if (state.mode === 'paused') { setMode('running'); audio(); } }
function gameOver() {
  if (state.mode !== 'running') return;
  state.score = scoreRun(state.distance, state.crumbCount);
  tone(190, .4, 'sawtooth', .065, 55); state.shake = .42; state.flash = .5;
  const newRecord = state.score > state.best;
  if (newRecord) { state.best = state.score; localStorage.setItem('hamamRunnerBest', String(state.best)); bestDisplay.textContent = format(state.best); $('intro-best').textContent = `${format(state.best)} m`; }
  $('result-kicker').textContent = newRecord ? 'YENİ REKOR · TEBRİKLER' : 'KOŞU TAMAMLANDI';
  $('result-title').innerHTML = newRecord ? 'EFSANE KAÇIŞ<span>.</span>' : 'YAKALANDIN<span>.</span>';
  $('final-distance').textContent = String(Math.floor(state.distance)).padStart(3, '0'); $('final-crumbs').textContent = state.crumbCount;
  setMode('over');
}
function doJump() {
  if (state.mode !== 'running' || state.jumpY > 0 || state.slideTime > .05) return;
  state.jumpVelocity = 7.2; state.jumpTime = 0; tone(300, .13, 'triangle', .035, 520);
}
function doSlide() {
  if (state.mode !== 'running' || state.jumpY > .18) return;
  state.slideTime = .72; tone(240, .1, 'triangle', .025, 150);
}
function move(direction) { if (state.mode !== 'running') return; state.lane = moveLane(state.lane, direction); tone(180 + state.lane * 45, .045, 'sine', .018, 210); }
function action(key) {
  if (key === 'ArrowLeft' || key.toLowerCase() === 'a') move(-1);
  else if (key === 'ArrowRight' || key.toLowerCase() === 'd') move(1);
  else if (key === 'ArrowUp' || key === ' ' || key.toLowerCase() === 'w') { if (state.mode === 'menu') startRun(); else doJump(); }
  else if (key === 'ArrowDown' || key.toLowerCase() === 's') doSlide();
  else if (key.toLowerCase() === 'p' || key === 'Escape') state.mode === 'running' ? pauseRun() : resumeRun();
}
window.addEventListener('keydown', e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault(); action(e.key); });
$('start-button').addEventListener('click', startRun); $('retry-button').addEventListener('click', startRun); $('pause-button').addEventListener('click', pauseRun); $('resume-button').addEventListener('click', resumeRun);
$('home-button').addEventListener('click', () => { setMode('menu'); $('intro-overlay').classList.remove('leaving'); });
$('sound-toggle').addEventListener('click', () => { soundOn = !soundOn; $('sound-icon').textContent = soundOn ? '◖))' : '◖×'; $('sound-toggle').setAttribute('aria-label', soundOn ? 'Sesi kapat' : 'Sesi aç'); if (soundOn) tone(620, .1); });
for (const button of document.querySelectorAll('.touch-controls button')) button.addEventListener('pointerdown', e => { e.preventDefault(); action(({left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',slide:'ArrowDown'})[button.dataset.action]); });
let pointerStart = null;
canvas.addEventListener('pointerdown', e => { pointerStart = {x:e.clientX,y:e.clientY}; });
canvas.addEventListener('pointerup', e => { if (!pointerStart || state.mode !== 'running') return; const dx = e.clientX - pointerStart.x, dy = e.clientY - pointerStart.y; if (Math.abs(dx) > 30 || Math.abs(dy) > 30) { if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else dy < 0 ? doJump() : doSlide(); } else if (e.clientY > innerHeight * .48) doJump(); pointerStart = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'running') pauseRun(); });

function spawnWave() {
  const obstacleLane = Math.floor(Math.random() * 3);
  const roll = Math.random(); const type = roll < .38 ? 'jump' : roll < .7 ? 'slide' : 'block';
  makeObstacle(type, obstacleLane, -44);
  let crumbLane = (obstacleLane + 1 + Math.floor(Math.random() * 2)) % 3;
  if (Math.random() < .35) crumbLane = obstacleLane; // risky reward line; lane change or precise jump/slide required
  for (let i = 0; i < 5; i++) makeCrumb(crumbLane, -38 - i * 1.55, i);
  state.spawnTimer = nextSpawnDelay(Math.random, 1 + state.distance / 260);
}
function updateWorld(dt) {
  const speed = state.speed;
  for (const group of floorSegments) { group.position.z += speed * dt; if (group.position.z > 24) group.position.z -= 84; }
  for (const group of wallSegments) { group.position.z += speed * dt; if (group.position.z > 20) group.position.z -= 90; }
  for (const g of decor) { g.position.z += speed * dt; if (g.position.z > 12) g.position.z -= 91; }
  for (let i = active.length - 1; i >= 0; i--) {
    const obstacle = active[i]; obstacle.position.z += speed * dt;
    if (!obstacle.userData.passed && obstacle.position.z > -.3) {
      obstacle.userData.passed = true;
      if (obstacle.userData.lane === state.lane && !canAvoid(obstacle.userData.type, state.jumpTime, state.slideTime)) { gameOver(); return; }
    }
    if (obstacle.position.z > 13) { scene.remove(obstacle); active.splice(i, 1); }
  }
  for (let i = crumbs.length - 1; i >= 0; i--) {
    const crumb = crumbs[i]; crumb.position.z += speed * dt; crumb.rotationY = (crumb.rotationY || 0) + dt * 2;
    crumb.children[0].rotation.y += dt * 2.5; crumb.children[1].position.y = .7 + Math.sin(state.elapsed * 5 + i) * .08;
    if (!crumb.userData.collected && Math.abs(crumb.position.z - .8) < .76 && Math.abs(LANES[state.lane] - crumb.position.x) < .7 && state.jumpY < 1.4) {
      crumb.userData.collected = true; state.crumbCount++; $('crumb-count').textContent = state.crumbCount; scene.remove(crumb); crumbs.splice(i, 1); chirp();
      if (state.crumbCount % 10 === 0) showToast('10 KIRINTI — USTA İŞİ!');
      continue;
    }
    if (crumb.position.z > 12) { scene.remove(crumb); crumbs.splice(i, 1); }
  }
}

const clock = new THREE.Timer(); clock.connect(document);
function frame() {
  clock.update(); const dt = Math.min(Math.max(clock.getDelta(), 0), .05);
  state.elapsed += dt;
  const running = state.mode === 'running';
  if (running) {
    state.distance += state.speed * dt * .52;
    state.speed = Math.min(18, 8.8 + state.distance * .018);
    state.spawnTimer -= dt; if (state.spawnTimer <= 0) spawnWave();
    updateWorld(dt);
    if (state.jumpVelocity || state.jumpY > 0) {
      state.jumpTime += dt;
      state.jumpY += state.jumpVelocity * dt; state.jumpVelocity -= 19 * dt;
      if (state.jumpY <= 0) { state.jumpY = 0; state.jumpVelocity = 0; state.jumpTime = 0; }
    }
    if (state.slideTime > 0) state.slideTime = Math.max(0, state.slideTime - dt);
    $('distance').textContent = String(Math.floor(state.distance)).padStart(3, '0');
    const tier = state.speed > 15 ? 'TAM GAZ' : state.speed > 12 ? 'HIZLI' : 'RAHAT'; $('speed-label').textContent = tier;
    if (state.distance > 90) document.querySelector('.speed-pill').style.color = '#ffbb69';
    else document.querySelector('.speed-pill').style.color = '';
  } else if (state.mode === 'menu') {
    // Idle parallax and breathing keep the title scene alive before play.
    for (const group of floorSegments) { group.position.z += .12 * dt; if (group.position.z > 24) group.position.z -= 84; }
    for (const group of wallSegments) { group.position.z += .12 * dt; if (group.position.z > 20) group.position.z -= 90; }
  }
  const targetX = LANES[state.lane]; state.laneX += (targetX - state.laneX) * Math.min(1, dt * 12);
  player.position.x = state.laneX;
  const stride = running ? Math.sin(state.elapsed * (5 + state.speed * .3)) : Math.sin(state.elapsed * 2) * .08;
  for (const leg of legs) leg.pivot.rotation.x = Math.sin(state.elapsed * 11 + leg.index * 2.1 + leg.side) * (running ? .38 : .12);
  const slideScale = state.slideTime > 0 ? .48 : 1;
  bugRoot.scale.y += (slideScale - bugRoot.scale.y) * Math.min(1, dt * 16);
  bugRoot.position.y = state.jumpY + (running && state.jumpY === 0 ? Math.abs(stride) * .035 : 0);
  bugRoot.rotation.z = (targetX - state.laneX) * -.08;
  bugRoot.rotation.x = state.jumpY > .2 ? -.12 : 0;
  bugRoot.position.z = Math.sin(state.elapsed * 3) * .025;
  camera.position.x += (player.position.x * .12 - camera.position.x) * dt * 1.6;
  camera.position.y = 5.7 + Math.sin(state.elapsed * 1.1) * .035;
  camera.lookAt(player.position.x * .08, 1.05 + state.jumpY * .08, -8);
  moon.position.x = player.position.x - 5;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); $('touch-controls').hidden = state.mode !== 'running' || matchMedia('(min-width: 701px)').matches; });
window.addEventListener('contextmenu', e => e.preventDefault());
Object.assign(window, { renderer, scene, gameState: state });
