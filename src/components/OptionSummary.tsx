import { useEffect, useRef, useState } from 'react'
import type { Scenario, SimulationResult } from '../simulation/scenarioTypes'
import { formatOutcome } from '../utils/format'
import { resultCounts } from '../utils/resultCounts'

export function OptionSummary({ index, scenario, result, instant = false }: { index: 0 | 1; scenario: Scenario; result: SimulationResult; instant?: boolean }) {
  const stats = result.summary.options[index]
  const target = resultCounts(result)[index]
  const previous = useRef(0)
  const [displayed, setDisplayed] = useState(instant ? target : 0)

  useEffect(() => {
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previous.current = target
      setDisplayed(target)
      return
    }
    const start = previous.current
    const duration = start === 0 ? 1_850 : 720
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplayed(Math.round(start + (target - start) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else previous.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [instant, target])

  return <p className="option-ledger-line" data-option={index === 0 ? 'a' : 'b'} data-count={displayed} aria-label={`${scenario.options[index].name} simulation tally`}>
    <span>{scenario.options[index].name.toLocaleLowerCase()}:</span>{' '}
    <strong>{displayed.toLocaleString('en-US')}</strong> of {result.winners.length.toLocaleString('en-US')} futures end ahead, median {formatOutcome(stats.median, scenario)}
  </p>
}
