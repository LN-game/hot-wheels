# Hot Wheels Prototype

A small Hot Wheels-style racing prototype built with Bun, Vite, React, and Three.js.

游戏效果图：`target.png`

## Current Step

Step 1 is implemented:

- Blue box placeholder car
- WASD driving controls
- Follow camera aligned with the car's front/back axis
- Seeded procedural orange plastic track
- Constrained random straight and curved track sections
- 3D-ready track sweep pipeline using tangent, normal, and binormal frames
- Speed HUD

## Track Generation

The track is generated in code, not loaded from an external model.

Current implementation:

- `TrackBuilder` stores sampled center-line nodes.
- `generateRandomTrackSamples()` builds a deterministic random layout from a fixed seed.
- The generator currently uses only straight sections and horizontal arcs.
- Candidate sections are constrained by bounds, turn radius, turn angle, straight length, and minimum distance from previous track samples.
- Road surface, center stripe, and rails are swept from the generated center line using local 3D frames.

Future TODO:

- Add slope segments.
- Add banked turns.
- Add vertical loops.
- Add helices.
- Add corkscrews.
- Improve frame seeding for vertical structures to avoid normal/binormal flips.

## Controls

- `W`: accelerate
- `S`: reverse / brake
- `A`: steer left
- `D`: steer right

## Validation

The current prototype passes:

```bash
bun run lint
bun run build
```

然后等待用户手动测试。
