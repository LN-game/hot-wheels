import * as THREE from 'three'
import { CAR_HEIGHT, CAR_WIDTH, ROAD_WIDTH } from './constants'
import { sampleTrackAtDistance, type TrackData } from './track'

export type CarState = {
  distance: number
  headingOffset: number
  lateralOffset: number
  speed: number
}

export type DriverInput = {
  forward: number
  steer: number
}

type CarMotionOptions = {
  enableWallSlowdown?: boolean
  maxForwardSpeed?: number
}

export type CarPose = {
  position: THREE.Vector3
  forward: THREE.Vector3
  frame: ReturnType<typeof sampleTrackAtDistance>
  orientation: THREE.Quaternion
}

export const MOVE_SPEED_MULTIPLIER = 4
export const STEER_BASE_RATE = 0.55
export const STEER_SPEED_RATE = 0.014
export const MAX_HEADING_OFFSET = Math.PI / 5
export const ACCELERATION = 8.5
export const MAX_REVERSE_SPEED = 6.5
export const MAX_FORWARD_SPEED = 21
export const DRIVE_DRAG = 0.28
export const COAST_DRAG = 1.45
export const TRACK_SURFACE_OFFSET = 0.08
export const CAR_CENTER_HEIGHT = CAR_HEIGHT / 2 + TRACK_SURFACE_OFFSET
export const LATERAL_LIMIT = ROAD_WIDTH / 2 - CAR_WIDTH / 2 - 0.08
const WALL_SPEED_LOSS = 0.72
const WALL_HEADING_DAMPING = 0.35
const WALL_MIN_HIT_SPEED = 2.5

export function updateCarMotion(
  current: CarState,
  input: DriverInput,
  track: TrackData,
  step: number,
  options: CarMotionOptions = {},
) {
  const maxForwardSpeed = options.maxForwardSpeed ?? MAX_FORWARD_SPEED

  current.speed += input.forward * ACCELERATION * step
  current.speed *= 1 - (input.forward === 0 ? COAST_DRAG : DRIVE_DRAG) * step
  current.speed = THREE.MathUtils.clamp(
    current.speed,
    -MAX_REVERSE_SPEED,
    maxForwardSpeed,
  )

  if (Math.abs(current.speed) > 0.25) {
    const reverse = current.speed < 0 ? -1 : 1
    current.headingOffset -=
      input.steer *
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
  const nextLateralOffset =
    current.lateralOffset +
    current.speed * lateralAmount * MOVE_SPEED_MULTIPLIER * step
  const hitWall = Math.abs(nextLateralOffset) > LATERAL_LIMIT

  current.lateralOffset = nextLateralOffset
  current.lateralOffset = THREE.MathUtils.clamp(
    current.lateralOffset,
    -LATERAL_LIMIT,
    LATERAL_LIMIT,
  )

  if (
    options.enableWallSlowdown &&
    hitWall &&
    Math.abs(current.speed) > WALL_MIN_HIT_SPEED
  ) {
    current.speed *= WALL_SPEED_LOSS
    current.headingOffset *= WALL_HEADING_DAMPING
  }

  if (current.distance <= 0 || current.distance >= track.totalLength) {
    current.distance = THREE.MathUtils.clamp(current.distance, 0, track.totalLength)
    current.speed = 0
  }
}

export function getCarPose(
  track: TrackData,
  current: CarState,
): CarPose {
  const frame = sampleTrackAtDistance(track.samples, current.distance)
  const forwardAmount = Math.cos(current.headingOffset)
  const lateralAmount = Math.sin(current.headingOffset)
  const position = frame.position
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
  const orientation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix)

  return {
    position,
    forward,
    frame,
    orientation,
  }
}
