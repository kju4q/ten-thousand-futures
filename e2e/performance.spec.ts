import { expect, test } from '@playwright/test'

test('meets the reveal frame-rate and worker targets', async ({ page }) => {
  await page.goto('/?autoplay=1&replay=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const measurement = await page.evaluate(async () => {
    const started = performance.now()
    let frames = 0
    while (performance.now() - started < 1200) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      frames += 1
    }
    const elapsed = performance.now() - started
    const longTasks = performance.getEntriesByType('longtask').map((entry) => entry.duration)
    return { fps: frames / (elapsed / 1000), frames, elapsed, longestTask: Math.max(0, ...longTasks) }
  })
  const engineText = await page.locator('.engine-stat').innerText()
  const workerMs = Number(engineText.match(/([\d.]+) ms/i)?.[1] ?? Number.NaN)
  console.log(`PERFORMANCE fps=${measurement.fps.toFixed(1)} workerMs=${workerMs.toFixed(1)} longestTaskMs=${measurement.longestTask.toFixed(1)}`)
  expect(measurement.fps).toBeGreaterThanOrEqual(45)
  expect(workerMs).toBeLessThan(200)
  expect(measurement.longestTask).toBeLessThan(100)
})

test('keeps camera interaction within the frame budget', async ({ page }) => {
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  const measurement = await page.evaluate(async ({ x, y }) => {
    const canvasElement = document.querySelector<HTMLCanvasElement>('.future-field canvas')
    if (!canvasElement) throw new Error('Canvas missing.')
    const started = performance.now()
    let frames = 0
    const interval = window.setInterval(() => canvasElement.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: frames % 2 ? 18 : -18, bubbles: true, cancelable: true })), 20)
    while (performance.now() - started < 900) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      frames += 1
    }
    window.clearInterval(interval)
    const elapsed = performance.now() - started
    return { fps: frames / (elapsed / 1000) }
  }, { x: box.x + box.width * 0.6, y: box.y + box.height * 0.45 })
  console.log(`CAMERA fps=${measurement.fps.toFixed(1)}`)
  expect(measurement.fps).toBeGreaterThanOrEqual(45)
})

test('keeps spatial-grid hover interaction within the frame budget', async ({ page }) => {
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  const probeX = Number(await canvas.getAttribute('data-probe-x'))
  const probeY = Number(await canvas.getAttribute('data-probe-y'))
  const measurement = await page.evaluate(async ({ x, y }) => {
    const field = document.querySelector<HTMLElement>('.future-field')
    if (!field) throw new Error('Future Field is missing.')
    const started = performance.now()
    let frames = 0
    const interval = window.setInterval(() => {
      const wobble = Math.sin(frames * .7) * 5
      field.dispatchEvent(new PointerEvent('pointermove', { clientX: x + wobble, clientY: y - wobble, pointerType: 'mouse', bubbles: true }))
    }, 16)
    while (performance.now() - started < 900) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      frames += 1
    }
    window.clearInterval(interval)
    const elapsed = performance.now() - started
    return { fps: frames / (elapsed / 1000) }
  }, { x: box.x + probeX * box.width, y: box.y + probeY * box.height })
  const candidates = Number(await canvas.getAttribute('data-hit-candidates'))
  console.log(`HOVER fps=${measurement.fps.toFixed(1)} candidates=${candidates}`)
  expect(measurement.fps).toBeGreaterThanOrEqual(45)
  expect(candidates).toBeLessThan(1000)
})
