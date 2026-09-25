import { expect, test } from '@playwright/test'
import { DISCLAIMER } from '../src/components/DisclaimerFooter'
import { createParticleLayout } from '../src/future-field/particleLayout'
import { freshDefaultScenario } from '../src/scenarios/defaultScenario'
import { simulateScenario } from '../src/simulation/simulationEngine'

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 390, height: 844 }]) {
  test(`fits ${viewport.width} by ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const vertical = viewport.height > viewport.width && viewport.width > 800
    await page.goto(`/?testMode=1${vertical ? '&present=1&aspect=vertical' : ''}`)
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
    if (vertical) await expect(page.getByText(DISCLAIMER)).toHaveCount(0)
    else await expect(page.getByText(DISCLAIMER)).toBeVisible()
    const canvasBox = await page.locator('.base-particles').boundingBox()
    expect(canvasBox?.x).toBeCloseTo(0, 0)
    expect(canvasBox?.y).toBeCloseTo(0, 0)
    expect(canvasBox?.width).toBeCloseTo(viewport.width, 0)
    expect(canvasBox?.height).toBeCloseTo(viewport.height, 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    const questionBox = await page.locator('.question h1').boundingBox()
    expect(questionBox?.height).toBeLessThanOrEqual(viewport.width <= 800 ? 38 : 32)
    if (!vertical) {
      const overlaps = await page.evaluate(() => {
        const labels = [...document.querySelectorAll<HTMLElement>('.field-edge, .question')].filter((element) => getComputedStyle(element).display !== 'none')
        const chips = [...document.querySelectorAll<HTMLElement>('.assumption-chip')].filter((element) => getComputedStyle(element).display !== 'none')
        return labels.flatMap((label) => chips.map((chip) => {
          const a = label.getBoundingClientRect()
          const b = chip.getBoundingClientRect()
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        })).filter(Boolean).length
      })
      expect(overlaps).toBe(0)
    }
  })
}

test('respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByText(DISCLAIMER)).toBeVisible()
  await expect(page.locator('.particle-layer')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.base-particles')).toHaveCSS('animation-name', 'none')
  const chip = page.getByRole('button', { name: /Startup succeeds:/ })
  await chip.focus()
  await page.keyboard.press('ArrowRight')
  await expect(chip).toHaveAccessibleName(/36%/)
})

test('renders a responsive ten-thousand-light dormant sky', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('.base-particles')
  await expect(canvas).toHaveAttribute('data-state', 'idle')
  await expect(canvas).toHaveAttribute('data-particle-count', '10000')
  await expect(canvas).toHaveAttribute('data-hit-test', 'dormant-spatial-grid')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Dormant sky is not visible.')
  await page.mouse.move(box.x + box.width * .54, box.y + box.height * .48)
  await expect.poll(async () => Number(await page.locator('.idle-fireflies').getAttribute('data-responsive-count'))).toBeGreaterThan(0)
})

test('uses DPR and camera scale for a crisp backing store', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', deviceScaleFactor: 2, viewport: { width: 900, height: 700 } })
  const page = await context.newPage()
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  expect(Number(await canvas.getAttribute('width'))).toBeGreaterThanOrEqual(box.width * 2 - 1)
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .4)
  await page.mouse.wheel(0, -320)
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-scale'))).toBeGreaterThan(2)
  await context.close()
})

test('keeps a lower specimen card above the finding and ledger on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const scenario = freshDefaultScenario()
  const layout = createParticleLayout(simulateScenario(scenario), scenario.visualSeed)
  let id = 0
  let distance = Infinity
  for (let candidate = 0; candidate < layout.x.length; candidate += 1) {
    const next = (layout.x[candidate] - .5) ** 2 + (layout.y[candidate] - .65) ** 2
    if (next < distance) { id = candidate; distance = next }
  }
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  await page.mouse.click(box.x + layout.x[id] * box.width, box.y + layout.y[id] * box.height)
  const card = page.locator('.pinned-card')
  await expect(card).toHaveCount(1)
  await expect(card).toHaveAttribute('data-card-direction', 'above')
  await expect(page.locator('.future-card-link')).toHaveCount(1)
  const overlap = await page.evaluate(() => {
    const specimen = document.querySelector<HTMLElement>('.pinned-card')?.getBoundingClientRect()
    const protectedElements = [...document.querySelectorAll<HTMLElement>('.result-statement, .outcome-ledger')]
    return specimen ? protectedElements.some((element) => {
      const result = element.getBoundingClientRect()
      return specimen.left < result.right && specimen.right > result.left && specimen.top < result.bottom && specimen.bottom > result.top
    }) : true
  })
  expect(overlap).toBe(false)
})
