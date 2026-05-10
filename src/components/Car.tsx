import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAR_HEIGHT } from '../game/constants'
import { useKeyboard } from '../hooks/useKeyboard'

type CarState = {
  heading: number
  position: THREE.Vector3
  speed: number
}

type CarProps = {
  onSpeedChange: (speed: number) => void
}

export function Car({ onSpeedChange }: CarProps) {
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

    const forward = new THREE.Vector3(
      -Math.sin(current.heading),
      0,
      -Math.cos(current.heading),
    )
    current.position.addScaledVector(forward, current.speed * step)
    current.position.y = CAR_HEIGHT / 2 + 0.08

    if (carRef.current) {
      carRef.current.position.copy(current.position)
      carRef.current.rotation.y = current.heading
    }

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
        <boxGeometry args={[2.4, CAR_HEIGHT, 4]} />
        <meshStandardMaterial color="#0d6bff" roughness={0.36} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.52, -1.45]} castShadow>
        <boxGeometry args={[1.25, 0.16, 0.55]} />
        <meshStandardMaterial color="#8fd2ff" roughness={0.25} />
      </mesh>
    </group>
  )
}
