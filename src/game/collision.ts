import * as THREE from 'three'
import { CAR_HEIGHT, CAR_WIDTH, ROAD_WIDTH } from './constants'
import type { TrackSample } from './track'

type CarCollisionBody = {
  heading: number
  position: THREE.Vector3
  speed: number
}

const CAR_HALF_WIDTH = CAR_WIDTH / 2
const RAIL_CLEARANCE = 0.06
const RAIL_RESTITUTION = 0.28
const RAIL_FRICTION = 0.72
const TRACK_SURFACE_OFFSET = 0.08
const CAR_CENTER_HEIGHT = CAR_HEIGHT / 2 + TRACK_SURFACE_OFFSET

type ClosestTrackFrame = {
  point: THREE.Vector3
  tangent: THREE.Vector3
  normal: THREE.Vector3
  binormal: THREE.Vector3
}

function closestTrackFrame(position: THREE.Vector3, samples: TrackSample[]) {
  let bestDistanceSq = Infinity
  let bestIndex = 0
  let bestT = 0
  const closestPoint = new THREE.Vector3()

  for (let index = 0; index < samples.length - 1; index += 1) {
    const start = samples[index].position
    const end = samples[index + 1].position
    const segment = end.clone().sub(start)
    const segmentLengthSq = segment.lengthSq()

    if (segmentLengthSq <= 0.0001) {
      continue
    }

    const t = THREE.MathUtils.clamp(
      position.clone().sub(start).dot(segment) / segmentLengthSq,
      0,
      1,
    )
    const point = start.clone().addScaledVector(segment, t)
    const distanceSq = point.distanceToSquared(position)

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestIndex = index
      bestT = t
      closestPoint.copy(point)
    }
  }

  const current = samples[bestIndex]
  const next = samples[Math.min(bestIndex + 1, samples.length - 1)]

  return {
    point: closestPoint,
    tangent: current.tangent.clone().lerp(next.tangent, bestT).normalize(),
    normal: current.normal.clone().lerp(next.normal, bestT).normalize(),
    binormal: current.binormal.clone().lerp(next.binormal, bestT).normalize(),
  } satisfies ClosestTrackFrame
}

function headingFromForward(forward: THREE.Vector3) {
  return Math.atan2(-forward.x, -forward.z)
}

export function resolveRailCollision(body: CarCollisionBody, samples: TrackSample[]) {
  const frame = closestTrackFrame(body.position, samples)
  const relative = body.position.clone().sub(frame.point)
  const lateral = relative.dot(frame.binormal)
  const limit = ROAD_WIDTH / 2 - CAR_HALF_WIDTH - RAIL_CLEARANCE
  const overshoot = Math.abs(lateral) - limit

  body.position
    .copy(frame.point)
    .addScaledVector(frame.binormal, THREE.MathUtils.clamp(lateral, -limit, limit))
    .addScaledVector(frame.normal, CAR_CENTER_HEIGHT)

  if (overshoot <= 0) {
    return false
  }

  const forward = new THREE.Vector3(
    -Math.sin(body.heading),
    0,
    -Math.cos(body.heading),
  )
  const velocity = forward.multiplyScalar(body.speed)
  const inwardNormal = frame.binormal.clone().multiplyScalar(lateral > 0 ? -1 : 1)
  const intoRail = velocity.dot(inwardNormal)

  if (intoRail < 0) {
    velocity.addScaledVector(inwardNormal, -(1 + RAIL_RESTITUTION) * intoRail)
  }

  const alongRail = frame.tangent.multiplyScalar(velocity.dot(frame.tangent))
  const inwardBounce = inwardNormal.multiplyScalar(
    Math.max(0, velocity.dot(inwardNormal)),
  )
  const resolvedVelocity = alongRail
    .multiplyScalar(RAIL_FRICTION)
    .add(inwardBounce.multiplyScalar(RAIL_RESTITUTION))

  if (resolvedVelocity.lengthSq() > 0.0001) {
    body.heading = headingFromForward(resolvedVelocity)
    body.speed = resolvedVelocity.length()
  } else {
    body.speed = 0
  }

  return true
}
