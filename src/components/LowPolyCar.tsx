import * as THREE from 'three'
import { CAR_WIDTH } from '../game/constants'

type LowPolyCarProps = {
  color: string
  glassColor?: string
}

const FRONT_Z = -2.35
const REAR_Z = 2.1
const BODY_WIDTH = CAR_WIDTH * 1.05

function makeBodyGeometry() {
  const frontWidth = BODY_WIDTH * 0.34
  const midWidth = BODY_WIDTH * 0.88
  const rearWidth = BODY_WIDTH
  const vertices = new Float32Array([
    -frontWidth / 2, -0.36, FRONT_Z,
    frontWidth / 2, -0.36, FRONT_Z,
    -midWidth / 2, -0.34, -0.5,
    midWidth / 2, -0.34, -0.5,
    -rearWidth / 2, -0.32, REAR_Z,
    rearWidth / 2, -0.32, REAR_Z,
    -frontWidth / 2, 0.02, FRONT_Z,
    frontWidth / 2, 0.02, FRONT_Z,
    -midWidth / 2, 0.34, -0.5,
    midWidth / 2, 0.34, -0.5,
    -rearWidth / 2, 0.62, REAR_Z,
    rearWidth / 2, 0.62, REAR_Z,
  ])
  const indices = [
    0, 2, 1, 1, 2, 3,
    2, 4, 3, 3, 4, 5,
    6, 7, 8, 7, 9, 8,
    8, 9, 10, 9, 11, 10,
    0, 6, 2, 2, 6, 8,
    2, 8, 4, 4, 8, 10,
    1, 3, 7, 3, 9, 7,
    3, 5, 9, 5, 11, 9,
    0, 1, 6, 1, 7, 6,
    4, 10, 5, 5, 10, 11,
    0, 4, 2, 0, 5, 4,
    0, 1, 5,
  ]
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

function makeCanopyGeometry() {
  const halfWidth = CAR_WIDTH * 0.28
  const vertices = new Float32Array([
    -halfWidth, 0.24, -0.72,
    halfWidth, 0.24, -0.72,
    -halfWidth * 1.16, 0.16, 0.48,
    halfWidth * 1.16, 0.16, 0.48,
    0, 0.84, -0.36,
    0, 0.7, 0.64,
  ])
  const indices = [
    0, 1, 4,
    1, 3, 4,
    3, 5, 4,
    3, 2, 5,
    2, 0, 5,
    0, 4, 5,
    0, 2, 1,
    1, 2, 3,
  ]
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

const bodyGeometry = makeBodyGeometry()
const canopyGeometry = makeCanopyGeometry()

function Wheel({ side, z }: { side: number; z: number }) {
  return (
    <group position={[side * (CAR_WIDTH * 0.57), -0.35, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.34, 12]} />
        <meshStandardMaterial color="#202020" roughness={0.68} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, side * 0.19, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.05, 8]} />
        <meshStandardMaterial
          color="#d89f00"
          roughness={0.36}
          metalness={0.28}
          flatShading
        />
      </mesh>
      {[0, 1, 2, 3, 4].map((spoke) => (
        <mesh
          key={spoke}
          rotation={[Math.PI / 2, 0, (spoke * Math.PI * 2) / 5]}
          position={[0, side * 0.22, 0]}
        >
          <boxGeometry args={[0.42, 0.045, 0.045]} />
          <meshStandardMaterial color="#f0b600" roughness={0.34} metalness={0.18} />
        </mesh>
      ))}
    </group>
  )
}

export function LowPolyCar({ color, glassColor = '#0c4d82' }: LowPolyCarProps) {
  return (
    <group>
      <mesh geometry={bodyGeometry} castShadow>
        <meshStandardMaterial
          color={color}
          roughness={0.42}
          metalness={0.16}
          flatShading
        />
      </mesh>

      <mesh position={[0, 0.1, -1.22]} rotation={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.08, 2.38]} />
        <meshStandardMaterial color="#f0c400" roughness={0.38} flatShading />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (CAR_WIDTH * 0.41), -0.02, 0.54]}
          rotation={[0, side * 0.18, 0.04]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.58, 1.35]} />
          <meshStandardMaterial color="#df9d00" roughness={0.42} flatShading />
        </mesh>
      ))}

      <mesh geometry={canopyGeometry} castShadow>
        <meshStandardMaterial
          color={glassColor}
          roughness={0.2}
          metalness={0.04}
          flatShading
        />
      </mesh>

      <mesh position={[0, -0.22, FRONT_Z - 0.05]} castShadow>
        <boxGeometry args={[CAR_WIDTH * 1.12, 0.22, 0.34]} />
        <meshStandardMaterial color="#005aa0" roughness={0.45} metalness={0.08} />
      </mesh>

      <mesh position={[0, 0.08, REAR_Z + 0.05]} castShadow>
        <boxGeometry args={[CAR_WIDTH * 1.03, 0.82, 0.24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.44}
          metalness={0.14}
          flatShading
        />
      </mesh>
      <mesh position={[0, -0.12, REAR_Z + 0.18]} castShadow>
        <boxGeometry args={[CAR_WIDTH * 0.72, 0.34, 0.08]} />
        <meshStandardMaterial color="#222222" roughness={0.7} flatShading />
      </mesh>

      <mesh position={[0, 1.08, 1.76]} castShadow>
        <boxGeometry args={[CAR_WIDTH * 1.46, 0.16, 0.56]} />
        <meshStandardMaterial color="#df9d00" roughness={0.4} flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (CAR_WIDTH * 0.43), 0.62, 1.58]} castShadow>
          <boxGeometry args={[0.16, 0.94, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.42} flatShading />
        </mesh>
      ))}

      <Wheel side={-1} z={-1.45} />
      <Wheel side={1} z={-1.45} />
      <Wheel side={-1} z={1.28} />
      <Wheel side={1} z={1.28} />
    </group>
  )
}
