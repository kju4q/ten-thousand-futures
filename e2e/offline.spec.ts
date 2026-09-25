import { expect, test } from '@playwright/test'
import { DISCLAIMER } from '../src/components/DisclaimerFooter'

test('works with external network blocked', async ({ page }) => {
  const external: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.href); await route.abort() }
    else await route.continue()
  })
  await page.goto('/?testMode=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await page.keyboard.press('p')
  await expect(page.getByText(DISCLAIMER)).toHaveCount(0)
  expect(external).toEqual([])
})

test('recovers from corrupted local storage', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('ten-thousand-futures:scenario:v1', '{broken'))
  await page.reload()
  await expect(page.getByText('Saved scenario could not be restored. The demo has been loaded.')).toBeVisible()
  await expect(page.getByText(DISCLAIMER)).toHaveCount(0)
})
