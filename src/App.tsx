import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import './App.css'

type TrackData = {
  centerLine: THREE.Vector3[]
  road: THREE.BufferGeometry
  leftRail: THREE.BufferGeometry
  rightRail: THREE.BufferGeometry
  centerStripe: THREE.BufferGeometry
}

type CarState = {
  heading: number
  position: THREE.Vector3
  speed: number
}

const ROAD_WIDTH = 10
const CAR_HEIGHT = 0.85

function addLine(
  points: THREE.Vector3[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  steps: number,
) {
  const start = points.length === 0 ? 0 : 1
  for (let i = start; i <= steps; i += 1) {
    points.push(from.clone().lerp(to, i / steps))
  }
}

function addArc(
  points: THREE.Vector3[],
  centerX: number,
  centerZ: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  steps: number,
) {
  const start = points.length === 0 ? 0 : 1
  for (let i = start; i <= steps; i += 1) {
    const t = i / steps
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t)
    points.push(
      new THREE.Vector3(
        centerX + Math.cos(angle) * radius,
        0,
        centerZ + Math.sin(angle) * radius,
      ),
    )
  }
}

function tangentAt(points: THREE.Vector3[], index: number) {
  const previous = points[Math.max(index - 1, 0)]
  const next = points[Math.min(index + 1, points.length - 1)]
  return next.clone().sub(previous).normalize()
}

function makeRibbonGeometry(
  points: THREE.Vector3[],
  width: number,
  yOffset = 0,
) {
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let distance = 0

  points.forEach((point, index) => {
    if (index > 0) {
      distance += point.distanceTo(points[index - 1])
    }

    const tangent = tangentAt(points, index)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const left = point.clone().addScaledVector(normal, width / 2)
    const right = point.clone().addScaledVector(normal, -width / 2)

    vertices.push(left.x, yOffset, left.z, right.x, yOffset, right.z)
    uvs.push(0, distance / 20, 1, distance / 20)

    if (index < points.length - 1) {
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
  points: THREE.Vector3[],
  offset: number,
  height: number,
  thickness: number,
) {
  const inner: THREE.Vector3[] = []
  const outer: THREE.Vector3[] = []

  points.forEach((point, index) => {
    const tangent = tangentAt(points, index)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const center = point.clone().addScaledVector(normal, offset)
    inner.push(center.clone().addScaledVector(normal, -thickness / 2))
    outer.push(center.clone().addScaledVector(normal, thickness / 2))
  })

  const vertices: number[] = []
  const indices: number[] = []

  points.forEach((_, index) => {
    const a = inner[index]
    const b = outer[index]
    vertices.push(a.x, 0, a.z, b.x, 0, b.z, a.x, height, a.z, b.x, height, b.z)

    if (index < points.length - 1) {
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

function buildTrack(): TrackData {
  const centerLine: THREE.Vector3[] = []

  addLine(centerLine, new THREE.Vector3(0, 0, 62), new THREE.Vector3(0, 0, -42), 36)
  addArc(centerLine, 28, -42, 28, Math.PI, Math.PI / 2, 26)
  addLine(
    centerLine,
    centerLine[centerLine.length - 1],
    new THREE.Vector3(94, 0, -14),
    26,
  )
  addArc(centerLine, 94, 16, 30, -Math.PI / 2, 0, 26)
  addLine(
    centerLine,
    centerLine[centerLine.length - 1],
    new THREE.Vector3(124, 0, 66),
    24,
  )

  return {
    centerLine,
    road: makeRibbonGeometry(centerLine, ROAD_WIDTH),
    leftRail: makeRailGeometry(centerLine, ROAD_WIDTH / 2 + 0.35, 1.25, 0.7),
    rightRail: makeRailGeometry(centerLine, -ROAD_WIDTH / 2 - 0.35, 1.25, 0.7),
    centerStripe: makeRibbonGeometry(centerLine, 0.22, 0.045),
  }
}

function useKeyboard() {
  const keys = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      keys.current[event.key.toLowerCase()] = pressed
    }
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return keys
}

function Track() {
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

function Car({ onSpeedChange }: { onSpeedChange: (speed: number) => void }) {
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

function Scene({ onSpeedChange }: { onSpeedChange: (speed: number) => void }) {
  return (
    <>
      <color attach="background" args={['#0b8ed0']} />
      <fog attach="fog" args={['#0b8ed0', 75, 210]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        intensity={2.3}
        position={[24, 36, 16]}
        shadow-camera-far={180}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <Track />
      <Car onSpeedChange={onSpeedChange} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[42, -0.18, 15]} receiveShadow>
        <planeGeometry args={[260, 190]} />
        <meshStandardMaterial color="#40b7da" roughness={0.85} />
      </mesh>
    </>
  )
}

function App() {
  const [speed, setSpeed] = useState(0)

  return (
    <main className="game">
      <Canvas
        shadows
        camera={{ fov: 58, position: [0, 7, 68], near: 0.1, far: 300 }}
        gl={{ antialias: true }}
      >
        <Scene onSpeedChange={setSpeed} />
      </Canvas>
      <div className="hud" aria-live="polite">
        <span>{speed}</span>
        <small>KM/H</small>
      </div>
    </main>
  )
}

export default App
