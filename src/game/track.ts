import * as THREE from 'three'
import { ROAD_WIDTH, WORLD_UP } from './constants'

export type TrackData = {
  samples: TrackSample[]
  totalLength: number
  road: THREE.BufferGeometry
  leftRail: THREE.BufferGeometry
  rightRail: THREE.BufferGeometry
  centerStripe: THREE.BufferGeometry
}

export type TrackSample = {
  position: THREE.Vector3
  tangent: THREE.Vector3
  normal: THREE.Vector3
  binormal: THREE.Vector3
  banking: number
  distance: number
}

export type TrackFrame = TrackSample

type TrackGenConfig = {
  seed: number
  segmentCount: number
  minStraight: number
  maxStraight: number
  minRadius: number
  maxRadius: number
  minTurnAngle: number
  maxTurnAngle: number
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
}

type PathNode = {
  position: THREE.Vector3
  banking: number
}

type TrackCursor = {
  position: THREE.Vector3
  heading: number
}

type AuthorCursor = {
  position: THREE.Vector3
  heading: number
}

type TrackCandidate = {
  apply: () => void
  cursor: TrackCursor
  points: THREE.Vector3[]
}

class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next() {
    this.state += 0x6d2b79f5
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number) {
    return THREE.MathUtils.lerp(min, max, this.next())
  }

  pickSign() {
    return this.next() < 0.5 ? -1 : 1
  }
}

class TrackBuilder {
  private nodes: PathNode[] = []
  private authorCursor: AuthorCursor = {
    position: new THREE.Vector3(0, 0, 62),
    heading: 0,
  }

  straight(length: number, steps = Math.max(10, Math.ceil(length / 3))) {
    const end = this.authorCursor.position
      .clone()
      .addScaledVector(directionFromHeading(this.authorCursor.heading), length)

    this.lineTo(end, steps)
    this.authorCursor.position = end
    return this
  }

  slope(
    length: number,
    height: number,
    steps = Math.max(16, Math.ceil(length / 2.6)),
  ) {
    const from = this.lastPosition()
    const direction = directionFromHeading(this.authorCursor.heading)
    const start = this.nodes.length === 0 ? 0 : 1

    for (let i = start; i <= steps; i += 1) {
      const t = i / steps
      const eased = smoothStep(t)
      this.nodes.push({
        position: from
          .clone()
          .addScaledVector(direction, length * t)
          .add(new THREE.Vector3(0, height * eased, 0)),
        banking: 0,
      })
    }

    this.authorCursor.position = from
      .clone()
      .addScaledVector(direction, length)
      .add(new THREE.Vector3(0, height, 0))

    return this
  }

  bankedArc(
    turnSign: number,
    radius: number,
    angle: number,
    banking: number,
    elevation = 0,
    steps = Math.max(20, Math.ceil((radius * angle) / 1.8)),
  ) {
    const side = leftFromHeading(this.authorCursor.heading).multiplyScalar(turnSign)
    const center = this.authorCursor.position.clone().addScaledVector(side, radius)
    const startHeight = this.authorCursor.position.y
    const startAngle = Math.atan2(
      this.authorCursor.position.z - center.z,
      this.authorCursor.position.x - center.x,
    )
    const endAngle = startAngle - turnSign * angle
    const start = this.nodes.length === 0 ? 0 : 1

    for (let i = start; i <= steps; i += 1) {
      const t = i / steps
      const sampleAngle = THREE.MathUtils.lerp(startAngle, endAngle, t)
      this.nodes.push({
        position: new THREE.Vector3(
          center.x + Math.cos(sampleAngle) * radius,
          startHeight + elevation * smoothStep(t),
          center.z + Math.sin(sampleAngle) * radius,
        ),
        banking: -turnSign * banking * Math.sin(Math.PI * t),
      })
    }

    this.authorCursor.position = this.nodes[this.nodes.length - 1].position.clone()
    this.authorCursor.heading += turnSign * angle
    return this
  }

  lineTo(to: THREE.Vector3, steps: number, banking = 0) {
    const from = this.lastPosition()
    const start = this.nodes.length === 0 ? 0 : 1

    for (let i = start; i <= steps; i += 1) {
      this.nodes.push({
        position: from.clone().lerp(to, i / steps),
        banking,
      })
    }

    return this
  }

  // TODO: Add slope(length, height), loop(radius), helix(radius, height, turns),
  // and corkscrew(length, radius, turns) path segments. Those methods should
  // only append 3D center-line nodes; the sweep geometry below already consumes
  // arbitrary 3D samples.
  buildSamples() {
    if (this.nodes.length < 2) {
      throw new Error('TrackBuilder needs at least two nodes')
    }

    const samples: TrackSample[] = []
    let distance = 0

    this.nodes.forEach((node, index) => {
      const tangent = tangentAt(this.nodes, index)
      const baseNormal = normalFromReference(tangent)
      const baseBinormal = tangent.clone().cross(baseNormal).normalize()
      const normal = baseNormal.clone()
      const binormal = baseBinormal.clone()

      if (node.banking !== 0) {
        normal.applyAxisAngle(tangent, node.banking)
        binormal.applyAxisAngle(tangent, node.banking)
      }

      if (index > 0) {
        distance += node.position.distanceTo(this.nodes[index - 1].position)
      }

      samples.push({
        position: node.position.clone(),
        tangent,
        normal,
        binormal,
        banking: node.banking,
        distance,
      })
    })

    return samples
  }

  private lastPosition() {
    const last = this.nodes.at(-1)

    if (!last) {
      return new THREE.Vector3(0, 0, 62)
    }

    return last.position
  }
}

function tangentAt(nodes: PathNode[], index: number) {
  const previous = nodes[Math.max(index - 1, 0)].position
  const next = nodes[Math.min(index + 1, nodes.length - 1)].position
  return next.clone().sub(previous).normalize()
}

function smoothStep(t: number) {
  return t * t * (3 - 2 * t)
}

function normalFromReference(tangent: THREE.Vector3) {
  const reference =
    Math.abs(tangent.dot(WORLD_UP)) < 0.92
      ? WORLD_UP
      : new THREE.Vector3(1, 0, 0)
  return reference
    .clone()
    .sub(tangent.clone().multiplyScalar(reference.dot(tangent)))
    .normalize()
}

function directionFromHeading(heading: number) {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading))
}

function leftFromHeading(heading: number) {
  const direction = directionFromHeading(heading)
  return new THREE.Vector3(direction.z, 0, -direction.x)
}

function isInsideBounds(point: THREE.Vector3, bounds: TrackGenConfig['bounds']) {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.z >= bounds.minZ &&
    point.z <= bounds.maxZ
  )
}

function isClearOfPreviousTrack(
  points: THREE.Vector3[],
  occupied: THREE.Vector3[],
  minimumDistance: number,
) {
  const protectedTail = 8
  const previous = occupied.slice(0, Math.max(0, occupied.length - protectedTail))

  return points.every((point) =>
    previous.every((occupiedPoint) => point.distanceTo(occupiedPoint) >= minimumDistance),
  )
}

function makeStraightCandidate(
  builder: TrackBuilder,
  cursor: TrackCursor,
  length: number,
) {
  const end = cursor.position
    .clone()
    .addScaledVector(directionFromHeading(cursor.heading), length)
  const steps = Math.max(8, Math.ceil(length / 3))
  const points: THREE.Vector3[] = []

  for (let i = 1; i <= steps; i += 1) {
    points.push(cursor.position.clone().lerp(end, i / steps))
  }

  return {
    apply: () => builder.lineTo(end, steps),
    cursor: {
      position: end,
      heading: cursor.heading,
    },
    points,
  } satisfies TrackCandidate
}

function makeArcCandidate(
  builder: TrackBuilder,
  cursor: TrackCursor,
  turnSign: number,
  radius: number,
  angle: number,
) {
  const side = leftFromHeading(cursor.heading).multiplyScalar(turnSign)
  const center = cursor.position.clone().addScaledVector(side, radius)
  const startAngle = Math.atan2(
    cursor.position.z - center.z,
    cursor.position.x - center.x,
  )
  const endAngle = startAngle - turnSign * angle
  const steps = Math.max(12, Math.ceil((radius * angle) / 2.4))
  const points: THREE.Vector3[] = []

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const sampleAngle = THREE.MathUtils.lerp(startAngle, endAngle, t)
    points.push(
      new THREE.Vector3(
        center.x + Math.cos(sampleAngle) * radius,
        0,
        center.z + Math.sin(sampleAngle) * radius,
      ),
    )
  }

  return {
    apply: () => builder.bankedArc(turnSign, radius, angle, THREE.MathUtils.degToRad(30)),
    cursor: {
      position: points[points.length - 1],
      heading: cursor.heading + turnSign * angle,
    },
    points,
  } satisfies TrackCandidate
}

function generateRandomTrackSamples(config: TrackGenConfig) {
  const random = new SeededRandom(config.seed)
  const builder = new TrackBuilder()
  const occupied: THREE.Vector3[] = [new THREE.Vector3(0, 0, 62)]
  let cursor: TrackCursor = {
    position: new THREE.Vector3(0, 0, 62),
    heading: 0,
  }

  const commit = (candidate: TrackCandidate) => {
    candidate.apply()
    cursor = candidate.cursor
    occupied.push(...candidate.points)
  }

  commit(makeStraightCandidate(builder, cursor, 96))

  for (let segment = 0; segment < config.segmentCount; segment += 1) {
    const wantsTurn = segment % 2 === 0 || random.next() < 0.65
    let candidate: TrackCandidate | undefined

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const nextCandidate = wantsTurn
        ? makeArcCandidate(
            builder,
            cursor,
            random.pickSign(),
            random.range(config.minRadius, config.maxRadius),
            random.range(config.minTurnAngle, config.maxTurnAngle),
          )
        : makeStraightCandidate(
            builder,
            cursor,
            random.range(config.minStraight, config.maxStraight),
          )

      if (
        nextCandidate.points.every((point) => isInsideBounds(point, config.bounds)) &&
        isClearOfPreviousTrack(nextCandidate.points, occupied, ROAD_WIDTH * 1.35)
      ) {
        candidate = nextCandidate
        break
      }
    }

    if (!candidate) {
      candidate = makeStraightCandidate(builder, cursor, config.minStraight)
    }

    commit(candidate)

    if (wantsTurn) {
      commit(
        makeStraightCandidate(
          builder,
          cursor,
          random.range(config.minStraight, config.maxStraight),
        ),
      )
    }
  }

  return builder.buildSamples()
}

function frameBetweenSamples(
  start: TrackSample,
  end: TrackSample,
  t: number,
): TrackFrame {
  const position = start.position.clone().lerp(end.position, t)
  const tangent = start.tangent.clone().lerp(end.tangent, t).normalize()
  let normal = start.normal.clone().lerp(end.normal, t)

  normal.sub(tangent.clone().multiplyScalar(normal.dot(tangent)))
  if (normal.lengthSq() <= 0.0001) {
    normal = normalFromReference(tangent)
  } else {
    normal.normalize()
  }

  const binormal = tangent.clone().cross(normal).normalize()

  return {
    position,
    tangent,
    normal,
    binormal,
    banking: THREE.MathUtils.lerp(start.banking, end.banking, t),
    distance: THREE.MathUtils.lerp(start.distance, end.distance, t),
  }
}

export function sampleTrackAtDistance(samples: TrackSample[], distance: number) {
  if (samples.length === 0) {
    throw new Error('Cannot sample an empty track')
  }

  const clampedDistance = THREE.MathUtils.clamp(
    distance,
    0,
    samples[samples.length - 1].distance,
  )

  for (let index = 0; index < samples.length - 1; index += 1) {
    const start = samples[index]
    const end = samples[index + 1]

    if (clampedDistance <= end.distance) {
      const length = end.distance - start.distance
      const t = length > 0.0001 ? (clampedDistance - start.distance) / length : 0
      return frameBetweenSamples(start, end, t)
    }
  }

  return samples[samples.length - 1]
}

function generateTestTrackSamples() {
  const builder = new TrackBuilder()
  const sectors = [
    { sign: 1, radius: 86, angle: 0.98, bank: 34, arcHeight: 28, straight: 128, slope: 92, height: 24 },
    { sign: -1, radius: 72, angle: 0.86, bank: 30, arcHeight: 32, straight: 116, slope: 96, height: 26 },
    { sign: -1, radius: 96, angle: 1.05, bank: 38, arcHeight: -24, straight: 142, slope: 104, height: 30 },
    { sign: 1, radius: 78, angle: 0.92, bank: 34, arcHeight: 36, straight: 120, slope: 100, height: 22 },
    { sign: 1, radius: 104, angle: 0.82, bank: 28, arcHeight: -30, straight: 148, slope: 98, height: -34 },
    { sign: -1, radius: 90, angle: 1.12, bank: 40, arcHeight: -36, straight: 132, slope: 106, height: -30 },
    { sign: 1, radius: 74, angle: 0.9, bank: 32, arcHeight: 26, straight: 122, slope: 94, height: -26 },
    { sign: -1, radius: 100, angle: 0.98, bank: 36, arcHeight: -34, straight: 154, slope: 102, height: -28 },
    { sign: -1, radius: 82, angle: 0.88, bank: 32, arcHeight: 30, straight: 130, slope: 96, height: 32 },
    { sign: 1, radius: 94, angle: 1.06, bank: 38, arcHeight: 34, straight: 140, slope: 106, height: 28 },
    { sign: -1, radius: 76, angle: 0.94, bank: 34, arcHeight: -28, straight: 118, slope: 92, height: 24 },
    { sign: 1, radius: 108, angle: 0.84, bank: 30, arcHeight: -32, straight: 160, slope: 104, height: -36 },
  ]

  builder.straight(112).slope(104, 34).straight(84)

  sectors.forEach((sector) => {
    builder
      .bankedArc(
        sector.sign,
        sector.radius,
        Math.PI * sector.angle,
        THREE.MathUtils.degToRad(sector.bank),
        sector.arcHeight,
      )
      .straight(sector.straight)
      .slope(sector.slope, sector.height)
      .straight(72)
  })

  return builder.straight(180).buildSamples()
}

function makeRibbonGeometry(
  samples: TrackSample[],
  width: number,
  yOffset = 0,
) {
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let distance = 0

  samples.forEach((sample, index) => {
    if (index > 0) {
      distance += sample.position.distanceTo(samples[index - 1].position)
    }

    const center = sample.position.clone().addScaledVector(sample.normal, yOffset)
    const left = center.clone().addScaledVector(sample.binormal, width / 2)
    const right = center.clone().addScaledVector(sample.binormal, -width / 2)

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, distance / 20, 1, distance / 20)

    if (index < samples.length - 1) {
      const base = index * 2
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeRailGeometry(
  samples: TrackSample[],
  edgeOffset: number,
  height: number,
  thickness: number,
) {
  const innerEdge: THREE.Vector3[] = []
  const outer: THREE.Vector3[] = []
  const side = Math.sign(edgeOffset) || 1
  const roadOverlap = 0.18

  samples.forEach((sample) => {
    innerEdge.push(
      sample.position.clone().addScaledVector(
        sample.binormal,
        edgeOffset - side * roadOverlap,
      ),
    )
    outer.push(
      sample.position.clone().addScaledVector(
        sample.binormal,
        edgeOffset + side * thickness,
      ),
    )
  })

  const vertices: number[] = []
  const indices: number[] = []

  samples.forEach((sample, index) => {
    const a = innerEdge[index]
    const b = outer[index]
    const topA = a.clone().addScaledVector(sample.normal, height)
    const topB = b.clone().addScaledVector(sample.normal, height)
    vertices.push(
      a.x,
      a.y,
      a.z,
      b.x,
      b.y,
      b.z,
      topA.x,
      topA.y,
      topA.z,
      topB.x,
      topB.y,
      topB.z,
    )

    if (index < samples.length - 1) {
      const base = index * 4
      const next = base + 4
      indices.push(
        base,
        next,
        base + 2,
        base + 2,
        next,
        next + 2,
        base + 1,
        base + 3,
        next + 1,
        base + 3,
        next + 3,
        next + 1,
        base + 2,
        next + 2,
        base + 3,
        base + 3,
        next + 2,
        next + 3,
      )
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function buildTrack(): TrackData {
  const useFixedTestTrack = true
  const samples = useFixedTestTrack
    ? generateTestTrackSamples()
    : generateRandomTrackSamples({
        seed: 20260510,
        segmentCount: 7,
        minStraight: 28,
        maxStraight: 62,
        minRadius: 24,
        maxRadius: 42,
        minTurnAngle: Math.PI / 5,
        maxTurnAngle: Math.PI / 2,
        bounds: {
          minX: -92,
          maxX: 128,
          minZ: -112,
          maxZ: 78,
        },
      })

  return {
    samples,
    totalLength: samples[samples.length - 1].distance,
    road: makeRibbonGeometry(samples, ROAD_WIDTH),
    leftRail: makeRailGeometry(samples, ROAD_WIDTH / 2, 1.25, 0.7),
    rightRail: makeRailGeometry(samples, -ROAD_WIDTH / 2, 1.25, 0.7),
    centerStripe: makeRibbonGeometry(samples, 0.22, 0.045),
  }
}
