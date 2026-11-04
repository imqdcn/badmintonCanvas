import { useRef } from 'react'
import { Bracket } from './components/Bracket'
import { ControlPanel } from './components/ControlPanel'
import { Header } from './components/Header'
import { SlotEditor } from './components/SlotEditor'
import { CANVAS_W, canvasHeight, computeLayout, FOOTER_H } from './domain/layout'
import { useStore } from './store'

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const size = useStore((s) => s.brackets[s.mode].size)
  const height = canvasHeight(computeLayout(size))

  return (
    <div className="app">
      <ControlPanel canvasRef={canvasRef} />
      <main className="stage">
        {/* 下面这个节点就是要导出成图片的海报 */}
        <div ref={canvasRef} className="canvas" style={{ width: CANVAS_W, height }}>
          <Header />
          <Bracket />
          <div className="footer-band" style={{ height: FOOTER_H }} />
        </div>
      </main>
      <SlotEditor />
    </div>
  )
}
