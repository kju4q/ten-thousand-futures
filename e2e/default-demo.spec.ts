import { expect, test } from '@playwright/test'
import { DISCLAIMER } from '../src/components/DisclaimerFooter'
import { createParticleLayout } from '../src/future-field/particleLayout'
import { freshDefaultScenario } from '../src/scenarios/defaultScenario'
import { stableUniform } from '../src/simulation/deterministicRandom'
import { simulateScenario } from '../src/simulation/simulationEngine'
import { resultCounts } from '../src/utils/resultCounts'

test.beforeEach(async ({ page }) => {
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
})

test('loads, runs the demo, crosses the majority, and resets', async ({ page }) => {
  await expect(page.getByText('10,000 futures', { exact: true })).toBeVisible()
  await expect(page.getByText('DECISION SIMULATOR')).toHaveCount(0)
  await expect(page.getByText('ACTIVE MODEL')).toHaveCount(0)
  await expect(page.getByText('DECISION QUESTION')).toHaveCount(0)
  await expect(page.getByText('EVEN', { exact: true })).toHaveCount(0)
  await expect(page.getByText(DISCLAIMER)).toBeVisible()
  await expect(page.locator('.result-statement').getByText(/simulated futures, stable role ends ahead/)).toBeVisible()
  await expect(page.locator('.result-statement').getByText('give or take about 100 futures')).toBeVisible()
  await expect(page.locator('.run-log')).toHaveText(/run no\. 1 · seed 42 · [\d.]+ ms/)
  const defaultResult = simulateScenario(freshDefaultScenario())
  const counts = resultCounts(defaultResult)
  await expect(page.locator('.option-ledger-line').first()).toContainText(`${counts[0].toLocaleString('en-US')} of 10,000 futures end ahead`)
  await expect(page.locator('.measurement-axis span')).toHaveCount(3)
  await page.getByRole('button', { name: /Startup succeeds:/ }).click()
  const exactChipInput = page.getByLabel('Startup succeeds, exact value')
  await exactChipInput.fill('0.65')
  await exactChipInput.press('Enter')
  await expect(page.locator('.result-statement').getByText(/simulated futures, startup bet ends ahead/)).toBeVisible()
  await expect(page.locator('.run-log')).toHaveText(/run no\. 2 · seed 42 · [\d.]+ ms/)
  await expect(page.locator('.result-statement')).toHaveClass(/finding-pulse/)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Reset scenario' }).click()
  await expect(page.locator('.result-statement').getByText(/simulated futures, stable role ends ahead/)).toBeVisible()
})

test('uses the finished browser title and matching favicon', async ({ page }) => {
  await expect(page).toHaveTitle('10,000 Futures')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
})

test('ignites the dormant sky and settles into the result', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('.base-particles')
  const runButton = page.getByRole('button', { name: /run 10,000 futures/i })
  await expect(canvas).toHaveAttribute('data-motion', 'dormant')
  await expect(canvas).toHaveAttribute('data-idle-alpha', '.26')
  await expect(page.getByText('a monte carlo simulation. put in a real decision, run 10,000 possible futures, and see the shape of each path.')).toBeVisible()
  await expect(page.getByText('press once, wait two seconds.')).toBeVisible()
  await expect(page.locator('.field-edge')).toHaveCount(0)
  await expect(page.getByText(DISCLAIMER)).toHaveCount(0)
  await expect(runButton).toHaveCSS('border-top-width', '0px')
  await expect(runButton).toHaveCSS('background-color', 'rgba(207, 224, 229, 0.035)')
  await expect(runButton).toHaveCSS('border-radius', '12px')
  await runButton.click()
  await expect(canvas).toHaveAttribute('data-motion', 'igniting')
  await expect(canvas).toHaveAttribute('data-settled', 'false')
  await expect(canvas).toHaveAttribute('data-motion', 'settled', { timeout: 3000 })
  await expect(canvas).toHaveAttribute('data-settled', 'true')
  await expect(page.locator('.field-edge')).toHaveCount(2)
  await expect(page.locator('.field-edge-a')).toContainText('Stable Role (A)')
  await expect(page.locator('.field-edge-b')).toContainText('Startup Bet (B)')
})

test('uses presentation as a clean filming mode with expandable assumptions', async ({ page }) => {
  await page.getByRole('button', { name: 'Present' }).click()
  await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)
  await expect(page.getByText(DISCLAIMER)).toHaveCount(0)
  await expect(page.locator('.assumption-chip')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Startup succeeds:/ })).toBeVisible()
  await page.getByRole('button', { name: 'show all' }).click()
  await expect(page.locator('.assumption-chip')).toHaveCount(6)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Present' })).toBeVisible()
})

test('supports keyboard presentation and deterministic replay', async ({ page }) => {
  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible()
  await page.keyboard.press('r')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
})

test('accepts a valid import and rejects an invalid import', async ({ page }) => {
  const imported = freshDefaultScenario()
  imported.title = 'Imported Decision'
  await page.locator('input[type="file"]').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
  await expect(page.getByText('Scenario imported successfully.')).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') })
  await expect(page.getByRole('alert')).toBeVisible()
})

test('keeps invalid numeric drafts and supports keyboard sliders', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click()
  const field = page.getByLabel('Startup succeeds, Chance')
  await field.fill('-')
  await expect(field).toHaveValue('-')
  await expect(page.getByText('Enter a complete finite number.')).toBeVisible()
  const slider = page.getByLabel('Startup succeeds slider')
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toBeFocused()
})

test('scrubs a floating chip by keyboard and horizontal drag', async ({ page }) => {
  const chip = page.getByRole('button', { name: /Startup succeeds:/ })
  await chip.focus()
  await page.keyboard.press('ArrowRight')
  await expect(chip).toHaveAccessibleName(/36%/)
  const box = await chip.boundingBox()
  if (!box) throw new Error('Success chip is not visible.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(chip).not.toHaveAccessibleName(/36%/)
})

test('zooms around the cursor and resets the camera on double click', async ({ page }) => {
  const canvas = page.locator('.base-particles')
  await expect(canvas).toHaveAttribute('data-camera-zoom', '1.000')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.42)
  await page.mouse.wheel(0, -360)
  await expect(canvas).not.toHaveAttribute('data-camera-zoom', '1.000')
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-scale'))).toBeGreaterThan(1)
  await page.mouse.dblclick(box.x + box.width * 0.72, box.y + box.height * 0.42)
  await expect(canvas).toHaveAttribute('data-camera-zoom', '1.000')
})

test('reveals honest future stories and compares up to three pinned lights', async ({ page }) => {
  const scenario = freshDefaultScenario()
  const layout = createParticleLayout(simulateScenario(scenario), scenario.visualSeed)
  const canvas = page.locator('.base-particles')
  await expect(canvas).toHaveAttribute('data-particle-count', '10000')
  await expect(canvas).toHaveAttribute('data-hit-test', 'spatial-grid')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  const nearestId = (targetX: number, targetY: number) => {
    let nearest = 0
    let distance = Infinity
    for (let id = 0; id < layout.x.length; id += 1) {
      const next = (layout.x[id] - targetX) ** 2 + (layout.y[id] - targetY) ** 2
      if (next < distance) { nearest = id; distance = next }
    }
    return nearest
  }
  const ids = [nearestId(.2, .2), nearestId(.8, .2), nearestId(.5, .9), nearestId(.5, .5)]
  const point = (id: number) => ({ x: box.x + layout.x[id] * box.width, y: box.y + layout.y[id] * box.height })
  await page.mouse.move(point(ids[0]).x, point(ids[0]).y)
  await expect(page.locator('.hover-card')).toContainText('in this simulated run')
  await expect(page.locator('.hover-card')).toContainText(/future no\./)
  await expect(page.locator('.particle-marker.hovered')).toBeVisible()
  await expect(page.locator('.future-field')).toHaveAttribute('data-cluster-active', 'true')
  await expect.poll(async () => Number(await page.locator('.future-field').getAttribute('data-cluster-neighbors'))).toBeGreaterThan(0)
  await expect.poll(async () => page.locator('.idle-fireflies').evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBeGreaterThan(1.05)
  await expect(page.locator('.base-particles')).toHaveCSS('opacity', '0.52')
  await page.mouse.move(5, 5)
  await expect(page.locator('.future-field')).toHaveAttribute('data-cluster-active', 'false')
  await expect.poll(async () => page.locator('.idle-fireflies').evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBeLessThan(1.01)
  for (const id of ids.slice(0, 3)) await page.mouse.click(point(id).x, point(id).y)
  await expect(page.locator('.pinned-card')).toHaveCount(3)
  await expect(page.locator('.future-card-link')).toHaveCount(3)
  await expect(page.locator('.particle-marker.pinned')).toHaveCount(3)
  const resultOverlap = await page.evaluate(() => {
    const protectedElements = [...document.querySelectorAll<HTMLElement>('.result-statement, .outcome-ledger')]
    return [...document.querySelectorAll<HTMLElement>('.future-card')].some((card) => protectedElements.some((element) => {
      const a = card.getBoundingClientRect()
      const b = element.getBoundingClientRect()
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    }))
  })
  expect(resultOverlap).toBe(false)
  await page.mouse.click(point(ids[3]).x, point(ids[3]).y)
  await expect(page.locator('.pinned-card')).toHaveCount(3)
  const firstPinned = page.locator('.pinned-card').first()
  await firstPinned.focus()
  await expect(firstPinned).toBeFocused()
  await expect(firstPinned).toHaveAccessibleName(/in this simulated run/)
  await page.mouse.click(5, 5)
  await expect(page.locator('.pinned-card')).toHaveCount(0)
})

test('keeps a pinned stable future visible across a rerun with a trail', async ({ page }) => {
  await page.goto('/?autoplay=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const scenario = freshDefaultScenario()
  const result = simulateScenario(scenario)
  const layout = createParticleLayout(result, scenario.visualSeed)
  const changingId = Array.from(result.futureIds).find((id) => {
    const quantile = stableUniform(scenario.seed, 'success-b-v1', id, 0)
    return quantile >= .35 && quantile < .65
  })
  if (changingId === undefined) throw new Error('No stable future changes across the success threshold.')
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  await page.mouse.click(box.x + layout.x[changingId] * box.width, box.y + layout.y[changingId] * box.height)
  await expect(page.locator('.pinned-card')).toHaveCount(1)
  await page.getByRole('button', { name: /Startup succeeds:/ }).click()
  const exactChipInput = page.getByLabel('Startup succeeds, exact value')
  await exactChipInput.fill('0.65')
  await exactChipInput.press('Enter')
  await expect(page.locator('.result-statement').getByText(/simulated futures, startup bet ends ahead/)).toBeVisible()
  await expect(page.locator('.future-trail')).toBeVisible()
  await expect(page.locator('.pinned-card')).toHaveCount(1)
})

test('excludes hover stories from deterministic capture mode', async ({ page }) => {
  await page.goto('/?testMode=1&capture=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  const canvas = page.locator('.base-particles')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Future Field is not visible.')
  const x = Number(await canvas.getAttribute('data-probe-x'))
  const y = Number(await canvas.getAttribute('data-probe-y'))
  await page.mouse.move(box.x + x * box.width, box.y + y * box.height)
  await expect(page.locator('.hover-card')).toHaveCount(0)
})
