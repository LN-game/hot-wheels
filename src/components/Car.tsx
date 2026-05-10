import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAR_HEIGHT, CAR_WIDTH, ROAD_WIDTH } from '../game/constants'
import { sampleTrackAtDistance, type TrackData } from '../game/track'
import { useKeyboard } from '../hooks/useKeyboard'

type CarState = {
  distance: number
  headingOffset: number
  lateralOffset: number
  speed: number
}

type CarProps = {
  track: TrackData
  onSpeedChange: (speed: number) => void
}

const MOVE_SPEED_MULTIPLIER = 4
const STEER_BASE_RATE = 0.55
const STEER_SPEED_RATE = 0.014
const MAX_HEADING_OFFSET = Math.PI / 5
const ACCELERATION = 17
const DRIVE_DRAG = 0.28
const COAST_DRAG = 1.45
const TRACK_SURFACE_OFFSET = 0.08
const CAR_CENTER_HEIGHT = CAR_HEIGHT / 2 + TRACK_SURFACE_OFFSET
const LATERAL_LIMIT = ROAD_WIDTH / 2 - CAR_WIDTH / 2 - 0.08

export function Car({ track, onSpeedChange }: CarProps) {
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

    current.speed += forwardInput * ACCELERATION * step
    current.speed *= 1 - (forwardInput === 0 ? COAST_DRAG : DRIVE_DRAG) * step
    current.speed = THREE.MathUtils.clamp(current.speed, -13, 42)

    if (Math.abs(current.speed) > 0.25) {
      const reverse = current.speed < 0 ? -1 : 1
      current.headingOffset -=
        steerInput *
        reverse *
        (STEER_BASE_RATE + Math.abs(current.speed) * STEER_SPEED_RATE) *
        step
    }

    current.headingOffset = THREE.MathUtils.clamp(
      current.headingOffset,
      -MAX_HEADING_OFFSET,
      MAX_HEADING_OFFSET,
    )

    const forwardAmount = Math.cos(current.headingOffset)
    const lateralAmount = Math.sin(current.headingOffset)

    current.distance +=
      current.speed * forwardAmount * MOVE_SPEED_MULTIPLIER * step
    current.lateralOffset +=
      current.speed * lateralAmount * MOVE_SPEED_MULTIPLIER * step
    current.lateralOffset = THREE.MathUtils.clamp(
      current.lateralOffset,
      -LATERAL_LIMIT,
      LATERAL_LIMIT,
    )

    if (current.distance <= 0 || current.distance >= track.totalLength) {
      current.distance = THREE.MathUtils.clamp(current.distance, 0, track.totalLength)
      current.speed = 0
    }

    const frame = sampleTrackAtDistance(track.samples, current.distance)
    const carPosition = frame.position
      .clone()
      .addScaledVector(frame.binormal, current.lateralOffset)
      .addScaledVector(frame.normal, CAR_CENTER_HEIGHT)
    const forward = frame.tangent
      .clone()
      .multiplyScalar(forwardAmount)
      .addScaledVector(frame.binormal, lateralAmount)
      .normalize()
    const right = forward.clone().cross(frame.normal).normalize()
    const zAxis = forward.clone().multiplyScalar(-1)
    const rotationMatrix = new THREE.Matrix4().makeBasis(
      right,
      frame.normal,
      zAxis,
    )
    orientation.current.setFromRotationMatrix(rotationMatrix)

    if (carRef.current) {
      carRef.current.position.copy(carPosition)
      carRef.current.quaternion.copy(orientation.current)
    }

    const desiredCamera = carPosition
      .clone()
      .addScaledVector(forward, -13)
      .addScaledVector(frame.normal, 6.5)
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
