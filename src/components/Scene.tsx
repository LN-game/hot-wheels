import { Car } from './Car'
import { Track } from './Track'

type SceneProps = {
  onSpeedChange: (speed: number) => void
}

export function Scene({ onSpeedChange }: SceneProps) {
  return (
    <>
      <color attach="background" args={['#0b8ed0']} />
      <fog attach="fog" args={['#0b8ed0', 75, 210]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        intensity={2.3}
        position={[24, 36, 16]}
        shadow-camera-far={180}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <Track />
      <Car onSpeedChange={onSpeedChange} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[42, -0.18, 15]} receiveShadow>
        <planeGeometry args={[260, 190]} />
        <meshStandardMaterial color="#40b7da" roughness={0.85} />
      </mesh>
    </>
  )
}
