import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { resolveRailCollision } from '../game/collision'
import { CAR_HEIGHT, CAR_WIDTH } from '../game/constants'
import type { TrackData } from '../game/track'
import { useKeyboard } from '../hooks/useKeyboard'

type CarState = {
  heading: number
  position: THREE.Vector3
  speed: number
}

type CarProps = {
  track: TrackData
  onSpeedChange: (speed: number) => void
}

function forwardFromHeading(heading: number) {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading))
}

export function Car({ track, onSpeedChange }: CarProps) {
  const carRef = useRef<THREE.Group>(null)
  const keys = useKeyboard()
  const car = useRef<CarState>({
    heading: 0,
    position: new THREE.Vector3(0, CAR_HEIGHT / 2 + 0.08, 54),
    speed: 0,
  })
  const cameraTarget = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.033)
    const pressed = keys.current
    const forwardInput = Number(Boolean(pressed.w)) - Number(Boolean(pressed.s))
    const steerInput = Number(Boolean(pressed.a)) - Number(Boolean(pressed.d))
    const current = car.current

    current.speed += forwardInput * 34 * step
    current.speed *= 1 - 1.45 * step
    current.speed = THREE.MathUtils.clamp(current.speed, -13, 42)

    if (Math.abs(current.speed) > 0.25) {
      const reverse = current.speed < 0 ? -1 : 1
      current.heading += steerInput * reverse * (1.45 + Math.abs(current.speed) * 0.035) * step
    }

    const substeps = Math.max(1, Math.ceil((Math.abs(current.speed) * step) / 2.2))
    for (let index = 0; index < substeps; index += 1) {
      const substep = step / substeps
      const forward = forwardFromHeading(current.heading)
      current.position.addScaledVector(forward, current.speed * substep)
      resolveRailCollision(current, track.samples)
    }

    if (carRef.current) {
      carRef.current.position.copy(current.position)
      carRef.current.rotation.y = current.heading
    }

    const forward = forwardFromHeading(current.heading)
    const desiredCamera = current.position
      .clone()
      .addScaledVector(forward, -12)
      .add(new THREE.Vector3(0, 6.5, 0))
    cameraTarget.current.lerp(
      current.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
      1 - Math.exp(-7 * step),
    )

    state.camera.position.lerp(desiredCamera, 1 - Math.exp(-5 * step))
    state.camera.lookAt(cameraTarget.current)
    onSpeedChange(Math.round(Math.abs(current.speed) * 5.4))
  })

  return (
    <group ref={carRef}>
      <mesh castShadow>
        <boxGeometry args={[CAR_WIDTH, CAR_HEIGHT, 4]} />
        <meshStandardMaterial color="#0d6bff" roughness={0.36} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.52, -1.45]} castShadow>
        <boxGeometry args={[1.25, 0.16, 0.55]} />
        <meshStandardMaterial color="#8fd2ff" roughness={0.25} />
      </mesh>
    </group>
  )
}
