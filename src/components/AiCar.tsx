import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getCarPose,
  LATERAL_LIMIT,
  MAX_FORWARD_SPEED,
  type CarState,
  updateCarMotion,
} from '../game/carMotion'
import { sampleTrackAtDistance, type TrackData } from '../game/track'
import { LowPolyCar } from './LowPolyCar'

type AiCarProps = {
  color: string
  startDistance: number
  startDelay?: number
  laneOffset: number
  playerStateRef: RefObject<CarState>
  skill: number
  track: TrackData
}

const MIN_TARGET_SPEED = MAX_FORWARD_SPEED * 0.34
const CATCH_UP_SPEED_LIMIT = MAX_FORWARD_SPEED * 2
const TARGET_LEAD_DISTANCE = 34
const FORCE_CATCH_UP_GAP = 15
const SPRING_ACCELERATION = 0.16
const LOOKAHEAD_DISTANCE = 46
const LANE_RESPONSE = 0.08
const HEADING_RESPONSE = 1.25
const SPEED_TOLERANCE = 0.8
const MAX_STEER_INPUT = 0.85
const LANE_CHANGE_MIN_TIME = 2.4
const LANE_CHANGE_SKILL_VARIANCE = 1.1
const OVERTAKE_GAP = 52

const LANE_CHOICES = [-5.2, -2.4, 0, 2.4, 5.2]

function getUpcomingCurveRatio(track: TrackData, distance: number) {
  const current = sampleTrackAtDistance(track.samples, distance)
  const near = sampleTrackAtDistance(
    track.samples,
    Math.min(distance + LOOKAHEAD_DISTANCE, track.totalLength),
  )
  const far = sampleTrackAtDistance(
    track.samples,
    Math.min(distance + LOOKAHEAD_DISTANCE * 1.9, track.totalLength),
  )
  const nearCurve = current.binormal.angleTo(near.binormal)
  const farCurve = near.binormal.angleTo(far.binormal)

  return THREE.MathUtils.clamp((nearCurve + farCurve * 0.6) / 1.15, 0, 1)
}

function getAiInput(
  track: TrackData,
  current: CarState,
  laneOffset: number,
  skill: number,
  playerState?: CarState,
) {
  const curveRatio = getUpcomingCurveRatio(track, current.distance)
  const distanceBehindPlayer = playerState
    ? playerState.distance - current.distance
    : 0
  const targetGap = playerState
    ? playerState.distance + TARGET_LEAD_DISTANCE - current.distance
    : 0
  const catchUpRatio = THREE.MathUtils.clamp(targetGap / 140, 0, 1)
  const effectiveCurveRatio = THREE.MathUtils.lerp(
    curveRatio,
    curveRatio * 0.28,
    catchUpRatio,
  )
  const baseTargetSpeed = THREE.MathUtils.lerp(
    MAX_FORWARD_SPEED * (0.78 + skill * 0.16),
    MIN_TARGET_SPEED * (0.9 + skill * 0.22),
    effectiveCurveRatio,
  )
  const catchUpBoost = THREE.MathUtils.clamp(
    targetGap * SPRING_ACCELERATION,
    -MAX_FORWARD_SPEED * 0.26,
    MAX_FORWARD_SPEED * (1 + skill * 0.46),
  )
  const targetSpeed = THREE.MathUtils.clamp(
    baseTargetSpeed + catchUpBoost,
    MIN_TARGET_SPEED,
    CATCH_UP_SPEED_LIMIT,
  )
  const forward =
    distanceBehindPlayer > FORCE_CATCH_UP_GAP
      ? 1
      : current.speed < targetSpeed - SPEED_TOLERANCE
      ? 1
      : current.speed > targetSpeed + SPEED_TOLERANCE
        ? -0.45
        : 0
  const targetLane = THREE.MathUtils.clamp(laneOffset, -LATERAL_LIMIT, LATERAL_LIMIT)
  const laneError = targetLane - current.lateralOffset
  const desiredHeading = THREE.MathUtils.clamp(
    laneError * LANE_RESPONSE,
    -0.34,
    0.34,
  )
  const steer = THREE.MathUtils.clamp(
    (current.headingOffset - desiredHeading) * HEADING_RESPONSE,
    -MAX_STEER_INPUT,
    MAX_STEER_INPUT,
  )

  return {
    forward,
    steer,
    targetSpeed,
  }
}

function pickCruiseLane(currentLane: number, seed: number) {
  const currentIndex = LANE_CHOICES.reduce((bestIndex, lane, index) => {
    const bestDistance = Math.abs(LANE_CHOICES[bestIndex] - currentLane)
    const nextDistance = Math.abs(lane - currentLane)

    return nextDistance < bestDistance ? index : bestIndex
  }, 0)
  const direction = seed % 2 === 0 ? 1 : -1
  const nextIndex = THREE.MathUtils.clamp(
    currentIndex + direction,
    0,
    LANE_CHOICES.length - 1,
  )

  if (nextIndex === currentIndex) {
    return LANE_CHOICES[LANE_CHOICES.length - 1 - currentIndex]
  }

  return LANE_CHOICES[nextIndex]
}

function pickOvertakeLane(playerLane: number, currentLane: number, seed: number) {
  const side = seed % 2 === 0 ? 1 : -1
  const firstChoice = THREE.MathUtils.clamp(
    playerLane + side * 3.4,
    -LATERAL_LIMIT,
    LATERAL_LIMIT,
  )

  if (Math.abs(firstChoice - currentLane) > 1.2) {
    return firstChoice
  }

  return THREE.MathUtils.clamp(
    playerLane - side * 3.4,
    -LATERAL_LIMIT,
    LATERAL_LIMIT,
  )
}

export function AiCar({
  color,
  startDistance,
  startDelay = 1,
  laneOffset,
  playerStateRef,
  skill,
  track,
}: AiCarProps) {
  const carRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const laneChangeElapsed = useRef(0)
  const laneChangeCount = useRef(0)
  const laneTarget = useRef(laneOffset)
  const car = useRef<CarState>({
    distance: startDistance,
    headingOffset: 0,
    lateralOffset: laneOffset,
    speed: 0,
  })

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.033)
    const current = car.current

    elapsed.current += step

    if (elapsed.current >= startDelay) {
      laneChangeElapsed.current += step
      const playerState = playerStateRef.current
      const playerGap = playerState.distance - current.distance
      const laneChangeTime =
        LANE_CHANGE_MIN_TIME + (1 - skill) * LANE_CHANGE_SKILL_VARIANCE

      if (laneChangeElapsed.current >= laneChangeTime) {
        laneChangeElapsed.current = 0
        laneChangeCount.current += 1
        laneTarget.current =
          playerGap > -OVERTAKE_GAP
            ? pickOvertakeLane(
                playerState.lateralOffset,
                current.lateralOffset,
                laneChangeCount.current,
              )
            : pickCruiseLane(laneTarget.current, laneChangeCount.current)
      }

      const input = getAiInput(
        track,
        current,
        laneTarget.current,
        skill,
        playerState,
      )

      updateCarMotion(current, input, track, step, {
        maxForwardSpeed: Math.max(MAX_FORWARD_SPEED, input.targetSpeed),
      })
    } else {
      current.speed = 0
    }

    if (current.distance >= track.totalLength - 0.1) {
      current.distance = 0
      current.speed = MAX_FORWARD_SPEED * 0.42
    }

    const pose = getCarPose(track, current)

    if (carRef.current) {
      carRef.current.position.copy(pose.position)
      carRef.current.quaternion.copy(pose.orientation)
    }
  })

  return (
    <group ref={carRef}>
      <LowPolyCar color={color} glassColor="#f7fbff" />
    </group>
  )
}
