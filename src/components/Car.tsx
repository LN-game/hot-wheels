import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getCarPose,
  MAX_FORWARD_SPEED,
  type CarState,
  updateCarMotion,
} from '../game/carMotion'
import type { TrackData } from '../game/track'
import { useKeyboard } from '../hooks/useKeyboard'
import { LowPolyCar } from './LowPolyCar'

type CarProps = {
  playerStateRef?: RefObject<CarState>
  track: TrackData
  onSpeedChange: (speed: number) => void
}

const CAMERA_FOLLOW_DISTANCE = 13
const CAMERA_FOLLOW_HEIGHT = 6.5
const HIGH_SPEED_CAMERA_CLOSE_FACTOR = 0.5

export function Car({ playerStateRef, track, onSpeedChange }: CarProps) {
  const carRef = useRef<THREE.Group>(null)
  const keys = useKeyboard()
  const car = useRef<CarState>({
    distance: 8,
    headingOffset: 0,
    lateralOffset: 0,
    speed: 0,
  })
  const cameraTarget = useRef(new THREE.Vector3())
  const orientation = useRef(new THREE.Quaternion())

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.033)
    const pressed = keys.current
    const forwardInput = Number(Boolean(pressed.w)) - Number(Boolean(pressed.s))
    const steerInput = Number(Boolean(pressed.a)) - Number(Boolean(pressed.d))
    const current = car.current

    updateCarMotion(
      current,
      {
        forward: forwardInput,
        steer: steerInput,
      },
      track,
      step,
      {
        enableWallSlowdown: true,
      },
    )

    const { position: carPosition, forward, frame, orientation: nextOrientation } =
      getCarPose(track, current)
    orientation.current.copy(nextOrientation)
    if (playerStateRef) {
      playerStateRef.current = { ...current }
    }

    if (carRef.current) {
      carRef.current.position.copy(carPosition)
      carRef.current.quaternion.copy(orientation.current)
    }

    const highSpeedRatio = THREE.MathUtils.clamp(
      Math.abs(current.speed) / MAX_FORWARD_SPEED,
      0,
      1,
    )
    const cameraCloseFactor = THREE.MathUtils.lerp(
      1,
      HIGH_SPEED_CAMERA_CLOSE_FACTOR,
      highSpeedRatio,
    )
    const desiredCamera = carPosition
      .clone()
      .addScaledVector(forward, -CAMERA_FOLLOW_DISTANCE * cameraCloseFactor)
      .addScaledVector(frame.normal, CAMERA_FOLLOW_HEIGHT * cameraCloseFactor)
    cameraTarget.current.lerp(
      carPosition.clone().addScaledVector(frame.normal, 1.4),
      1 - Math.exp(-7 * step),
    )

    state.camera.position.lerp(desiredCamera, 1 - Math.exp(-5 * step))
    state.camera.lookAt(cameraTarget.current)
    onSpeedChange(Math.round(Math.abs(current.speed) * 5.4))
  })

  return (
    <group ref={carRef}>
      <LowPolyCar color="#0d6bff" />
    </group>
  )
}
