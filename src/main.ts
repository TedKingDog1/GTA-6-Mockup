import * as THREE from 'three';
import './style.css';
import { createPlayerCharacter } from './character';
import { resolveCircleAabbs, type BoxCollider } from './collision';

type Mode = 'on-foot' | 'driving';
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8eb9c8);
scene.fog = new THREE.FogExp2(0x9bbdc0, 0.00165);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1800);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.querySelector<HTMLDivElement>('#app')!.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xc6e4ff, 0x405044, 2.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b2, 3.1); sun.position.set(-180, 260, 100); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-240; sun.shadow.camera.right=240; sun.shadow.camera.top=240; sun.shadow.camera.bottom=-240; scene.add(sun);

const mat = (color: number, roughness=0.86, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
function noiseMap(base:string,spread:number,seedValue:number):THREE.CanvasTexture{
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const context=canvas.getContext('2d')!;context.fillStyle=base;context.fillRect(0,0,256,256);
 const image=context.getImageData(0,0,256,256),data=image.data;let state=seedValue>>>0;
 for(let i=0;i<data.length;i+=4){state=(state*1664525+1013904223)>>>0;const n=((state>>>24)/255-0.5)*spread;data[i]=Math.max(0,Math.min(255,data[i]+n));data[i+1]=Math.max(0,Math.min(255,data[i+1]+n));data[i+2]=Math.max(0,Math.min(255,data[i+2]+n));}
 context.putImageData(image,0,0);
 // Fine aggregate and subtle surface variation, generated locally without external assets.
 for(let i=0;i<950;i++){state=(state*1664525+1013904223)>>>0;const x=state%256;state=(state*1664525+1013904223)>>>0;const y=state%256;context.fillStyle='rgba(12,16,14,0.10)';context.fillRect(x,y,1+(state%2),1);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.anisotropy=4;return texture;
}
const asphaltMap=noiseMap('#303638',42,17), concreteMap=noiseMap('#aaa99b',26,31), grassMap=noiseMap('#657b58',38,53);
const groundMat=new THREE.MeshStandardMaterial({color:0xffffff,map:grassMap,roughness:1});
const roadMat=new THREE.MeshStandardMaterial({color:0xffffff,map:asphaltMap,roughness:0.96});
const sidewalkMat=new THREE.MeshStandardMaterial({color:0xffffff,map:concreteMap,roughness:0.94});
const lineMat=mat(0xe6dfc2), waterMat=new THREE.MeshStandardMaterial({color:0x247d91,roughness:0.27,metalness:0.12});
const boxGeo=new THREE.BoxGeometry(1,1,1);
function box(x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material, parent:THREE.Object3D=scene) {
 const o=new THREE.Mesh(boxGeo,m); o.position.set(x,y,z); o.scale.set(sx,sy,sz); o.castShadow=sy>1.5; o.receiveShadow=true; parent.add(o); return o;
}
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,8);
function cylinder(x:number,y:number,z:number,r:number,h:number,m:THREE.Material,parent:THREE.Object3D=scene) {
 const o=new THREE.Mesh(cylinderGeo,m); o.position.set(x,y,z); o.scale.set(r,h,r); o.castShadow=true; parent.add(o); return o;
}
const world=new THREE.Group(); scene.add(world);
box(0,-1.2,0,1200,2,1200,groundMat,world);
const water=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),waterMat); water.rotation.x=-Math.PI/2; water.position.set(0,-0.08,-500); world.add(water);
// Main road grid and sidewalks
const roadCoords:number[]=[];
for(let i=-5;i<=5;i++) roadCoords.push(i*72);
for(const x of roadCoords){
 box(x,0.03,0,18,0.12,820,roadMat,world);
 box(x-10,0.12,0,3,0.22,820,sidewalkMat,world); box(x+10,0.12,0,3,0.22,820,sidewalkMat,world);
 for(let z=-390;z<410;z+=18) box(x,0.105,z,0.22,0.025,7,lineMat,world);
}
for(const z of roadCoords){
 box(0,0.04,z,820,0.12,18,roadMat,world);
 box(0,0.12,z-10,820,0.22,3,sidewalkMat,world); box(0,0.12,z+10,820,0.22,3,sidewalkMat,world);
 for(let x=-390;x<410;x+=18) box(x,0.105,z,7,0.025,0.22,lineMat,world);
}
// City blocks: varied towers, homes, shops, rooftop equipment and storefronts
const palettes=[0xd2c3a6,0xb9c3bd,0x8eaaa8,0xd8d0bd,0x8e969a,0xe0b98c,0xaab8c8,0xceb9a8];
const windowMats=[mat(0x5c8490,0.28,0.12),mat(0x263d49,0.3,0.1),mat(0xd5b77c,0.35)];
const seed=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
let buildingCount=0;
const buildingColliders:BoxCollider[]=[];
const buildingMaterials=palettes.map(color=>mat(color));
const facadeTrimMat=mat(0x5a625d), doorMat=mat(0x263b40,0.35,0.08), signMat=mat(0xd3a75c);
const rooftopMat=mat(0x626d70), rooftopMetalMat=mat(0x9ba4a0), rooftopCapMat=mat(0x6d7773);
for(let gx=-5;gx<5;gx++) for(let gz=-5;gz<5;gz++){
 const cx=gx*72+36, cz=gz*72+36;
 for(let j=0;j<4;j++){
  const x=cx+(j%2?12:-12), z=cz+(j<2?12:-12);
  const h= (Math.abs(gx)<2&&Math.abs(gz)<2 ? 18+seed(buildingCount+2)*75 : 7+seed(buildingCount+2)*22);
  const w=17+seed(buildingCount+4)*4, d=16+seed(buildingCount+8)*5;
  const paletteIndex=Math.floor(seed(buildingCount+3)*palettes.length);
  const building=box(x,h/2,z,w,h,d,buildingMaterials[paletteIndex],world); buildingCount++;
  buildingColliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  // Facade trim, entrance, and signage add visual depth to the street-facing side.
  for(const side of [-1,1]){const pilaster=box(x+side*(w/2-0.22),h/2,z+d/2+0.035,0.22,h,0.09,facadeTrimMat,world);pilaster.castShadow=false;}
  box(x,1.0,z+d/2+0.045,Math.min(1.45,w*0.22),1.9,0.08,doorMat,world);
  if(buildingCount%4===0){const sign=box(x,2.35,z+d/2+0.11,w*0.48,0.42,0.12,signMat,world);sign.castShadow=false;}
  const floors=Math.max(2,Math.floor(h/3.5));
  for(let f=0;f<floors;f++){
   const yy=1.7+f*3.25;
   for(let wx=-1;wx<=1;wx++){
    const pane=box(x+wx*w*0.27,yy,z+d/2+0.012,w*0.17,1.35,0.035,windowMats[(buildingCount+f+wx+3)%3],world);
    pane.castShadow=false;
   }
   // A second window rhythm on the side wall breaks up the flat block silhouette.
   const sidePane=box(x+w/2+0.012,yy,z,w*0.035,1.25,1.0,windowMats[(buildingCount+f+1)%3],world);
   sidePane.castShadow=false;
   if(f===0&&buildingCount%3===0){
    const awning=box(x,1.15,z+d/2+0.12,w*0.9,0.18,0.42,mat(0x536d70),world);
    awning.castShadow=true;
   }
  }
  if(h>35){box(x,h+1,z,w*0.35,1.5,d*0.35,rooftopMat,world); cylinder(x+2,h+3,z+1,0.65,3,rooftopMetalMat,world);}
  else {box(x,h+0.4,z,w*0.45,0.8,d*0.4,rooftopCapMat,world);}
 }
}
// Parks, palms, streetlights
const trunk=mat(0x77543b), leaf=mat(0x26734c), lampMat=mat(0x293437,0.5,0.6), glowMat=new THREE.MeshBasicMaterial({color:0xffe2a3});
for(let i=0;i<260;i++){
 const x=(seed(i+40)-0.5)*760, z=(seed(i+80)-0.5)*760;
 if(Math.abs(x%72)<13 || Math.abs(z%72)<13) continue;
 const park=seed(i+120)>0.76;
 if(park && i%2===0) box(x,0.2,z,9,0.35,8,mat(0x4c784b),world);
 const height=4.2+seed(i+160)*2.5;
 cylinder(x,height/2,z,0.24,height,trunk,world);
 const crown=new THREE.Group(); crown.position.set(x,height,z); world.add(crown);
 for(let k=0;k<6;k++){const fr=new THREE.Mesh(new THREE.ConeGeometry(0.38,4.8,5),leaf);fr.rotation.z=Math.PI/2;fr.rotation.y=k*Math.PI/3;fr.position.set(Math.cos(k*Math.PI/3)*1.2,0,Math.sin(k*Math.PI/3)*1.2);crown.add(fr);}
 const bulb=cylinder(x,0,z,0.055,5.5,lampMat,world); bulb.position.x=x;
}
// Beach and marina edge
for(let i=0;i<28;i++){const x=-430+i*31; box(x,0.05,-425,28,0.12,55,mat(0xd7c79b),world);}
for(let i=0;i<18;i++){const x=-360+i*38; box(x,0.6,-480,18,1.2,5,mat(0x73533b),world);}
// Player: articulated procedural character with smooth anatomical volumes.
const character=createPlayerCharacter();
const player=character.root;scene.add(player);
player.position.set(0,0,0);
// Vehicle builder
type Vehicle={root:THREE.Group;speed:number;yaw:number;ai:boolean;route:number;phase:number;paint:number};
const vehicles:Vehicle[]=[];
const carColors=[0xb83d32,0xd5d2c5,0x263d59,0x777d7c,0xd0a33f,0x276b57,0x171b20];
function makeCar(x:number,z:number,color:number,ai=false):Vehicle{
 const root=new THREE.Group();scene.add(root);
 box(0,0.78,0,2.05,0.8,4.2,mat(color,0.34,0.28),root);
 box(0,1.43,-0.12,1.72,0.72,2.15,mat(0x9ab5bd,0.24,0.12),root);
 box(0,1.85,-0.12,1.48,0.08,1.85,mat(color,0.35),root);
 for(const wx of [-1,1])for(const wz of [-1.35,1.35]){
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.24,12),mat(0x17191a,0.95));wheel.rotation.z=Math.PI/2;wheel.position.set(wx,0.48,wz);root.add(wheel);
 }
 for(const wx of [-0.68,0.68]){box(wx,0.9,2.11,0.35,0.22,0.05,glowMat,root);box(wx,0.9,-2.11,0.35,0.22,0.05,mat(0x9c2924),root);}
 root.position.set(x,0,z);
 const v={root,speed:0,yaw:0,ai,route:0,phase:Math.random()*Math.PI*2,paint:color};vehicles.push(v);return v;
}
const playerCar=makeCar(5,10,0x286f9c,false);
for(let i=0;i<22;i++){
 const horizontal=i%2===0, lane=Math.floor(i/2)%2===0? -4.5:4.5, road=roadCoords[(i*3)%roadCoords.length];
 const v=makeCar(horizontal?road:lane,horizontal?lane:road,carColors[i%carColors.length],true);
 v.yaw=horizontal?(i%4<2?Math.PI/2:-Math.PI/2):(i%4<2?0:Math.PI);
 v.root.rotation.y=v.yaw;v.phase=i*0.7;
}
// UI
const ui=document.createElement('div');ui.id='hud';ui.innerHTML=`
 <div class="brand"><span class="brand-mark">V</span><div><b>VICE CITY</b><small>LEONIDA • OPEN WORLD</small></div></div>
 <div class="top-right"><div class="clock" id="clock">10:42</div><div class="cash">$ 24,850</div><div class="wanted" id="wanted">☆☆☆☆☆</div></div>
 <div class="mission"><small>FREE ROAM</small><b id="objective">Explore the city</b><span>Find a vehicle. See where the road takes you.</span></div>
 <div class="minimap-wrap"><canvas id="minimap" width="180" height="180"></canvas><div class="map-label">VICE CITY · M TO EXPAND</div></div>
 <div class="map-screen hidden" id="map-screen"><div class="map-panel"><div class="map-heading"><div><small>LEONIDA</small><h2>VICE CITY</h2></div><span>MAP  ·  M / ESC TO CLOSE</span></div><canvas id="world-map" width="720" height="720"></canvas><div class="map-legend"><span><i class="legend-player"></i> YOU</span><span><i class="legend-road"></i> ROADS</span><span><i class="legend-building"></i> BUILDINGS</span><span><i class="legend-traffic"></i> TRAFFIC</span></div></div></div>
 <div class="help" id="help"><b>CLICK</b> Lock mouse <b>WASD</b> Move / Drive <b>SHIFT</b> Sprint <b>E</b> Enter <b>F</b> Exit <b>ESC</b> Pause</div>
 <div class="speedometer" id="speedometer"><strong id="speed">000</strong><span>KM/H</span></div>
 <div class="toast" id="toast">Welcome to Vice City</div>
 <div class="pause hidden" id="pause"><div class="pause-card"><small>VICE CITY</small><h1>PAUSED</h1><p>Your city. Your rules.</p><button id="resume">RESUME GAME</button><div>WASD Move / Drive · E Enter · F Exit · Shift Sprint</div></div></div>`;
document.body.appendChild(ui);
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const toast=$<HTMLDivElement>('toast');let toastTimer=0;
function notify(message:string){toast.textContent=message;toast.classList.add('show');toastTimer=performance.now()+2300;}
let mode:Mode='on-foot',activeCar:Vehicle|null=null,paused=false,dayTime=0.43,elapsed=0;
const keys=new Set<string>();let yaw=0,mapOpen=false;
const mapScreen=$<HTMLDivElement>('map-screen');
addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyM'&&!paused){mapOpen=!mapOpen;mapScreen.classList.toggle('hidden',!mapOpen);if(mapOpen)drawWorldMap();}if(e.code==='Escape'){if(mapOpen){mapOpen=false;mapScreen.classList.add('hidden');}else{paused=!paused;$<HTMLDivElement>('pause').classList.toggle('hidden',!paused);}}});
addEventListener('keyup',e=>keys.delete(e.code));
$('resume').addEventListener('click',()=>{paused=false;$<HTMLDivElement>('pause').classList.add('hidden');renderer.domElement.requestPointerLock();});
// Pointer lock gives the camera true FPS-style mouse look. Click the game to capture.
renderer.domElement.addEventListener('click',()=>{
 if(!paused&&document.pointerLockElement!==renderer.domElement) renderer.domElement.requestPointerLock();
});
addEventListener('mousemove',e=>{
 if(document.pointerLockElement===renderer.domElement&&!paused) yaw-=e.movementX*0.0024;
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{
 const locked=document.pointerLockElement===renderer.domElement;
 $('help').classList.toggle('mouse-locked',locked);
});
function enterCar(){
 let nearest:Vehicle|null=null,dist=5.4;
 for(const v of vehicles){if(v.ai)continue;const d=v.root.position.distanceTo(player.position);if(d<dist){dist=d;nearest=v;}}
 if(nearest){activeCar=nearest;mode='driving';player.visible=false;notify('Vehicle entered • Use WASD to drive');}
 else notify('Get closer to a vehicle to enter');
}
function exitCar(){if(!activeCar)return;player.position.copy(activeCar.root.position).add(new THREE.Vector3(2.5,0,0));activeCar.speed=0;activeCar=null;mode='on-foot';player.visible=true;notify('Vehicle exited');}
function update(dt:number){
 if(paused||mapOpen)return;
 elapsed+=dt;dayTime=(dayTime+dt*0.0012)%1;
 const sunAngle=dayTime*Math.PI*2;
 sun.position.set(Math.cos(sunAngle)*250,Math.sin(sunAngle)*300,100);
 sun.intensity=Math.max(0.35,Math.sin(sunAngle)*2.5+0.5);
 hemi.intensity=Math.max(0.45,Math.sin(sunAngle)*1.3+0.75);
 const hour=Math.floor(dayTime*24),minute=Math.floor((dayTime*24-hour)*60);
 $('clock').textContent=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 if(keys.has('KeyE')){keys.delete('KeyE');if(mode==='on-foot')enterCar();}
 if(keys.has('KeyF')){keys.delete('KeyF');if(mode==='driving')exitCar();}
 if(mode==='on-foot'){
  const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  const sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const speed=sprinting?13:7;
  const direction=new THREE.Vector3(side,0,-forward);if(direction.lengthSq()>0){direction.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw);const previous=player.position.clone();player.position.addScaledVector(direction,speed*dt);resolveCircleAabbs(player.position,0.52,buildingColliders,previous);player.rotation.y=Math.atan2(-direction.x,-direction.z);}
  player.position.x=THREE.MathUtils.clamp(player.position.x,-390,390);player.position.z=THREE.MathUtils.clamp(player.position.z,-410,410);
  character.update(elapsed,direction.lengthSq()>0,sprinting);
 }else if(activeCar){
  const throttle=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
  const steering=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  activeCar.speed+=throttle*24*dt;activeCar.speed*=Math.pow(0.985,dt*60);
  activeCar.speed=THREE.MathUtils.clamp(activeCar.speed,-13,42);
  activeCar.yaw+=steering*dt*(1.65+Math.abs(activeCar.speed)*0.035)*Math.sign(activeCar.speed||1);
  activeCar.root.rotation.y=activeCar.yaw;
  const carPrevious=activeCar.root.position.clone();
  activeCar.root.position.x-=Math.sin(activeCar.yaw)*activeCar.speed*dt;
  activeCar.root.position.z-=Math.cos(activeCar.yaw)*activeCar.speed*dt;
  if(resolveCircleAabbs(activeCar.root.position,2.05,buildingColliders,carPrevious)){activeCar.speed=0;}
  activeCar.root.position.x=THREE.MathUtils.clamp(activeCar.root.position.x,-395,395);activeCar.root.position.z=THREE.MathUtils.clamp(activeCar.root.position.z,-415,415);
  $('speed').textContent=String(Math.round(Math.abs(activeCar.speed)*3.6)).padStart(3,'0');
 }
 for(const v of vehicles){if(!v.ai)continue;const distance=dt*8;v.root.position.x-=Math.sin(v.yaw)*distance;v.root.position.z-=Math.cos(v.yaw)*distance;
  if(Math.abs(v.root.position.x)>410||Math.abs(v.root.position.z)>430){v.root.position.set(v.root.position.x>0?-405:405,0,v.root.position.z>0?-425:425);}
 }
 if(mode==='on-foot')$('speedometer').classList.remove('active');else $('speedometer').classList.add('active');
 const focus=mode==='driving'&&activeCar?activeCar.root.position:player.position;
 const targetYaw=mode==='driving'&&activeCar?activeCar.yaw:yaw;
 const cameraOffset=new THREE.Vector3(Math.sin(targetYaw)*8,5.2,Math.cos(targetYaw)*8);
 const desired=focus.clone().add(cameraOffset);camera.position.lerp(desired,1-Math.pow(0.001,dt));camera.lookAt(focus.clone().add(new THREE.Vector3(0,1.35,0)));
 if(toastTimer<performance.now())toast.classList.remove('show');
 drawMap(focus,targetYaw);
}
const map=$<HTMLCanvasElement>('minimap'),ctx=map.getContext('2d')!;
const worldMap=$<HTMLCanvasElement>('world-map'),worldCtx=worldMap.getContext('2d')!;
function drawMap(pos:THREE.Vector3,angle:number){
 ctx.clearRect(0,0,180,180);ctx.fillStyle='#182629';ctx.fillRect(0,0,180,180);
 ctx.save();ctx.translate(90,90);ctx.rotate(-angle);
 const scale=0.72;ctx.fillStyle='#777d70';
 for(const c of buildingColliders)ctx.fillRect((c.minX-pos.x)*scale,(c.minZ-pos.z)*scale,(c.maxX-c.minX)*scale,(c.maxZ-c.minZ)*scale);
 ctx.strokeStyle='#b2b2a0';ctx.lineWidth=5;
 for(const road of roadCoords){const offset=(road-pos.x)*scale;ctx.beginPath();ctx.moveTo(offset,-170);ctx.lineTo(offset,170);ctx.stroke();const zOffset=(road-pos.z)*scale;ctx.beginPath();ctx.moveTo(-170,zOffset);ctx.lineTo(170,zOffset);ctx.stroke();}
 for(const v of vehicles){if(v===activeCar)continue;const dx=(v.root.position.x-pos.x)*scale,dz=(v.root.position.z-pos.z)*scale;ctx.fillStyle='#e0a34c';ctx.beginPath();ctx.arc(dx,dz,2.3,0,Math.PI*2);ctx.fill();}
 ctx.restore();
 ctx.save();ctx.translate(90,90);ctx.rotate(-angle);ctx.fillStyle='#f4e7a7';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
}
function drawWorldMap(){
 const w=worldMap.width,h=worldMap.height,sx=w/840,sz=h/1000;
 const px=(x:number)=>(x+420)*sx,py=(z:number)=>(z+550)*sz;
 worldCtx.clearRect(0,0,w,h);worldCtx.fillStyle='#263b35';worldCtx.fillRect(0,0,w,h);
 worldCtx.fillStyle='#c9b78d';worldCtx.fillRect(0,py(-450),w,py(-398)-py(-450));
 worldCtx.fillStyle='#247d91';worldCtx.fillRect(0,0,w,py(-450));
 worldCtx.fillStyle='#a7a58d';
 for(const c of buildingColliders)worldCtx.fillRect(px(c.minX),py(c.minZ),(c.maxX-c.minX)*sx,(c.maxZ-c.minZ)*sz);
 worldCtx.strokeStyle='#89928a';worldCtx.lineWidth=11;
 for(const road of roadCoords){worldCtx.beginPath();worldCtx.moveTo(px(road),0);worldCtx.lineTo(px(road),h);worldCtx.stroke();worldCtx.beginPath();worldCtx.moveTo(0,py(road));worldCtx.lineTo(w,py(road));worldCtx.stroke();}
 worldCtx.fillStyle='#e4d7b4';worldCtx.font='bold 17px Inter';worldCtx.fillText('VICE CITY',w*0.42,h*0.48);
 for(const v of vehicles){if(v.ai){worldCtx.fillStyle='#e0a34c';worldCtx.beginPath();worldCtx.arc(px(v.root.position.x),py(v.root.position.z),4,0,Math.PI*2);worldCtx.fill();}}
 const focus=mode==='driving'&&activeCar?activeCar.root.position:player.position;
 const angle=mode==='driving'&&activeCar?activeCar.yaw:yaw;
 worldCtx.save();worldCtx.translate(px(focus.x),py(focus.z));worldCtx.rotate(-angle);worldCtx.fillStyle='#f4e7a7';worldCtx.beginPath();worldCtx.moveTo(0,-13);worldCtx.lineTo(9,10);worldCtx.lineTo(0,5);worldCtx.lineTo(-9,10);worldCtx.closePath();worldCtx.fill();worldCtx.restore();
}
function animate(now:number){requestAnimationFrame(animate);const dt=Math.min((now-lastFrame)/1000,0.04);lastFrame=now;update(dt);renderer.render(scene,camera);}
let lastFrame=performance.now();requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
notify('Welcome to Vice City');
