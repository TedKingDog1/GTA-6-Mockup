import * as THREE from 'three';

export type CharacterRig = {
  root: THREE.Group;
  update: (time: number, moving: boolean, sprinting: boolean) => void;
};

const material = (color:number, roughness=0.82, metalness=0) =>
  new THREE.MeshStandardMaterial({color, roughness, metalness});

function capsule(radius:number, length:number, mat:THREE.Material, radial=16) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,6,radial),mat);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

export function createPlayerCharacter(): CharacterRig {
  const root=new THREE.Group();
  const skin=material(0xb98268), shirt=material(0x273f45), shirtDark=material(0x1d3036),
    pants=material(0x303942), shoes=material(0x171b1e,0.72), sole=material(0x080b0d),
    hair=material(0x29221e), eye=material(0x171719), trim=material(0x9b9b89);

  // Torso uses overlapping tapered volumes instead of a single rectangular box.
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(0.34,20,16),pants);
  pelvis.scale.set(1,0.72,0.72); pelvis.position.y=1.02; pelvis.castShadow=true; root.add(pelvis);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.34,0.52,8,24),shirt);
  torso.scale.set(1.05,1.0,0.72); torso.position.y=1.64; torso.castShadow=true; torso.receiveShadow=true; root.add(torso);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(0.345,24,18),shirt);
  chest.scale.set(1.08,0.58,0.76); chest.position.set(0,1.88,0); chest.castShadow=true; root.add(chest);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(0.145,0.035,8,20),shirtDark);
  collar.rotation.x=Math.PI/2; collar.position.set(0,2.02,0.005); root.add(collar);
  const neck=capsule(0.105,0.12,skin,16); neck.position.y=2.13; root.add(neck);

  const head=new THREE.Group(); head.position.y=2.42; root.add(head);
  const skull=new THREE.Mesh(new THREE.SphereGeometry(0.235,28,22),skin);
  skull.scale.set(0.91,1.13,0.91); skull.castShadow=true; skull.receiveShadow=true; head.add(skull);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(0.239,24,16,0,Math.PI*2,0,Math.PI*0.55),hair);
  hairCap.scale.set(0.94,1.12,0.96); hairCap.position.y=0.035; hairCap.castShadow=true; head.add(hairCap);
  const earGeo=new THREE.SphereGeometry(0.055,12,10);
  for(const side of [-1,1]){const ear=new THREE.Mesh(earGeo,skin);ear.position.set(side*0.22,-0.015,0);head.add(ear);}
  for(const side of [-1,1]){const eyeMesh=new THREE.Mesh(new THREE.SphereGeometry(0.018,10,8),eye);eyeMesh.position.set(side*0.085,0.025,-0.207);head.add(eyeMesh);}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(0.035,10,8),skin);nose.scale.set(0.7,1.2,0.8);nose.position.set(0,-0.045,-0.225);head.add(nose);

  const shoulderPivots:THREE.Group[]=[];
  const elbowPivots:THREE.Group[]=[];
  for(const side of [-1,1]){
    const shoulder=new THREE.Group(); shoulder.position.set(side*0.39,1.91,0); root.add(shoulder); shoulderPivots.push(shoulder);
    const upper=capsule(0.135,0.48,shirt); upper.position.y=-0.31; upper.rotation.z=side*0.04; shoulder.add(upper);
    const elbow=new THREE.Group(); elbow.position.y=-0.57; shoulder.add(elbow); elbowPivots.push(elbow);
    const forearm=capsule(0.105,0.39,shirt,14); forearm.position.y=-0.24; elbow.add(forearm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.105,14,12),skin);hand.position.y=-0.51;hand.scale.set(0.82,1.1,0.72);elbow.add(hand);
    const cuff=new THREE.Mesh(new THREE.TorusGeometry(0.108,0.018,6,16),shirtDark);cuff.position.y=-0.42;elbow.add(cuff);
  }

  const hipPivots:THREE.Group[]=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*0.19,1.0,0);root.add(hip);hipPivots.push(hip);
    const thigh=capsule(0.17,0.48,pants,18);thigh.position.y=-0.31;hip.add(thigh);
    const knee=new THREE.Group();knee.position.y=-0.59;hip.add(knee);
    const shin=capsule(0.125,0.43,pants,16);shin.position.y=-0.25;knee.add(shin);
    const ankle=capsule(0.105,0.08,shoes,14);ankle.position.y=-0.49;knee.add(ankle);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.13,0.39),shoes);foot.position.set(0,-0.56,0.09);foot.castShadow=true;knee.add(foot);
    const soleMesh=new THREE.Mesh(new THREE.BoxGeometry(0.245,0.035,0.4),sole);soleMesh.position.set(0,-0.625,0.09);knee.add(soleMesh);
  }

  // Subtle clothing seams and a rear belt line give the silhouette more definition.
  const belt=new THREE.Mesh(new THREE.TorusGeometry(0.265,0.025,6,24),trim);
  belt.rotation.x=Math.PI/2;belt.position.y=1.16;root.add(belt);

  let gait=0;
  return {
    root,
    update:(time,moving,sprinting)=>{
      const amount=moving?1:0, rate=sprinting?13.5:9.5, stride=sprinting?0.72:0.48;
      const idleBreath=Math.sin(time*2.1)*0.012;
      gait=time*rate;
      hipPivots.forEach((hip,i)=>{
        const phase=gait+i*Math.PI;
        hip.rotation.x=Math.sin(phase)*stride*amount;
        const knee=hip.children[1] as THREE.Group;
        knee.rotation.x=Math.max(0,Math.sin(phase+0.45))*0.85*amount;
      });
      shoulderPivots.forEach((arm,i)=>{
        const phase=gait+i*Math.PI;
        arm.rotation.x=-Math.sin(phase)*0.42*amount + idleBreath*0.35;
        arm.rotation.z=(i===0?-1:1)*(0.035+Math.sin(phase)*0.025*amount);
      });
      elbowPivots.forEach((elbow,i)=>{elbow.rotation.x=(0.12+Math.max(0,Math.sin(gait+i*Math.PI+0.5))*0.42)*amount;});
      root.position.y=moving?Math.abs(Math.sin(gait*2))*0.045:idleBreath;
      torso.rotation.z=moving?Math.sin(gait)*0.025:0;
      torso.rotation.x=moving?Math.sin(gait*2)*0.018:idleBreath*0.45;
      head.rotation.y=moving?Math.sin(gait*0.5)*0.035:Math.sin(time*0.7)*0.012;
      head.rotation.x=moving?Math.sin(gait*2)*0.012:0;
    }
  };
}
