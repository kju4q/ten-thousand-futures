import { useEffect, useRef, useState } from 'react'
import type { Scenario, SimulationResult } from '../simulation/scenarioTypes'
import { resultCopy } from '../utils/resultCopy'
import { resultCounts, samplingErrorFutures } from '../utils/resultCounts'

export function ResultStatement({ scenario, result }: { scenario: Scenario; result: SimulationResult }) {
  const copy = resultCopy(scenario, result)
  const counts = resultCounts(result)
  const uncertainty = samplingErrorFutures(result)
  const majority = counts[0] > 5_000 ? 0 : counts[1] > 5_000 ? 1 : 2
  const previousMajority = useRef<number | null>(null)
  const [flipToken, setFlipToken] = useState(0)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (previousMajority.current !== null && previousMajority.current !== majority) {
      setFlipToken((token) => token + 1)
      setFlipping(true)
      const timeout = window.setTimeout(() => setFlipping(false), 850)
      previousMajority.current = majority
      return () => clearTimeout(timeout)
    }
    previousMajority.current = majority
  }, [majority])

  return <div className={`result-statement ${flipping ? 'finding-pulse' : ''}`}>
    <p key={flipToken}>{copy.primary}</p>
    <span>{copy.secondary}</span>
    <span className="uncertainty-whisper">give or take about {uncertainty.toLocaleString('en-US')} futures</span>
  </div>
}
