import { useMemo } from 'react'
import { Car } from './Car'
import { Track } from './Track'
import { buildTrack } from '../game/track'

type SceneProps = {
  onSpeedChange: (speed: number) => void
}

export function Scene({ onSpeedChange }: SceneProps) {
  const track = useMemo(() => buildTrack(), [])

  return (
    <>
      <color attach="background" args={['#0b8ed0']} />
      <fog attach="fog" args={['#0b8ed0', 140, 560]} />
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
      <Car track={track} onSpeedChange={onSpeedChange} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, -220]} receiveShadow>
        <planeGeometry args={[2400, 2600]} />
        <meshStandardMaterial color="#40b7da" roughness={0.85} />
      </mesh>
    </>
  )
}
