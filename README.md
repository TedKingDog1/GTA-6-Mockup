# Vice City — Open World Prototype

A browser-based open-world driving and exploration prototype built with Three.js, TypeScript, and Vite.

## Run locally or in Codespaces

```bash
npm install
npm run dev
```

Open the forwarded port 5173.

## Controls

- **WASD** — walk / drive
- **Shift** — sprint on foot
- **E** — enter the nearest vehicle
- **F** — exit vehicle
- **Mouse right-button drag** — orbit camera
- **Escape** — pause

## Current systems

- Procedurally assembled city grid with varied buildings, roads, sidewalks, trees, beach and water
- Third-person character controller
- Drivable player vehicle with acceleration, braking, steering and speed HUD
- Ambient AI traffic vehicles
- Day/night lighting cycle
- Minimap, objective HUD, clock, pause overlay and notifications

This is an original fan-made prototype and is not affiliated with Rockstar Games.


### Camera
Click inside the game viewport to capture the mouse and look around. Press Escape to release the mouse and open the pause menu. Resume to capture it again.

### Character
The player uses a procedural articulated character rig with separate upper/lower limbs, smooth capsule-based anatomy, head details, and gait animation.
