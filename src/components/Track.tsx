import { useMemo } from 'react'
import { buildTrack } from '../game/track'

export function Track() {
  const track = useMemo(() => buildTrack(), [])

  return (
    <group>
      <mesh geometry={track.road} receiveShadow>
        <meshStandardMaterial color="#f47a00" roughness={0.48} metalness={0.05} />
      </mesh>
      <mesh geometry={track.centerStripe}>
        <meshStandardMaterial color="#ffcf55" roughness={0.35} />
      </mesh>
      <mesh geometry={track.leftRail} castShadow receiveShadow>
        <meshStandardMaterial color="#d85400" roughness={0.55} />
      </mesh>
      <mesh geometry={track.rightRail} castShadow receiveShadow>
        <meshStandardMaterial color="#d85400" roughness={0.55} />
      </mesh>
    </group>
  )
}
