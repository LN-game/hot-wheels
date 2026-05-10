import { useMemo, useRef } from 'react'
import { AiCar } from './AiCar'
import { Car } from './Car'
import { Track } from './Track'
import type { CarState } from '../game/carMotion'
import { buildTrack } from '../game/track'

type SceneProps = {
  onSpeedChange: (speed: number) => void
}

export function Scene({ onSpeedChange }: SceneProps) {
  const track = useMemo(() => buildTrack(), [])
  const playerStateRef = useRef<CarState>({
    distance: 8,
    headingOffset: 0,
    lateralOffset: 0,
    speed: 0,
  })

  return (
    <>
      <color attach="background" args={['#0b8ed0']} />
      <fog attach="fog" args={['#0b8ed0', 1200, 4200]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        intensity={2.3}
        position={[24, 36, 16]}
        shadow-camera-far={360}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
      />
      <Track track={track} />
      <AiCar
        color="#ffcc18"
        laneOffset={-3.2}
        playerStateRef={playerStateRef}
        skill={0.72}
        startDistance={10}
        track={track}
      />
      <AiCar
        color="#ff3d57"
        laneOffset={3}
        playerStateRef={playerStateRef}
        skill={0.84}
        startDistance={13}
        track={track}
      />
      <AiCar
        color="#36f091"
        laneOffset={0.8}
        playerStateRef={playerStateRef}
        skill={0.62}
        startDistance={16}
        track={track}
      />
      <Car
        playerStateRef={playerStateRef}
        track={track}
        onSpeedChange={onSpeedChange}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, -220]} receiveShadow>
        <planeGeometry args={[8000, 8000]} />
        <meshStandardMaterial color="#40b7da" roughness={0.85} />
      </mesh>
    </>
  )
}
