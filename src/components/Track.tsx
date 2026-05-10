import * as THREE from 'three'
import type { TrackData } from '../game/track'

type TrackProps = {
  track: TrackData
}

export function Track({ track }: TrackProps) {
  return (
    <group>
      <mesh geometry={track.road} receiveShadow>
        <meshStandardMaterial color="#f47a00" roughness={0.48} metalness={0.05} />
      </mesh>
      <mesh geometry={track.centerStripe}>
        <meshStandardMaterial color="#ffcf55" roughness={0.35} />
      </mesh>
      <mesh geometry={track.leftRail} castShadow receiveShadow>
        <meshStandardMaterial color="#d85400" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={track.rightRail} castShadow receiveShadow>
        <meshStandardMaterial color="#d85400" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
