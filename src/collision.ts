import * as THREE from 'three';

export type BoxCollider = { minX:number; maxX:number; minZ:number; maxZ:number };

/** Resolve a circular actor against axis-aligned building bounds. Returns true when contact occurred. */
export function resolveCircleAabbs(position:THREE.Vector3,radius:number,colliders:BoxCollider[],previous:THREE.Vector3):boolean {
  let collided=false;
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(const box of colliders){
      const closestX=THREE.MathUtils.clamp(position.x,box.minX,box.maxX);
      const closestZ=THREE.MathUtils.clamp(position.z,box.minZ,box.maxZ);
      const dx=position.x-closestX,dz=position.z-closestZ;
      const distanceSq=dx*dx+dz*dz;
      if(distanceSq>=radius*radius)continue;
      collided=true;changed=true;
      if(distanceSq>1e-8){const distance=Math.sqrt(distanceSq),push=radius-distance;position.x+=(dx/distance)*push;position.z+=(dz/distance)*push;}
      else{
        const left=Math.abs(position.x-box.minX),right=Math.abs(box.maxX-position.x);
        const back=Math.abs(position.z-box.minZ),front=Math.abs(box.maxZ-position.z);
        const nearest=Math.min(left,right,back,front);
        if(nearest===left)position.x=box.minX-radius;else if(nearest===right)position.x=box.maxX+radius;
        else if(nearest===back)position.z=box.minZ-radius;else position.z=box.maxZ+radius;
      }
    }
    if(!changed)break;
  }
  if(collided){if(Math.abs(position.x-previous.x)>radius*2.5)position.x=previous.x;if(Math.abs(position.z-previous.z)>radius*2.5)position.z=previous.z;}
  return collided;
}
