import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import './App.css'

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
