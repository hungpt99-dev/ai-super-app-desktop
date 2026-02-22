import React, { useEffect, useState } from 'react'

/**
 * DevMetricsOverlay — floating FPS + JS heap counter.
 *
 * Rendered only when dev mode + `showPerformanceMetrics` are both enabled.
 * Consumes no resources when hidden — the parent conditionally mounts it.
 */
export function DevMetricsOverlay(): React.JSX.Element {
  const [fps, setFps] = useState(0)
  const [memory, setMemory] = useState('—')

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let raf: number

    const tick = (): void => {
      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1_000) {
        setFps(Math.round((frameCount * 1_000) / (now - lastTime)))
        frameCount = 0
        lastTime = now
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
        if (perf.memory) {
          setMemory(`${(perf.memory.usedJSHeapSize / 1_048_576).toFixed(1)} MB`)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[9999] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-2.5 py-1.5 font-mono text-[10px] text-[var(--color-text-secondary)] backdrop-blur">
      <span className={fps < 30 ? 'text-red-400' : fps < 55 ? 'text-amber-400' : 'text-emerald-400'}>
        {fps} fps
      </span>
      {' · '}
      <span>{memory}</span>
      {' · '}
      <span className="text-[var(--color-text-muted)]">DEV</span>
    </div>
  )
}
