import * as THREE from 'three';
import { LANES, moveLane, scoreRun, canAvoid, nextSpawnDelay } from './game-logic.js';
import './style.css';

// Camera, PBR lighting and a deliberately small resolution budget keep the runner smooth on phones.
const canvas = document.querySelector('#game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99cfe0);
scene.fog = new THREE.FogExp2(0xa9c8c6, 0.0105);
const camera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, .1, 145);
camera.position.set(0, 3.8, 7.6);
camera.lookAt(0, 1.05, -10);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
scene.add(new THREE.HemisphereLight(0xdff5ff, 0x7a5641, 2.0));
const sun = new THREE.DirectionalLight(0xfff0cf, 3.2);
sun.position.set(-7, 14, 9); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -13; sun.shadow.camera.right = 13; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -15; sun.shadow.bias = -.00025;
scene.add(sun); scene.add(sun.target);
const cityFill = new THREE.DirectionalLight(0x77b7e3, 1.1); cityFill.position.set(7, 6, -10); scene.add(cityFill);

const mat = (color, roughness=.7, metalness=0, options={}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
const M = {
  road: mat(0x444c4d, .93), curb: mat(0xc4b596, .9), stone: mat(0x77776c, .92), stone2: mat(0x908575, .95), lane: mat(0xf6df9c, .72),
  cream: mat(0xe6d0a6), brick: mat(0xc97958), peach: mat(0xd99974), ochre: mat(0xd3b06c), mint: mat(0x7cae9b), blue: mat(0x7195aa), slate: mat(0x637989), dark: mat(0x293a44), window: mat(0x425c64,.25,.2,{emissive:0x12262c,emissiveIntensity:.2}), warmWindow: mat(0xffd58b,.3,.08,{emissive:0xb35e1d,emissiveIntensity:.5}), iron: mat(0x28343a,.38,.55), brass: mat(0xd9a64c,.25,.72), red: mat(0xe8523c,.46), awning: mat(0xe8d7b7,.74),
};
const boxGeo = new THREE.BoxGeometry(1,1,1), sphereGeo = new THREE.SphereGeometry(1,18,14), cylinderGeo = new THREE.CylinderGeometry(1,1,1,12), wheelGeo = new THREE.CylinderGeometry(.24,.24,.14,14);
function addMesh(geometry, material, parent=scene, pos=[0,0,0], scale=[1,1,1]) { const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.scale.set(...scale);parent.add(o);return o; }
function box(parent, material, pos, scale, receive=false) { const o=addMesh(boxGeo,material,parent,pos,scale);o.castShadow=false;o.receiveShadow=receive;return o; }
function cylinderBetween(parent, material, a, b, radiusA, radiusB=radiusA, radial=8) {
  const delta=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a));
  const geo=new THREE.CylinderGeometry(radiusB,radiusA,delta.length(),radial);
  const o=new THREE.Mesh(geo,material);o.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());o.castShadow=true;parent.add(o);return o;
}
function labelTexture(text, color, accent) {
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.fillStyle=accent;ctx.fillRect(8,8,496,112);ctx.fillStyle='#fff8e6';ctx.font='900 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#22333c';ctx.shadowBlur=4;ctx.fillText(text,256,67,470);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeSign(parent,text,x,y,z,side,color='#2777a4',accent='#173e62') {
  const board=box(parent,mat(0x18384b,.5),[x,y,z],[.12,.72,2.45]);
  const tex=labelTexture(text,color,accent);const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.32,.57),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));sign.position.set(x-side*.071,y,z);sign.rotation.y=side<0?Math.PI/2:-Math.PI/2;parent.add(sign);return board;
}

// Six looping blocks: cobbled lanes, kerbs and old-city shopfronts with balconies and signs.
const city=[];
const streetSegments=[];
const facadeMats=[M.cream,M.brick,M.peach,M.ochre,M.mint,M.blue,M.slate];
const windowMats=[M.window,M.window,M.warmWindow];
function addStreetSegment(index) {
  const g=new THREE.Group();g.position.z=8-index*19.5;
  box(g,M.road,[0,-.27,-9.5],[10.2,.5,19.5],true);
  for (const side of [-1,1]) {
    box(g,M.curb,[side*5.15,-.04,-9.5],[.28,.2,19.5],true);
    box(g,M.ochre,[side*5.8,-.11,-9.5],[1.05,.34,19.5],true);
    // sidewalk slabs and repeating seams
    for(let q=0;q<10;q++)box(g,q%2?M.stone:M.stone2,[side*5.8,.075,-.45-q*1.9],[1.02,.09,.045]);
  }
  // broken centre markings and road texture. Instancing avoids hundreds of draw calls.
  const dashMat=mat(0xf0d68a,.8);for(const x of [-1.68,1.68])for(let j=0;j<8;j++)box(g,dashMat,[x,.006,-.5-j*2.45],[.075,.018,1.18]);
  const cobbleCount=160;const stoneInst=new THREE.InstancedMesh(boxGeo,M.stone,cobbleCount);const stoneInst2=new THREE.InstancedMesh(boxGeo,M.stone2,cobbleCount);const dummy=new THREE.Object3D();let a=0,b=0;
  for(let i=0;i<cobbleCount*2;i++){const lane=(Math.random()*3|0)-1;const z=-.35-Math.random()*18.6;const x=lane*2.45+(Math.random()-.5)*1.9;dummy.position.set(x,.012,z);dummy.rotation.y=Math.random()*.3;dummy.scale.set(.32+Math.random()*.45,.035,.2+Math.random()*.3);dummy.updateMatrix();if(i%2){stoneInst.setMatrixAt(a++,dummy.matrix)}else stoneInst2.setMatrixAt(b++,dummy.matrix)}
  stoneInst.count=a;stoneInst2.count=b;g.add(stoneInst,stoneInst2);
  // Painted lane edge lines and drains add road rhythm as it rushes under the camera.
  for(const x of [-4.75,4.75])box(g,M.lane,[x,.006,-9.5],[.04,.015,19.5]);
  for(const side of [-1,1]) {
    const facade=facadeMats[(index*3+(side>0?2:0))%facadeMats.length];
    const centerX=side*8.25;box(g,facade,[centerX,5.3,-9.5],[5.45,11.1,19.5],true);
    box(g,mat(0x5e5143),[centerX,11,-9.5],[5.58,.35,19.7]);
    // floor cornices and storefront base
    for(let floor=0;floor<3;floor++) {
      const y=2.0+floor*3.1;
      box(g,mat(0xf0dec1),[side*5.48,y-1.25,-9.5],[.12,.11,19.5]);
      for(let w=0;w<4;w++) {
        const z=-2.2-w*4.8;
        box(g,mat(0x4b4037),[side*5.49,y,z],[.105,1.24,1.15]);
        box(g,windowMats[(index+w+floor)%windowMats.length],[side*5.42,y,z],[.055,.99,.9]);
        box(g,mat(0xf3ddaf),[side*5.37,y,z],[.07,.095,.98]);
        box(g,mat(0xe4cda4),[side*5.36,y,z],[.055,.99,.07]);
        if(floor===1){
          box(g,M.iron,[side*5.16,y-.61,z],[.62,.06,1.38]);
          box(g,M.iron,[side*5.45,y-.4,z-.62],[.08,.42,.06]);box(g,M.iron,[side*5.45,y-.4,z+.62],[.08,.42,.06]);
          for(let r=0;r<4;r++)box(g,M.iron,[side*5.15,y-.38,z-.45+r*.3],[.04,.05,.12]);
        }
      }
    }
    // Ground-floor shop windows and bright striped fabric awning.
    const shopColor=[M.red,M.blue,M.mint,M.ochre][(index+(side>0?1:0))%4];
    box(g,mat(0x43575a),[side*5.48,.92,-9.5],[.12,1.7,5.4]);
    box(g,mat(0x80aeb7,.26),[side*5.39,.98,-9.5],[.055,1.28,4.8]);
    box(g,mat(0xf6e6c4),[side*5.3,1.82,-9.5],[.25,.22,5.65]);
    for(let k=0;k<9;k++)box(g,k%2?M.awning:shopColor,[side*5.18,1.98,-12.0+k*.62],[.58,.2,.31]);
    makeSign(g,['BÜFE','BAKKAL','KÖŞE CAFE','MANAV'][index%4],side*5.36,2.65,-9.5,side,side>0?'#ea523f':'#2679ad',side>0?'#9f2c24':'#174c70');
    // Streetlights at opposite ends, with a simple warm emissive bulb.
    const poleX=side*5.65;const poleZ=-16.2;
    cylinderBetween(g,M.iron,[poleX,.15,poleZ],[poleX,4.0,poleZ],.07,.045,8);
    cylinderBetween(g,M.iron,[poleX,3.92,poleZ],[poleX-side*.7,4.28,poleZ],.045,.04,8);
    box(g,M.warmWindow,[poleX-side*.8,4.25,poleZ],[.34,.12,.25]);
  }
  // Distant rooftops, aerials and pale city skyline.
  for(let k=0;k<5;k++){
    const x=(k-2)*5;const h=11+Math.random()*8;box(g,facadeMats[(index+k+3)%facadeMats.length],[x,h/2,-20],[4.7,h,1.8]);
    box(g,M.cream,[x,h+.15,-20],[4.9,.3,2]);
  }
  scene.add(g);city.push(g);streetSegments.push(g);
}
for(let i=0;i<5;i++)addStreetSegment(i);

// Vehicles, road furniture and street hazards move in the three playable lanes.
const movingDecor=[];
const obstacleGroups=[];
const coinGroups=[];
const powerGroups=[];
const carPaints=[mat(0x396b9e,.3,.2),mat(0xd74534,.3,.15),mat(0xe0b74a,.34,.15),mat(0x63a986,.38,.15)];
function makeCar(parent, paint, scale=1) {
  const car=new THREE.Group();
  box(car,paint,[0,.48,0],[1.55,.53,2.25]);
  box(car,paint,[0,.9,-.19],[1.18,.45,1.12]);
  box(car,mat(0x9dc9d1,.15,.22),[0,.94,-.19],[1.04,.28,.94]);
  box(car,mat(0xfbf1cf,.28),[0,.47,-1.135],[.62,.12,.045]);
  for(const side of [-1,1])for(const z of [-.72,.75]){const wheel=addMesh(wheelGeo,M.dark,car,[side*.79,.3,z]);wheel.rotation.z=Math.PI/2;}
  for(const side of [-1,1])box(car,M.warmWindow,[side*.64,.59,-1.14],[.16,.13,.06]);
  car.scale.setScalar(scale);parent.add(car);return car;
}
function addScenery() {
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const g=new THREE.Group();g.position.set(side*(5.7+Math.random()*.5),0,-4-i*18-Math.random()*4);
    if(i%2===0){makeCar(g,carPaints[(i+(side>0?1:0))%carPaints.length],.75);g.rotation.y=side<0?Math.PI:0;}
    else {box(g,M.ochre,[0,.48,0],[.66,.92,.58]);box(g,M.red,[0,.98,0],[.73,.12,.64]);}
    scene.add(g);movingDecor.push(g);
  }
}
addScenery();

// Main roach is an original, expressive 3D character: glossy insect head, antennae, shell and signature red tee.
const bodyMat=mat(0x744023,.34,.1), shellMat=new THREE.MeshPhysicalMaterial({color:0x9b542b,roughness:.29,metalness:.12,clearcoat:.75,clearcoatRoughness:.2});
const shellLight=mat(0xc17a3d,.34,.1), darkMat=mat(0x3e281e,.36,.12), shirtMat=mat(0xed493b,.58), shirtShade=mat(0xc73630,.55), shoeMat=mat(0x27323a,.48), whiteMat=mat(0xffedcf,.25), eyeMat=new THREE.MeshPhysicalMaterial({color:0x141517,roughness:.08,clearcoat:1});
const playerShirts=[shirtMat,mat(0xe6b735,.56),mat(0x318fb0,.5)];
const playerHems=[shirtShade,mat(0xa27a20,.56),mat(0x246b86,.52)];
const skinCatalog=[{name:'KIRMIZI TİŞÖRTLÜ',price:0},{name:'SARI ŞİMŞEK',price:150},{name:'GECE NÖBETÇİSİ',price:350}];
let unlockedSkins;try{unlockedSkins=new Set([0,...JSON.parse(localStorage.getItem('hamamRunUnlocked')||'[0]')])}catch{unlockedSkins=new Set([0])}
const totalSeedBank=Number(localStorage.getItem('hamamRunSeeds')||0);
const initialSkin=unlockedSkins.has(Number(localStorage.getItem('hamamRunSkin')||0))?Number(localStorage.getItem('hamamRunSkin')||0):0;
function createRoach(isDiva=false,skinIndex=0) {
  const root=new THREE.Group();const model=new THREE.Group();root.add(model);root.userData.shirtParts=[];
  const torso=isDiva?mat(0x842d86,.54):playerShirts[skinIndex];
  const hem=isDiva?mat(0x57205e,.56):playerHems[skinIndex];
  // Lower abdomen and wing cases.
  addMesh(sphereGeo,shellMat,model,[0,.66,.14],[.39,.47,.38]);
  for(const side of [-1,1]){const wing=addMesh(sphereGeo,side===1?shellLight:shellMat,model,[side*.19,.74,.31],[.22,.34,.31]);wing.rotation.z=side*.15;}
  // Short-sleeve T-shirt over the upper torso.
  root.userData.shirtParts.push(addMesh(cylinderGeo,torso,model,[0,1.27,0],[.43,.59,.3]));
  root.userData.shirtParts.push(addMesh(sphereGeo,torso,model,[0,1.27,0],[.45,.36,.34]));
  root.userData.shirtParts.push(addMesh(cylinderGeo,hem,model,[0,.99,0],[.39,.08,.305]));
  // Head, snout, glossy eyes, pupils and expressive brow.
  addMesh(sphereGeo,bodyMat,model,[0,1.98,-.04],[.43,.39,.37]);
  addMesh(sphereGeo,shellLight,model,[0,1.82,-.3],[.26,.16,.18]);
  for(const side of [-1,1]){
    addMesh(sphereGeo,whiteMat,model,[side*.19,2.04,-.34],[.115,.145,.075]);
    addMesh(sphereGeo,eyeMat,model,[side*.19,2.03,-.405],[.069,.096,.045]);
    addMesh(sphereGeo,whiteMat,model,[side*.205,2.065,-.442],[.023,.027,.014]);
    cylinderBetween(model,darkMat,[side*.13,2.3,-.04],[side*.32,2.66,-.2],.034,.022,7);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.32,2.66,-.2),new THREE.Vector3(side*.4,2.85,-.37),new THREE.Vector3(side*.57,2.8,-.48)]);
    model.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)),new THREE.LineBasicMaterial({color:0x48281a})));
    // Arms swing opposite the stride.
    const arm=new THREE.Group();arm.position.set(side*.37,1.42,0);model.add(arm);
    cylinderBetween(arm,bodyMat,[0,0,0],[side*.22,-.31,-.08],.12,.095,8);
    cylinderBetween(arm,bodyMat,[side*.22,-.31,-.08],[side*.3,-.58,-.18],.095,.075,8);
    addMesh(sphereGeo,darkMat,arm,[side*.3,-.61,-.18],[.09,.1,.09]);root.userData.arms??=[];root.userData.arms.push({arm,side});
  }
  // Six insect legs emerge beneath the shirt; hinged pivots make a clear run cycle.
  root.userData.legs=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const pivot=new THREE.Group();pivot.position.set(side*.23,.84,.22-i*.22);model.add(pivot);
    cylinderBetween(pivot,darkMat,[0,0,0],[side*.25,-.27,0],.08,.055,7);
    cylinderBetween(pivot,darkMat,[side*.25,-.27,0],[side*.38,-.59,-.13],.055,.038,7);
    addMesh(sphereGeo,shoeMat,pivot,[side*.4,-.61,-.18],[.09,.055,.16]);
    root.userData.legs.push({pivot,side,index:i});
  }
  if(isDiva){
    // Distinct, sparkling purple chase character; feather-like collar and gold hair pins.
    for(let j=0;j<5;j++){const boa=addMesh(sphereGeo,mat(j%2?0xc352c9:0xec72bd,.4),model,[(j-2)*.12,1.58,.05],[.15,.18,.16]);boa.rotation.z=(j-2)*.18;}
    addMesh(sphereGeo,mat(0xf1c049,.25,.55),model,[-.12,2.35,-.14],[.055,.055,.045]);
    addMesh(sphereGeo,mat(0xf1c049,.25,.55),model,[.12,2.35,-.14],[.055,.055,.045]);
  }
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});root.userData.model=model;return root;
}
const player=createRoach(false,initialSkin);player.position.set(0,0,.5);scene.add(player);
const diva=createRoach(true);diva.scale.setScalar(.73);diva.position.set(2.8,0,2.7);scene.add(diva);

// Gameplay props
const coinMaterial=new THREE.MeshStandardMaterial({color:0xffca3e,roughness:.23,metalness:.62,emissive:0x9b5311,emissiveIntensity:.26});
const coinEdge=mat(0xffe78b,.22,.65);
const powerColors={shield:0x43d2dc,magnet:0xf25cb7,double:0xffbe34};
function makeObstacle(type,lane,z) {
  const g=new THREE.Group();g.position.set(LANES[lane],0,z);g.userData={kind:'obstacle',type,lane,hit:false};
  if(type==='car'){
    const paint=carPaints[Math.random()*carPaints.length|0];makeCar(g,paint,1.02);
    // A bright roof sign / roof rack catches the player's eye at distance.
    box(g,M.brass,[0,1.25,0],[.72,.1,.16]);
  }else if(type==='jump'){
    // Stacked market crates, with diagonal-ish bright planks.
    box(g,mat(0x99623c),[0,.38,0],[1.0,.72,.85]);box(g,mat(0xb27b4c),[0,.78,0],[.85,.11,.74]);
    for(const x of [-.28,0,.28])box(g,mat(0xd3a16b),[x,.42,-.438],[.075,.55,.045]);
  }else if(type==='slide'){
    const pipe=addMesh(cylinderGeo,M.iron,g,[0,1.62,0],[.12,1.2,.12]);pipe.rotation.z=Math.PI/2;
    for(const x of [-.48,.48]){const band=addMesh(cylinderGeo,M.brass,g,[x,1.62,0],[.2,.13,.2]);band.rotation.z=Math.PI/2;}
    box(g,mat(0xf0bc56),[0,1.28,0],[1.15,.12,.78]);
  }else{
    // Tall market waste bin: change lanes around it.
    const bin=addMesh(cylinderGeo,mat(0x477d77,.58),g,[0,.61,0],[.45,1.2,.45]);
    addMesh(cylinderGeo,M.iron,g,[0,1.22,0],[.5,.12,.5]);
    for(const x of [-.19,0,.19])box(g,mat(0xf1d48b),[x,.67,-.45],[.05,.55,.04]);
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g);obstacleGroups.push(g);return g;
}
function makeCoin(lane,z,index=0){
  const g=new THREE.Group();g.position.set(LANES[lane],0,z);g.userData={kind:'coin',taken:false,index};
  const disc=addMesh(new THREE.CylinderGeometry(.22,.22,.08,18),coinMaterial,g,[0,.86,0]);disc.rotation.x=Math.PI/2;
  const ring=addMesh(new THREE.TorusGeometry(.2,.035,8,18),coinEdge,g,[0,.86,0]);
  addMesh(new THREE.SphereGeometry(.07,10,8),coinEdge,g,[0,.86,-.045],[.7,1,.45]);
  const glow=new THREE.PointLight(0xffc83d,.45,2.1,2);glow.position.y=.86;g.add(glow);
  scene.add(g);coinGroups.push(g);return g;
}
function makePowerup(type,lane,z){
  const g=new THREE.Group();g.position.set(LANES[lane],0,z);g.userData={kind:'power',type,taken:false};
  const color=powerColors[type];const crystal=addMesh(new THREE.OctahedronGeometry(.34,1),mat(color,.25,.3,{emissive:color,emissiveIntensity:.25}),g,[0,1.02,0]);
  const ring=addMesh(new THREE.TorusGeometry(.48,.045,8,24),mat(0xffffff,.22,.4),g,[0,1.02,0]);ring.rotation.x=Math.PI/2;
  const point=new THREE.PointLight(color,1.4,3.5,2);point.position.y=1.1;g.add(point);g.userData.mesh=crystal;scene.add(g);powerGroups.push(g);return g;
}

const state={mode:'menu',lane:1,laneX:0,speed:10.3,distance:0,crumbCount:0,score:0,bonusScore:0,best:Number(localStorage.getItem('hamamRunBest')||0),totalSeeds:totalSeedBank,skinIndex:initialSkin,jumpY:0,jumpVelocity:0,jumpTime:0,slideTime:0,spawnTimer:1.4,elapsed:0,quipTimer:6,shield:0,magnet:0,double:0,flash:0,shake:0};
const $=id=>document.getElementById(id);const hud=document.querySelector('.hud');
const format=n=>String(Math.max(0,Math.floor(n))).padStart(5,'0');$('best-score').textContent=format(state.best);$('intro-best').textContent=format(state.best);$('total-seeds').textContent=state.totalSeeds;
function refreshSkinPicker(){const item=skinCatalog[state.skinBrowse||0];$('skin-name').textContent=item.name;const unlocked=unlockedSkins.has(state.skinBrowse||0);$('skin-buy').disabled=unlocked&&(state.skinBrowse||0)===state.skinIndex;$('skin-buy').textContent=unlocked?((state.skinBrowse||0)===state.skinIndex?'SEÇİLDİ':'KULLAN'):`AÇ · ${item.price} 🌻`}
state.skinBrowse=state.skinIndex;refreshSkinPicker();
let audioContext=null,soundOn=true,toastTimer=0;
function audio(){if(!soundOn)return null;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();return audioContext}catch{return null}}
function tone(freq,duration=.1,type='sine',volume=.035,endFreq=freq){const ctx=audio();if(!ctx)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),ctx.currentTime+duration);gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration)}
function coinSound(){tone(690,.08,'sine',.04,1100);setTimeout(()=>tone(980,.08,'sine',.025,1260),30)}
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),1150)}
function setMode(mode){state.mode=mode;hud.hidden=mode!=='running'&&mode!=='paused';$('pause-button').hidden=mode!=='running';$('touch-controls').hidden=mode!=='running'||matchMedia('(min-width: 701px)').matches;$('pause-overlay').hidden=mode!=='paused';$('result-overlay').hidden=mode!=='over'}
function resetRun(){for(const list of [obstacleGroups,coinGroups,powerGroups])for(const g of list)scene.remove(g);obstacleGroups.length=0;coinGroups.length=0;powerGroups.length=0;state.lane=1;state.laneX=0;state.speed=10.3;state.distance=0;state.crumbCount=0;state.score=0;state.bonusScore=0;state.jumpY=0;state.jumpVelocity=0;state.jumpTime=0;state.slideTime=0;state.spawnTimer=.85;state.elapsed=0;state.quipTimer=6;state.shield=0;state.magnet=0;state.double=0;state.flash=0;state.shake=0;player.position.set(0,0,.5);player.userData.model.scale.set(1,1,1);diva.position.set(2.8,0,2.7);$('distance').textContent='00000';$('crumb-count').textContent='0';$('power-indicator').hidden=true}
function startRun(){resetRun();setMode('running');$('intro-overlay').classList.add('leaving');audio();tone(430,.14,'triangle',.035,760)}
function pauseRun(){if(state.mode==='running')setMode('paused')}
function resumeRun(){if(state.mode==='paused'){setMode('running');audio()}}
function finishRun(){if(state.mode!=='running')return;state.score=scoreRun(state.distance,state.crumbCount,state.bonusScore);const newBest=state.score>state.best;if(newBest){state.best=state.score;localStorage.setItem('hamamRunBest',String(state.best));$('best-score').textContent=format(state.best);$('intro-best').textContent=format(state.best)}$('result-kicker').textContent=newBest?'🏆 YENİ REKOR!':'DIVA YAKALADI!';$('result-title').innerHTML=newBest?'ŞEHRİN YILDIZI<span>!</span>':'BİR SONRAKİ TURDA<span>!</span>';$('final-distance').textContent=format(state.score);$('final-crumbs').textContent=state.crumbCount;state.shake=.35;tone(180,.35,'sawtooth',.055,55);setMode('over')}
function jump(){if(state.mode!=='running'||state.jumpY>0||state.slideTime>.05)return;state.jumpVelocity=7.6;state.jumpTime=0;tone(320,.12,'triangle',.03,540)}
function slide(){if(state.mode!=='running'||state.jumpY>.2)return;state.slideTime=.78;tone(210,.11,'triangle',.025,135)}
function changeLane(d){if(state.mode!=='running')return;state.lane=moveLane(state.lane,d);tone(180+state.lane*45,.045,'sine',.016,230)}
function action(key){if(key==='ArrowLeft'||key.toLowerCase()==='a')changeLane(-1);else if(key==='ArrowRight'||key.toLowerCase()==='d')changeLane(1);else if(key==='ArrowUp'||key===' '||key.toLowerCase()==='w'){if(state.mode==='menu')startRun();else jump()}else if(key==='ArrowDown'||key.toLowerCase()==='s')slide();else if(key.toLowerCase()==='p'||key==='Escape')state.mode==='running'?pauseRun():resumeRun()}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();action(e.key)});
$('start-button').addEventListener('click',startRun);$('retry-button').addEventListener('click',startRun);$('pause-button').addEventListener('click',pauseRun);$('resume-button').addEventListener('click',resumeRun);$('home-button').addEventListener('click',()=>{setMode('menu');$('intro-overlay').classList.remove('leaving')});
function browseSkin(direction){state.skinBrowse=(state.skinBrowse+direction+skinCatalog.length)%skinCatalog.length;refreshSkinPicker()}
$('skin-prev').addEventListener('click',()=>browseSkin(-1));$('skin-next').addEventListener('click',()=>browseSkin(1));
$('skin-buy').addEventListener('click',()=>{const index=state.skinBrowse;const item=skinCatalog[index];if(!unlockedSkins.has(index)){if(state.totalSeeds<item.price){toast(`${item.price-state.totalSeeds} TOHUM DAHA LAZIM!`);return}state.totalSeeds-=item.price;unlockedSkins.add(index);localStorage.setItem('hamamRunSeeds',String(state.totalSeeds));localStorage.setItem('hamamRunUnlocked',JSON.stringify([...unlockedSkins]));$('total-seeds').textContent=state.totalSeeds}state.skinIndex=index;localStorage.setItem('hamamRunSkin',String(index));player.userData.shirtParts[0].material=playerShirts[index];player.userData.shirtParts[1].material=playerShirts[index];player.userData.shirtParts[2].material=playerHems[index];refreshSkinPicker();tone(620,.1,'triangle',.035,920)});
$('sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;$('sound-toggle').textContent=soundOn?'🔊':'🔇';$('sound-toggle').setAttribute('aria-label',soundOn?'Sesi kapat':'Sesi aç');if(soundOn)tone(620,.09)});
for(const b of document.querySelectorAll('.touch-controls button'))b.addEventListener('pointerdown',e=>{e.preventDefault();action(({left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',slide:'ArrowDown'})[b.dataset.action])});
let pointer=null;canvas.addEventListener('pointerdown',e=>pointer={x:e.clientX,y:e.clientY});canvas.addEventListener('pointerup',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(state.mode==='running'){if(Math.abs(dx)>28||Math.abs(dy)>28){if(Math.abs(dx)>Math.abs(dy))changeLane(dx>0?1:-1);else dy<0?jump():slide()}else if(e.clientY>innerHeight*.48)jump()}else if(state.mode==='menu'&&e.clientY>innerHeight*.24)startRun();pointer=null});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='running')pauseRun()});

function spawnWave(){const lane=Math.floor(Math.random()*3);const r=Math.random();const type=r<.34?'car':r<.58?'jump':r<.78?'slide':'block';makeObstacle(type,lane,-48);let safeLane=(lane+1+Math.floor(Math.random()*2))%3;if(Math.random()<.2)safeLane=lane;for(let i=0;i<6;i++)makeCoin(safeLane,-38-i*1.65,i);if(Math.random()<.13){const types=['shield','magnet','double'];makePowerup(types[Math.random()*types.length|0],(lane+1+Math.floor(Math.random()*2))%3,-51)}state.spawnTimer=nextSpawnDelay(Math.random,1+state.distance/420)}
function collectCoin(g){g.userData.taken=true;state.crumbCount++;state.totalSeeds++;localStorage.setItem('hamamRunSeeds',String(state.totalSeeds));$('total-seeds').textContent=state.totalSeeds;const mult=state.double>0?2:1;state.bonusScore+=25*(mult-1);state.score=scoreRun(state.distance,state.crumbCount,state.bonusScore);$('crumb-count').textContent=state.crumbCount;scene.remove(g);const i=coinGroups.indexOf(g);if(i>=0)coinGroups.splice(i,1);coinSound();if(state.crumbCount%15===0)toast('15 TOHUM! TAM GAZ!')}
function activatePower(type){if(type==='shield'){state.shield=12;toast('KALKAN AKTİF!')}else if(type==='magnet'){state.magnet=12;toast('TOHUM MIKNATISI!')}else{state.double=10;toast('2X SKOR!')}tone(550,.2,'triangle',.05,1100)}
function updateWorld(dt){
  for(let i=obstacleGroups.length-1;i>=0;i--){const o=obstacleGroups[i];o.position.z+=state.speed*dt;if(!o.userData.hit&&o.position.z>.05){o.userData.hit=true;if(o.userData.lane===state.lane&&!canAvoid(o.userData.type,state.jumpTime,state.slideTime)){if(state.shield>0){state.shield=0;scene.remove(o);obstacleGroups.splice(i,1);toast('KALKAN KURTARDI!');tone(360,.18,'triangle',.05,180);continue}else{finishRun();return}}}if(o.position.z>13){scene.remove(o);obstacleGroups.splice(i,1)}}
  for(let i=coinGroups.length-1;i>=0;i--){const g=coinGroups[i];g.position.z+=state.speed*dt;g.rotation.y+=dt*2.4;g.children[0].rotation.y+=dt*2.5;g.position.y=Math.sin(state.elapsed*5+i)*.08;if(!g.userData.taken&&Math.abs(g.position.z-.5)<.9&&(Math.abs(g.position.x-player.position.x)<.82||(state.magnet>0&&Math.abs(g.position.z-.5)<5)))collectCoin(g);if(g.position.z>12){scene.remove(g);coinGroups.splice(i,1)}}
  for(let i=powerGroups.length-1;i>=0;i--){const g=powerGroups[i];g.position.z+=state.speed*dt;g.rotation.y+=dt*1.8;g.userData.mesh.rotation.y+=dt*2.2;if(!g.userData.taken&&Math.abs(g.position.z-.5)<.9&&Math.abs(g.position.x-player.position.x)<.9){g.userData.taken=true;activatePower(g.userData.type);scene.remove(g);powerGroups.splice(i,1);continue}if(g.position.z>12){scene.remove(g);powerGroups.splice(i,1)}}
}
function updateCity(dt){for(const g of city){g.position.z+=dt*(state.mode==='running'?state.speed:.36);if(g.position.z>20)g.position.z-=97.5}for(const g of movingDecor){if(state.mode==='running')g.position.z+=dt*state.speed;if(g.position.z>10)g.position.z-=74}}

const clock=new THREE.Timer();clock.connect(document);
function animate(){clock.update();const dt=Math.min(Math.max(clock.getDelta(),0),.05);state.elapsed+=dt;const running=state.mode==='running';if(running){state.distance+=state.speed*dt*1.45;state.speed=Math.min(22,10.3+state.distance*.0027);state.score=scoreRun(state.distance,state.crumbCount,state.bonusScore);state.quipTimer-=dt;if(state.quipTimer<=0){const lines=['BÖCEK: Bu sokakları ezbere bilirim!','DIVA: Kaç kaç, yine yakalayacağım!','BÖCEK: Önce şu tohumları alayım!','DIVA: Ayakkabılarım yeni, yavaş koşacağım!'];toast(lines[Math.random()*lines.length|0]);state.quipTimer=12+Math.random()*8}state.spawnTimer-=dt;if(state.spawnTimer<=0)spawnWave();state.shield=Math.max(0,state.shield-dt);state.magnet=Math.max(0,state.magnet-dt);state.double=Math.max(0,state.double-dt);updateWorld(dt);if(state.jumpVelocity||state.jumpY>0){state.jumpTime+=dt;state.jumpY+=state.jumpVelocity*dt;state.jumpVelocity-=20*dt;if(state.jumpY<=0){state.jumpY=0;state.jumpVelocity=0;state.jumpTime=0}}if(state.slideTime>0)state.slideTime=Math.max(0,state.slideTime-dt);$('distance').textContent=format(state.score);const power=state.shield?'shield':state.magnet?'magnet':state.double?'double':null;$('power-indicator').hidden=!power;if(power){$('power-icon').textContent=power==='shield'?'🛡️':power==='magnet'?'🧲':'⚡';$('power-label').textContent=power==='shield'?'KALKAN':power==='magnet'?'MIKNATIS':'2X SKOR';$('power-timer').style.width=`${Math.max(8,(state[power==='double'?'double':power])*8)}px`}}
  if(state.mode==='running'||state.mode==='menu')updateCity(dt);
  const target=state.mode==='menu'?1.0:LANES[state.lane];state.laneX+=(target-state.laneX)*Math.min(1,dt*12);player.position.x=state.laneX;player.position.y=state.jumpY;
  const stride=Math.sin(state.elapsed*(running?13:2.4));for(const leg of player.userData.legs)leg.pivot.rotation.x=running?stride*(leg.index%2===0?1:-1)*.42:Math.sin(state.elapsed*2+leg.index)*.07;for(const arm of player.userData.arms)arm.arm.rotation.x=running?-stride*arm.side*.32:0;
  const crouch=state.slideTime>0?.56:1;player.userData.model.scale.y+=(crouch-player.userData.model.scale.y)*Math.min(1,dt*14);player.userData.model.position.y=running&&state.jumpY===0?Math.abs(stride)*.035:0;player.userData.model.rotation.z=(target-state.laneX)*-.065;
  // Diva bobs along the curb, always visible in the chase/title composition.
  diva.position.y=Math.sin(state.elapsed*3)*.045;diva.userData.model.rotation.z=Math.sin(state.elapsed*2.1)*.035;
  const menuFrameX=innerWidth<700?1.9:.2;const cameraTargetX=state.mode==='menu'?menuFrameX:player.position.x*.1;camera.position.x+=(cameraTargetX-camera.position.x)*dt*1.6;camera.position.y=3.8+Math.sin(state.elapsed*1.2)*.025;camera.lookAt(cameraTargetX,1.15+state.jumpY*.08,-10);
  sun.position.x=player.position.x-7;renderer.render(scene,camera)}
renderer.setAnimationLoop(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));$('touch-controls').hidden=state.mode!=='running'||matchMedia('(min-width: 701px)').matches});
window.addEventListener('contextmenu',e=>e.preventDefault());
Object.assign(window,{renderer,scene,gameState:state});
