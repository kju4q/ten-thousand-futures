import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Scenario, SimulationResult } from '../simulation/scenarioTypes'
import { stableUniform } from '../simulation/deterministicRandom'
import { formatOutcome } from '../utils/format'
import { createFutureStory } from './futureStory'
import { createParticleLayout, type ParticleLayout } from './particleLayout'
import { ParticleSpatialGrid } from './spatialGrid'

interface Props {
  scenario: Scenario
  result: SimulationResult | null
  revealKey: number
  onRun: () => void
  running: boolean
  instant?: boolean
  captureMode?: boolean
}

interface Hover {
  id: number
  x: number
  y: number
}

interface CameraState {
  zoom: number
  offsetX: number
  offsetY: number
}

interface ViewState extends CameraState {
  width: number
  height: number
}

interface Trail {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  token: number
}

interface CameraController {
  hitTest: (clientX: number, clientY: number, radius?: number) => Hover | null
  dragging: () => boolean
  focusCluster: (id: number | null) => void
}

interface DormantLayout {
  x: Float32Array
  y: Float32Array
  size: Float32Array
  phase: Float32Array
}

interface CardPlacement {
  card: CSSProperties
  connector: CSSProperties
  direction: 'above' | 'below'
}

const COLORS = [[92, 218, 222], [255, 137, 112], [181, 145, 255]] as const
const MAX_RENDER_SCALE = 3.25
const MAX_LAYER_PIXELS = 10_000_000

function createDormantLayout(count: number, seed: number): DormantLayout {
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  for (let id = 0; id < count; id += 1) {
    x[id] = .018 + stableUniform(seed, 'dormant-x', id, 0) * .964
    y[id] = .018 + stableUniform(seed, 'dormant-y', id, 0) * .964
    const bright = stableUniform(seed, 'dormant-bright', id, 0) > .975
    size[id] = (bright ? 2.1 : .72) + stableUniform(seed, 'dormant-size', id, 0) * (bright ? 1.15 : .9)
    phase[id] = stableUniform(seed, 'dormant-phase', id, 0) * Math.PI * 2
  }
  return { x, y, size, phase }
}

function createGlowSprite(color: readonly [number, number, number]): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = 64
  sprite.height = 64
  const context = sprite.getContext('2d')
  if (!context) return sprite
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(.08, 'rgba(255,255,255,.98)')
  gradient.addColorStop(.2, `rgba(${color[0]},${color[1]},${color[2]},.9)`)
  gradient.addColorStop(.46, `rgba(${color[0]},${color[1]},${color[2]},.28)`)
  gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return sprite
}

function winnerClass(winner: number): string {
  return winner === 0 ? 'future-a' : winner === 1 ? 'future-b' : 'future-even'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export function FutureField({ scenario, result, revealKey, onRun, running, instant = false, captureMode = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fireflyCanvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const pulseRef = useRef<HTMLElement>(null)
  const previousLayoutRef = useRef<ParticleLayout | null>(null)
  const renderedLayoutRef = useRef<{ x: Float32Array; y: Float32Array } | null>(null)
  const hasRenderedResultRef = useRef(false)
  const cameraStateRef = useRef<CameraState>({ zoom: 1, offsetX: 0, offsetY: 0 })
  const controllerRef = useRef<CameraController | null>(null)
  const hoverFrameRef = useRef(0)
  const hoverTimeRef = useRef(0)
  const hoverPointRef = useRef({ x: 0, y: 0 })
  const pinnedRef = useRef<number[]>([])
  const scenarioRef = useRef(scenario)
  const trailTokenRef = useRef(0)
  const [hover, setHover] = useState<Hover | null>(null)
  const [pinned, setPinned] = useState<number[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [view, setView] = useState<ViewState>({ width: 1, height: 1, zoom: 1, offsetX: 0, offsetY: 0 })
  const layout = useMemo(() => result ? createParticleLayout(result, scenario.visualSeed) : null, [result, scenario.visualSeed])
  const dormant = useMemo(() => createDormantLayout(scenario.runs, scenario.visualSeed), [scenario.runs, scenario.visualSeed])
  const axisTicks = useMemo(() => {
    if (!result) return []
    const outcomes = Float64Array.from({ length: result.winners.length }, (_, id) => Math.max(result.outcomesA[id], result.outcomesB[id])).sort()
    return [.29, .5, .71].map((rank) => ({ rank, label: formatOutcome(outcomes[Math.round(rank * (outcomes.length - 1))], scenario) }))
  }, [result, scenario])
  const labelAnchors = useMemo(() => {
    if (!result || !layout) return null
    return ([0, 1] as const).map((winner) => {
      let x = 0
      let y = 0
      let count = 0
      for (let id = 0; id < result.winners.length; id += 1) {
        if (result.winners[id] !== winner || layout.y[id] < .68 || layout.y[id] > .8) continue
        x += layout.x[id]
        y += layout.y[id]
        count += 1
      }
      return count ? { x: x / count, y: Math.min(y / count, .7) } : { x: winner === 0 ? .42 : .58, y: .7 }
    })
  }, [layout, result])
  pinnedRef.current = pinned
  scenarioRef.current = scenario

  useEffect(() => {
    const previous = previousLayoutRef.current
    if (!layout) {
      previousLayoutRef.current = null
      setTrails([])
      return
    }
    const motionReduced = instant || captureMode || matchMedia('(prefers-reduced-motion: reduce)').matches
    if (previous && !motionReduced && pinnedRef.current.length) {
      const token = ++trailTokenRef.current
      const nextTrails = pinnedRef.current.map((id) => ({ id, fromX: previous.x[id], fromY: previous.y[id], toX: layout.x[id], toY: layout.y[id], token }))
        .filter((trail) => Math.hypot(trail.toX - trail.fromX, trail.toY - trail.fromY) > .001)
      setTrails(nextTrails)
      requestAnimationFrame(() => {
        const world = worldRef.current
        if (!world) return
        for (const trail of nextTrails) {
          const marker = world.querySelector<HTMLElement>(`[data-future-id="${trail.id}"]`)
          marker?.animate([
            { transform: `translate3d(${(trail.fromX - trail.toX) * world.clientWidth}px, ${(trail.fromY - trail.toY) * world.clientHeight}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ], { duration: 720, easing: 'cubic-bezier(.2,.75,.18,1)' })
        }
      })
      const timeout = window.setTimeout(() => setTrails((current) => current.filter((trail) => trail.token !== token)), 850)
      previousLayoutRef.current = layout
      return () => clearTimeout(timeout)
    }
    previousLayoutRef.current = layout
    setTrails([])
  }, [captureMode, instant, layout])

  useEffect(() => {
    const canvasElement = canvasRef.current
    const fireflyCanvasElement = fireflyCanvasRef.current
    const layerElement = layerRef.current
    const worldElement = worldRef.current
    const surfaceElement = canvasElement?.closest<HTMLElement>('.future-field')
    if (!canvasElement || !fireflyCanvasElement || !layerElement || !worldElement || !surfaceElement) return
    const drawingContext = canvasElement.getContext('2d', { alpha: true })
    const fireflyDrawingContext = fireflyCanvasElement.getContext('2d', { alpha: true })
    if (!drawingContext || !fireflyDrawingContext) return
    const canvas = canvasElement
    const fireflyCanvas = fireflyCanvasElement
    const context = drawingContext
    const fireflyContext = fireflyDrawingContext
    const layer = layerElement
    const world = worldElement
    const surface = surfaceElement
    const reduced = instant || captureMode || matchMedia('(prefers-reduced-motion: reduce)').matches
    const grid = layout ? new ParticleSpatialGrid(layout.x, layout.y) : null
    const dormantGrid = new ParticleSpatialGrid(dormant.x, dormant.y)
    const sprites = COLORS.map((color) => createGlowSprite(color))
    const sizes = layout ? Float32Array.from({ length: layout.x.length }, (_, id) => 2.5 + stableUniform(scenario.visualSeed, 'particle-size', id, 0) * 1.5) : null
    const camera = cameraStateRef.current
    const pointers = new Map<number, { x: number; y: number; startX: number; startY: number; pointerType: string }>()
    let lastPointer: { x: number; y: number } | null = null
    let pinch: { distance: number; zoom: number; centerX: number; centerY: number } | null = null
    let worldWidth = Math.max(1, surface.clientWidth)
    let worldHeight = Math.max(1, surface.clientHeight)
    let renderTimer = 0
    let transitionTimer = 0
    let fireflyFrame = 0
    let disposed = false
    let visible = true
    let transitioning = false
    let fireflyStrength = 0
    let fireflyTarget = 0
    let fireflyPointer = { x: .5, y: .5 }
    let clusterFocusId: number | null = null

    function renderScale(): number {
      const desired = (devicePixelRatio || 1) * camera.zoom
      const pixelCap = Math.sqrt(MAX_LAYER_PIXELS / Math.max(1, worldWidth * worldHeight))
      return Math.max(1, Math.min(MAX_RENDER_SCALE, pixelCap, desired))
    }

    function sizeCanvas(scale: number) {
      const width = Math.max(1, Math.round(worldWidth * scale))
      const height = Math.max(1, Math.round(worldHeight * scale))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      if (fireflyCanvas.width !== width || fireflyCanvas.height !== height) {
        fireflyCanvas.width = width
        fireflyCanvas.height = height
      }
      canvas.style.width = `${worldWidth}px`
      canvas.style.height = `${worldHeight}px`
      fireflyCanvas.style.width = `${worldWidth}px`
      fireflyCanvas.style.height = `${worldHeight}px`
      canvas.dataset.renderScale = scale.toFixed(2)
      canvas.dataset.particleCount = String(result?.futureIds.length ?? dormant.x.length)
      canvas.dataset.hitTest = result ? 'spatial-grid' : 'dormant-spatial-grid'
      canvas.dataset.state = result ? 'result' : 'idle'
      if (layout) {
        canvas.dataset.probeX = layout.x[4381].toFixed(6)
        canvas.dataset.probeY = layout.y[4381].toFixed(6)
      }
    }

    function clearCanvas(scale: number) {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      fireflyContext.setTransform(1, 0, 0, 1, 0, 0)
      fireflyContext.clearRect(0, 0, fireflyCanvas.width, fireflyCanvas.height)
      fireflyContext.setTransform(scale, 0, 0, scale, 0, 0)
    }

    function drawConnections() {
      if (!result || !layout) return
      context.globalCompositeOperation = 'source-over'
      context.strokeStyle = 'rgba(161, 198, 229, .075)'
      context.lineWidth = .65
      context.beginPath()
      for (let link = 0; link < 72; link += 1) {
        const first = (link * 151 + 17) % layout.x.length
        const second = (first + 37 + (link % 11)) % layout.x.length
        if (result.winners[first] !== result.winners[second]) continue
        const firstX = layout.x[first] * worldWidth
        const firstY = layout.y[first] * worldHeight
        const secondX = layout.x[second] * worldWidth
        const secondY = layout.y[second] * worldHeight
        if ((firstX - secondX) ** 2 + (firstY - secondY) ** 2 < 7000) {
          context.moveTo(firstX, firstY)
          context.lineTo(secondX, secondY)
        }
      }
      context.stroke()
    }

    function drawIdle(scale: number) {
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = .26
      for (let id = 0; id < dormant.x.length; id += 1) {
        const size = dormant.size[id]
        context.drawImage(sprites[id % 2], dormant.x[id] * worldWidth - size, dormant.y[id] * worldHeight - size, size * 2, size * 2)
      }
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      canvas.dataset.renderScale = scale.toFixed(2)
      canvas.dataset.settled = 'true'
      canvas.dataset.motion = 'dormant'
      canvas.dataset.idleAlpha = '.26'
      layer.dataset.settled = 'true'
      renderedLayoutRef.current = dormant
      hasRenderedResultRef.current = false
    }

    function drawParticles(x: Float32Array, y: Float32Array, alpha = .58) {
      if (!result || !layout || !sizes) return
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = alpha
      for (let id = 0; id < x.length; id += 1) {
        const winner = result.winners[id]
        const size = sizes[id] + (layout.clamped[id] ? .7 : 0)
        const particleX = x[id] * worldWidth
        const particleY = y[id] * worldHeight
        context.drawImage(sprites[winner], particleX - size, particleY - size, size * 2, size * 2)
      }
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }

    function drawTransitionStreaks(fromX: Float32Array, fromY: Float32Array) {
      if (!result) return
      context.globalCompositeOperation = 'lighter'
      context.lineWidth = .65
      for (let winner = 0; winner < COLORS.length; winner += 1) {
        const color = COLORS[winner]
        context.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},.13)`
        context.beginPath()
        for (let id = 0; id < layout!.x.length; id += 19) {
          if (result.winners[id] !== winner) continue
          const startX = fromX[id] * worldWidth
          const startY = fromY[id] * worldHeight
          const endX = layout!.x[id] * worldWidth
          const endY = layout!.y[id] * worldHeight
          context.moveTo(startX + (endX - startX) * .58, startY + (endY - startY) * .58)
          context.lineTo(endX, endY)
        }
        context.stroke()
      }
      context.globalCompositeOperation = 'source-over'
    }

    function drawFireflies() {
      fireflyFrame = 0
      if (disposed || result || reduced || !visible) return
      fireflyStrength += (fireflyTarget - fireflyStrength) * .13
      fireflyContext.clearRect(0, 0, worldWidth, worldHeight)
      const neighbors = dormantGrid.within(fireflyPointer.x, fireflyPointer.y, 86 / worldWidth, 86 / worldHeight)
      fireflyCanvas.dataset.responsiveCount = String(neighbors.length)
      fireflyContext.globalCompositeOperation = 'lighter'
      for (const neighbor of neighbors) {
        const id = neighbor.id
        const closeness = (1 - neighbor.distance) * fireflyStrength
        const driftX = Math.cos(dormant.phase[id]) * 1.2
        const driftY = Math.sin(dormant.phase[id]) * 1.2
        const baseX = dormant.x[id] * worldWidth
        const baseY = dormant.y[id] * worldHeight
        const towardX = (fireflyPointer.x * worldWidth - baseX) * .035 * closeness
        const towardY = (fireflyPointer.y * worldHeight - baseY) * .035 * closeness
        const size = dormant.size[id] * (1.25 + closeness * 1.15)
        fireflyContext.globalAlpha = .2 + closeness * .52
        fireflyContext.drawImage(sprites[id % 2], baseX + driftX + towardX - size, baseY + driftY + towardY - size, size * 2, size * 2)
      }
      fireflyContext.globalAlpha = 1
      fireflyContext.globalCompositeOperation = 'source-over'
      if (fireflyTarget > 0 || fireflyStrength > .015) fireflyFrame = requestAnimationFrame(drawFireflies)
      else {
        fireflyContext.clearRect(0, 0, worldWidth, worldHeight)
        fireflyCanvas.dataset.responsiveCount = '0'
      }
    }

    function wakeFireflies(point: { x: number; y: number }) {
      if (result || reduced) return
      fireflyPointer = { x: clamp(point.x / worldWidth, 0, 1), y: clamp(point.y / worldHeight, 0, 1) }
      fireflyTarget = 1
      if (!fireflyFrame) fireflyFrame = requestAnimationFrame(drawFireflies)
    }

    function restFireflies() {
      fireflyTarget = 0
      if (!fireflyFrame && fireflyStrength > .015) fireflyFrame = requestAnimationFrame(drawFireflies)
    }

    function drawCluster(futureId: number | null) {
      clusterFocusId = futureId
      const scale = renderScale()
      fireflyContext.setTransform(1, 0, 0, 1, 0, 0)
      fireflyContext.clearRect(0, 0, fireflyCanvas.width, fireflyCanvas.height)
      fireflyContext.setTransform(scale, 0, 0, scale, 0, 0)
      if (futureId === null || !result || !layout || !grid || !sizes) {
        surface.dataset.clusterActive = 'false'
        surface.dataset.clusterNeighbors = '0'
        fireflyCanvas.style.transformOrigin = '50% 50%'
        return
      }
      fireflyCanvas.style.transformOrigin = `${layout.x[futureId] * 100}% ${layout.y[futureId] * 100}%`
      const winner = result.winners[futureId]
      const neighbors = grid.within(layout.x[futureId], layout.y[futureId], .105, .13, 90)
        .filter((neighbor) => neighbor.id !== futureId && result.winners[neighbor.id] === winner)
        .slice(0, 42)
      surface.dataset.clusterActive = 'true'
      surface.dataset.clusterNeighbors = String(neighbors.length)
      fireflyContext.globalCompositeOperation = 'source-over'
      fireflyContext.strokeStyle = 'rgba(205, 214, 214, .18)'
      fireflyContext.lineWidth = .55
      fireflyContext.beginPath()
      const originX = layout.x[futureId] * worldWidth
      const originY = layout.y[futureId] * worldHeight
      for (const neighbor of neighbors.slice(0, 9)) {
        fireflyContext.moveTo(originX, originY)
        fireflyContext.lineTo(layout.x[neighbor.id] * worldWidth, layout.y[neighbor.id] * worldHeight)
      }
      fireflyContext.stroke()
      fireflyContext.globalCompositeOperation = 'lighter'
      fireflyContext.globalAlpha = .62
      for (const neighbor of neighbors) {
        const id = neighbor.id
        const size = sizes[id] * (1.12 - neighbor.distance * .16)
        fireflyContext.drawImage(sprites[result.winners[id]], layout.x[id] * worldWidth - size, layout.y[id] * worldHeight - size, size * 2, size * 2)
      }
      const focusSize = sizes[futureId] * 1.8
      fireflyContext.globalAlpha = .92
      fireflyContext.drawImage(sprites[winner], originX - focusSize, originY - focusSize, focusSize * 2, focusSize * 2)
      fireflyContext.globalAlpha = 1
      fireflyContext.globalCompositeOperation = 'source-over'
    }

    function renderField(animate = false) {
      if (disposed || !visible) return
      if (!animate && transitioning) return
      clearTimeout(transitionTimer)
      worldWidth = Math.max(1, surface.clientWidth)
      worldHeight = Math.max(1, surface.clientHeight)
      const scale = renderScale()
      sizeCanvas(scale)
      clearCanvas(scale)
      if (!result || !layout || !sizes) {
        drawIdle(scale)
        return
      }
      const from = renderedLayoutRef.current ?? dormant
      const canAnimate = animate && !reduced && from.x.length === layout.x.length
      if (!canAnimate) {
        transitioning = false
        drawConnections()
        drawParticles(layout.x, layout.y)
        canvas.dataset.settled = 'true'
        canvas.dataset.motion = 'settled'
        layer.dataset.settled = 'true'
        renderedLayoutRef.current = layout
        hasRenderedResultRef.current = true
        document.documentElement.dataset.ready = 'true'
        if (clusterFocusId !== null) drawCluster(clusterFocusId)
        return
      }
      const duration = hasRenderedResultRef.current ? 760 : 1950
      const motionName = hasRenderedResultRef.current ? 'reweaving' : 'igniting'
      drawConnections()
      drawParticles(layout.x, layout.y)
      drawTransitionStreaks(from.x, from.y)
      canvas.dataset.settled = 'false'
      canvas.dataset.motion = motionName
      layer.dataset.settled = 'false'
      transitioning = true
      canvas.animate([
        { opacity: .18, transform: 'scale(.976)' },
        { opacity: .78, offset: .58 },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration, easing: 'cubic-bezier(.16,.72,.14,1)' })
      renderedLayoutRef.current = layout
      hasRenderedResultRef.current = true
      document.documentElement.dataset.ready = 'true'
      transitionTimer = window.setTimeout(() => {
        transitioning = false
        clearCanvas(scale)
        drawConnections()
        drawParticles(layout.x, layout.y)
        canvas.dataset.settled = 'true'
        canvas.dataset.motion = 'settled'
        layer.dataset.settled = 'true'
        if (clusterFocusId !== null) drawCluster(clusterFocusId)
      }, duration)
    }

    function scheduleReraster() {
      clearTimeout(renderTimer)
      renderTimer = window.setTimeout(() => renderField(false), 90)
    }

    function updateView() {
      setView({ width: worldWidth, height: worldHeight, zoom: camera.zoom, offsetX: camera.offsetX, offsetY: camera.offsetY })
    }

    function applyCamera(reraster = false) {
      world.style.transform = `translate3d(${camera.offsetX}px, ${camera.offsetY}px, 0) scale(${camera.zoom})`
      canvas.dataset.cameraZoom = camera.zoom.toFixed(3)
      canvas.dataset.cameraX = camera.offsetX.toFixed(1)
      canvas.dataset.cameraY = camera.offsetY.toFixed(1)
      updateView()
      if (reraster) scheduleReraster()
    }

    function relativePoint(event: PointerEvent | WheelEvent | MouseEvent) {
      const rect = surface.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    function hitTest(clientX: number, clientY: number, radius = 13): Hover | null {
      if (!grid || !layout || pointers.size) return null
      const rect = surface.getBoundingClientRect()
      const screenX = clientX - rect.left
      const screenY = clientY - rect.top
      const worldX = (screenX - camera.offsetX) / camera.zoom
      const worldY = (screenY - camera.offsetY) / camera.zoom
      const hit = grid.nearest(worldX / worldWidth, worldY / worldHeight, radius / (worldWidth * camera.zoom), radius / (worldHeight * camera.zoom))
      canvas.dataset.hitCandidates = String(hit?.candidates ?? 0)
      return hit ? { id: hit.id, x: screenX, y: screenY } : null
    }

    function zoomAround(screenX: number, screenY: number, nextZoom: number) {
      const bounded = clamp(nextZoom, .72, 2.8)
      const ratio = bounded / camera.zoom
      camera.offsetX = screenX - (screenX - camera.offsetX) * ratio
      camera.offsetY = screenY - (screenY - camera.offsetY) * ratio
      camera.zoom = bounded
      applyCamera(true)
    }

    function resetCamera() {
      camera.zoom = 1
      camera.offsetX = 0
      camera.offsetY = 0
      applyCamera(true)
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const point = relativePoint(event)
      zoomAround(point.x, point.y, camera.zoom * Math.exp(-event.deltaY * .0014))
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest('button, input, summary, .future-card')) return
      const point = relativePoint(event)
      pointers.set(event.pointerId, { ...point, startX: point.x, startY: point.y, pointerType: event.pointerType })
      surface.setPointerCapture(event.pointerId)
      lastPointer = point
      setHover(null)
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()]
        pinch = { distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: camera.zoom, centerX: (first.x + second.x) / 2, centerY: (first.y + second.y) / 2 }
      }
    }

    function onPointerMove(event: PointerEvent) {
      const point = relativePoint(event)
      wakeFireflies(point)
      if (!reduced) {
        surface.style.setProperty('--parallax-x', `${((point.x / worldWidth) - .5) * -9}px`)
        surface.style.setProperty('--parallax-y', `${((point.y / worldHeight) - .5) * -7}px`)
      }
      const active = pointers.get(event.pointerId)
      if (!active) return
      pointers.set(event.pointerId, { ...active, ...point })
      if (pointers.size === 2 && pinch) {
        const [first, second] = [...pointers.values()]
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
        zoomAround(pinch.centerX, pinch.centerY, pinch.zoom * distance / Math.max(1, pinch.distance))
      } else if (pointers.size === 1 && lastPointer) {
        camera.offsetX += point.x - lastPointer.x
        camera.offsetY += point.y - lastPointer.y
        applyCamera()
      }
      lastPointer = point
    }

    function onPointerUp(event: PointerEvent) {
      const active = pointers.get(event.pointerId)
      const point = relativePoint(event)
      const moved = active ? Math.hypot(point.x - active.startX, point.y - active.startY) : Infinity
      pointers.delete(event.pointerId)
      pinch = null
      lastPointer = pointers.size ? [...pointers.values()][0] : null
      if (moved > 6 || pointers.size || !result) return
      const hit = hitTest(event.clientX, event.clientY, active?.pointerType === 'touch' ? 22 : 14)
      if (!hit) {
        setPinned([])
        setAnnouncement('All pinned futures cleared.')
        return
      }
      setHover(hit)
      setPinned((current) => {
        const alreadyPinned = current.includes(hit.id)
        const next = alreadyPinned ? current.filter((id) => id !== hit.id) : [...current.slice(-2), hit.id]
        const story = createFutureStory(scenarioRef.current, result, hit.id)
        setAnnouncement(alreadyPinned ? `${story.title} unpinned.` : `${story.title} pinned for comparison.`)
        return next
      })
    }

    controllerRef.current = { hitTest, dragging: () => pointers.size > 0, focusCluster: drawCluster }
    canvas.dataset.settled = result ? 'false' : 'true'
    layer.dataset.settled = result ? 'false' : 'true'
    renderField(Boolean(result))
    applyCamera()
    if (result && !reduced) {
      pulseRef.current?.animate([
        { opacity: .76, transform: 'scale(.12)' },
        { opacity: .42, offset: .56 },
        { opacity: 0, transform: 'scale(4.2)' },
      ], { duration: 850, easing: 'cubic-bezier(.18,.72,.12,1)' })
    }

    const resizeObserver = new ResizeObserver(() => { renderField(false); updateView() })
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) renderField(false) })
    resizeObserver.observe(surface)
    intersectionObserver.observe(surface)
    surface.addEventListener('wheel', onWheel, { passive: false })
    surface.addEventListener('pointerdown', onPointerDown)
    surface.addEventListener('pointermove', onPointerMove)
    surface.addEventListener('pointerleave', restFireflies)
    surface.addEventListener('pointerup', onPointerUp)
    surface.addEventListener('pointercancel', onPointerUp)
    surface.addEventListener('dblclick', resetCamera)
    const visibility = () => { visible = !document.hidden; if (visible) renderField(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      controllerRef.current = null
      clearTimeout(renderTimer)
      clearTimeout(transitionTimer)
      cancelAnimationFrame(fireflyFrame)
      canvas.getAnimations().forEach((animation) => animation.cancel())
      fireflyCanvas.getAnimations().forEach((animation) => animation.cancel())
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      surface.removeEventListener('wheel', onWheel)
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerleave', restFireflies)
      surface.removeEventListener('pointerup', onPointerUp)
      surface.removeEventListener('pointercancel', onPointerUp)
      surface.removeEventListener('dblclick', resetCamera)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [captureMode, dormant, instant, layout, result, revealKey, scenario.visualSeed])

  const pinnedFocus = pinned[pinned.length - 1] ?? null
  useEffect(() => {
    controllerRef.current?.focusCluster(hover?.id ?? pinnedFocus)
  }, [hover?.id, pinnedFocus])

  function inspectHover(event: React.PointerEvent<HTMLElement>) {
    if (captureMode || event.pointerType === 'touch' || controllerRef.current?.dragging()) return
    hoverPointRef.current = { x: event.clientX, y: event.clientY }
    if (hoverFrameRef.current) return
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = 0
      const now = performance.now()
      if (now - hoverTimeRef.current < 32) return
      hoverTimeRef.current = now
      const point = hoverPointRef.current
      const next = controllerRef.current?.hitTest(point.x, point.y) ?? null
      setHover((current) => current?.id === next?.id ? current : next)
    })
  }

  function unpin(id: number) {
    setPinned((current) => current.filter((currentId) => currentId !== id))
    setAnnouncement(`Future no. ${new Intl.NumberFormat(scenario.locale).format(id + 1)} unpinned.`)
  }

  function cardPlacement(pointX: number, pointY: number, order: number): CardPlacement {
    const width = Math.min(286, Math.max(238, view.width - 24))
    const cardHeight = view.width <= 800 ? 192 : 204
    const protectedElements = typeof document === 'undefined' ? [] : [...document.querySelectorAll<HTMLElement>('.result-statement, .outcome-ledger')]
    const protectedTop = protectedElements.reduce((top, element) => Math.min(top, element.getBoundingClientRect().top), view.height - (view.width <= 800 ? 250 : 215))
    const maxTop = Math.max(112, protectedTop - cardHeight - 14)
    const direction = pointY >= view.height / 2 ? 'above' : 'below'
    const preferredTop = direction === 'above' ? pointY - cardHeight - 18 - order * 7 : pointY + 18 + order * 7
    const preferredLeft = pointX < view.width / 2 ? pointX + 18 + order * 9 : pointX - width - 18 - order * 9
    const left = clamp(preferredLeft, 12, Math.max(12, view.width - width - 12))
    const top = clamp(preferredTop, 112, maxTop)
    const anchorX = clamp(pointX, left, left + width)
    const anchorY = clamp(pointY, top, top + cardHeight)
    const deltaX = anchorX - pointX
    const deltaY = anchorY - pointY
    return {
      card: { left, top },
      connector: { left: pointX, top: pointY, width: Math.hypot(deltaX, deltaY), rotate: `${Math.atan2(deltaY, deltaX)}rad` },
      direction,
    }
  }

  function pinnedPlacement(id: number, order: number): CardPlacement {
    if (!layout) return cardPlacement(12, 120, order)
    const pointX = layout.x[id] * view.width * view.zoom + view.offsetX
    const pointY = layout.y[id] * view.height * view.zoom + view.offsetY
    return cardPlacement(pointX, pointY, order)
  }

  const markerIds = [...new Set([...pinned, ...(hover ? [hover.id] : [])])]
  const hoverStory = hover && result ? createFutureStory(scenario, result, hover.id) : null
  const hoverPlacement = hover ? cardPlacement(hover.x, hover.y, 0) : null

  return <section className="future-field" onPointerMove={inspectHover} onPointerLeave={() => setHover(null)} aria-label="Future Field visualization. Every point is one simulated future. Scroll or pinch to zoom, drag empty space to pan, click a future to pin it, and double-click empty space to reset the camera.">
    <div ref={layerRef} className="particle-layer">
      <div ref={worldRef} className="camera-world">
        <canvas ref={canvasRef} className="base-particles" />
        <canvas ref={fireflyCanvasRef} className="idle-fireflies" aria-hidden="true" />
        {result && <i ref={pulseRef} className="reveal-pulse" aria-hidden="true" />}
        {trails.map((trail) => {
          const deltaX = (trail.toX - trail.fromX) * view.width
          const deltaY = (trail.toY - trail.fromY) * view.height
          return <i key={`${trail.id}-${trail.token}`} className={`future-trail ${winnerClass(result?.winners[trail.id] ?? 2)}`} style={{ left: `${trail.fromX * 100}%`, top: `${trail.fromY * 100}%`, width: Math.hypot(deltaX, deltaY), rotate: `${Math.atan2(deltaY, deltaX)}rad` }} aria-hidden="true" />
        })}
        {markerIds.map((id) => <i key={id} data-future-id={id} className={`particle-marker ${winnerClass(result?.winners[id] ?? 2)} ${pinned.includes(id) ? 'pinned' : 'hovered'}`} style={{ left: `${(layout?.x[id] ?? .5) * 100}%`, top: `${(layout?.y[id] ?? .5) * 100}%` }} aria-hidden="true" />)}
      </div>
    </div>
    {result && <div className="measurement-axis" aria-label="Final value measurement axis">
      <i aria-hidden="true" />
      {axisTicks.map((tick) => <span key={tick.rank} style={{ top: `${(0.94 - tick.rank * .88) * 100}%` }}><b aria-hidden="true" />{tick.label}</span>)}
    </div>}
    {result && labelAnchors && <>
      <div className="field-edge field-edge-a" style={{ left: `${labelAnchors[0].x * 100}%`, top: `${labelAnchors[0].y * 100}%` }}>{scenario.options[0].name} <span>(A)</span></div>
      <div className="field-edge field-edge-b" style={{ left: `${labelAnchors[1].x * 100}%`, top: `${labelAnchors[1].y * 100}%` }}>{scenario.options[1].name} <span>(B)</span></div>
    </>}
    {!result && <div className="run-prompt">
      <button className="run-core" onClick={onRun} disabled={running}>{running ? 'calculating futures...' : 'run 10,000 futures'}</button>
      <span>press once, wait two seconds.</span>
    </div>}
    {!captureMode && hover && hoverStory && hoverPlacement && !pinned.includes(hover.id) && <>
      <i className={`future-card-link hover-only ${winnerClass(result?.winners[hover.id] ?? 2)}`} style={hoverPlacement.connector} aria-hidden="true" />
      <article className="future-card hover-card hover-only" data-card-direction={hoverPlacement.direction} style={hoverPlacement.card} aria-hidden="true">
        <FutureCardContent story={hoverStory} />
        <small>Click this light to pin it</small>
      </article>
    </>}
    {result && pinned.map((id, order) => {
      const story = createFutureStory(scenario, result, id)
      const placement = pinnedPlacement(id, order)
      return <Fragment key={id}>
        <i className={`future-card-link ${winnerClass(result.winners[id])}`} style={placement.connector} aria-hidden="true" />
        <article className={`future-card pinned-card ${winnerClass(result.winners[id])}`} data-card-direction={placement.direction} style={placement.card} tabIndex={0} aria-label={`${story.title}. ${story.story} ${story.detail}`}>
          <button className="unpin-future" onClick={(event) => { event.stopPropagation(); unpin(id) }} aria-label={`Unpin ${story.title}`}>Close</button>
          <FutureCardContent story={story} />
          <small>PINNED {order + 1} OF {pinned.length}</small>
        </article>
      </Fragment>
    })}
    <div className="sr-only" aria-live="polite">{announcement}</div>
  </section>
}

function FutureCardContent({ story }: { story: ReturnType<typeof createFutureStory> }) {
  return <>
    <b>{story.title}</b>
    <p>{story.story}</p>
    <p>{story.detail}</p>
    {story.samples.length > 0 && <dl>{story.samples.map((sample) => <div key={sample.label}><dt>{sample.label}</dt><dd>{sample.value}</dd></div>)}</dl>}
  </>
}
