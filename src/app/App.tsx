import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DisclaimerFooter } from '../components/DisclaimerFooter'
import { OptionSummary } from '../components/OptionSummary'
import { ResultStatement } from '../components/ResultStatement'
import { FutureField } from '../future-field/FutureField'
import { freshDefaultScenario } from '../scenarios/defaultScenario'
import type { Scenario, ScenarioVariable, SimulationResult } from '../simulation/scenarioTypes'
import { isStaleResponse, type WorkerResponse } from '../simulation/workerProtocol'
import { exportScenario, importScenario } from '../state/importExport'
import { loadScenario, saveScenario } from '../state/persistence'
import { formatOutcome, formatPercent } from '../utils/format'
import { resultCopy } from '../utils/resultCopy'

type ParameterKey = 'value' | 'mean' | 'standardDeviation' | 'low' | 'high' | 'mode' | 'probability'

function parameterLabels(variable: ScenarioVariable): Array<[ParameterKey, string]> {
  if (variable.type === 'fixed') return [['value', 'Exact']]
  if (variable.type === 'normal') return [['mean', 'Around'], ['standardDeviation', 'Usually varies by']]
  if (variable.type === 'uniform') return [['low', 'Between'], ['high', 'and']]
  if (variable.type === 'triangular') return [['low', 'Between'], ['high', 'and'], ['mode', 'Most likely']]
  return [['probability', 'Chance']]
}

function primaryParameter(variable: ScenarioVariable): ParameterKey {
  if (variable.type === 'normal') return 'mean'
  if (variable.type === 'triangular') return 'mode'
  if (variable.type === 'uniform') return 'low'
  if (variable.type === 'bernoulli') return 'probability'
  return 'value'
}

function parameterBounds(variable: ScenarioVariable, key: ParameterKey, value: number) {
  if (key === 'probability') return { minimum: 0, maximum: 1 }
  if (key === 'standardDeviation') return { minimum: 0, maximum: variable.maximum ?? Math.max(1, value * 3) }
  return { minimum: variable.minimum ?? 0, maximum: variable.maximum ?? Math.max(100, value * 2) }
}

function displayValue(value: number, variable: ScenarioVariable, scenario: Scenario, compact = false) {
  if (variable.display.unit === 'percent') return formatPercent(value)
  if (variable.display.unit === 'currency') return formatOutcome(value, scenario, compact)
  return `${value} ${value === 1 ? 'year' : 'years'}`
}

function chipLabel(variable: ScenarioVariable, scenario: Scenario) {
  if (variable.key === 'years') return 'Time'
  const short = variable.key === 'startup_succeeds' ? 'success chance' : variable.label.replace('Annual ', '').toLocaleLowerCase()
  const option = variable.display.group === 'a' ? scenario.options[0].name : scenario.options[1].name
  return `${option} / ${short}`
}

function AssumptionChip({ variable, scenario, onChange }: { variable: ScenarioVariable; scenario: Scenario; onChange: (variableId: string, key: ParameterKey, value: number, immediate?: boolean) => void }) {
  const key = primaryParameter(variable)
  const value = variable[key] ?? 0
  const { minimum, maximum } = parameterBounds(variable, key, value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [active, setActive] = useState(false)
  const startRef = useRef({ x: 0, value })
  const latestRef = useRef(value)
  const draggedRef = useRef(false)
  const step = variable.display.step

  function clamp(next: number) {
    const bounded = Math.max(minimum, Math.min(maximum, next))
    const precision = step < 1 ? 100 : 1
    return Math.round(bounded * precision / step) * step / precision
  }

  function commitExact() {
    const next = Number(draft)
    if (Number.isFinite(next)) onChange(variable.id, key, clamp(next), true)
    setEditing(false)
  }

  function nudge(direction: number, immediate = false) {
    const next = clamp(value + direction * step)
    latestRef.current = next
    onChange(variable.id, key, next, immediate)
  }

  const qualifier = variable.type === 'normal' ? '~' : variable.type === 'triangular' ? 'most likely ' : ''
  const visibleValue = `${qualifier}${displayValue(value, variable, scenario)}`

  const star = variable.display.prominent ? 'scrub-star' : ''

  if (editing) return <span className={`assumption-chip chip-${variable.display.group} ${star} editing`} onClick={(event) => event.stopPropagation()}>
    <span>{chipLabel(variable, scenario)}</span>
    <input autoFocus inputMode="decimal" value={draft} aria-label={`${variable.label}, exact value`} onChange={(event) => setDraft(event.target.value)} onBlur={commitExact} onKeyDown={(event) => {
      if (event.key === 'Enter') commitExact()
      if (event.key === 'Escape') setEditing(false)
    }} />
  </span>

  return <button
    className={`assumption-chip chip-${variable.display.group} ${star} ${active ? 'active' : ''}`}
    aria-label={`${variable.label}: ${visibleValue}. Drag horizontally, use the mouse wheel, or press arrow keys to adjust. Click for exact entry.`}
    title="Drag, scroll, or use arrow keys to adjust. Click for exact entry."
    onClick={(event) => { event.stopPropagation(); if (!draggedRef.current) { setDraft(String(value)); setEditing(true) } }}
    onPointerDown={(event) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      startRef.current = { x: event.clientX, value }
      latestRef.current = value
      draggedRef.current = false
      setActive(true)
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      const distance = event.clientX - startRef.current.x
      if (Math.abs(distance) > 3) draggedRef.current = true
      if (!draggedRef.current) return
      const next = clamp(startRef.current.value + Math.round(distance / 5) * step)
      if (next !== latestRef.current) { latestRef.current = next; onChange(variable.id, key, next) }
    }}
    onPointerUp={(event) => {
      event.stopPropagation()
      setActive(false)
      if (draggedRef.current) onChange(variable.id, key, latestRef.current, true)
    }}
    onPointerCancel={() => setActive(false)}
    onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setActive(true); nudge(event.deltaY > 0 ? -1 : 1); window.setTimeout(() => setActive(false), 220) }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); nudge(1, true) }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); nudge(-1, true) }
    }}
  >
    <span>{chipLabel(variable, scenario)}</span><strong>{visibleValue}</strong><i aria-hidden="true" />
  </button>
}

function ClassicControl({ variable, scenario, onChange, recent }: { variable: ScenarioVariable; scenario: Scenario; onChange: (variableId: string, key: ParameterKey, value: number, immediate?: boolean) => void; recent: boolean }) {
  const parameters = parameterLabels(variable)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(parameters.map(([key]) => [key, String(variable[key] ?? 0)])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const parameterSignature = parameters.map(([key]) => `${key}:${variable[key] ?? 0}`).join('|')
  useEffect(() => {
    setDrafts(Object.fromEntries(parameters.map(([key]) => [key, String(variable[key] ?? 0)])))
    setErrors({})
    // The primitive signature tracks every editable numeric parameter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameterSignature])

  function changeDraft(key: ParameterKey, raw: string, immediate = false) {
    setDrafts((current) => ({ ...current, [key]: raw }))
    if (raw.trim() === '' || raw.trim() === '-' || raw.endsWith('.') || !Number.isFinite(Number(raw))) {
      setErrors((current) => ({ ...current, [key]: 'Enter a complete finite number.' }))
      return
    }
    const value = Number(raw)
    const bounds = parameterBounds(variable, key, value)
    if (value < bounds.minimum || value > bounds.maximum) {
      setErrors((current) => ({ ...current, [key]: `Enter a value from ${bounds.minimum} to ${bounds.maximum}.` }))
      return
    }
    setErrors((current) => ({ ...current, [key]: '' }))
    onChange(variable.id, key, value, immediate)
  }

  return <fieldset className={`classic-control ${recent ? 'recent' : ''}`}>
    <legend>{variable.label}</legend>
    {parameters.map(([key, label], index) => {
      const value = variable[key] ?? 0
      const { minimum, maximum } = parameterBounds(variable, key, value)
      return <div className="classic-parameter" key={key}>
        <label htmlFor={`${variable.id}-${key}`}>{label}</label>
        <input id={`${variable.id}-${key}`} inputMode="decimal" value={drafts[key] ?? String(value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${variable.id}-${key}-error` : undefined} onChange={(event) => changeDraft(key, event.target.value)} aria-label={`${variable.label}, ${label}`} />
        <output>{displayValue(value, variable, scenario)}</output>
        {errors[key] && <small id={`${variable.id}-${key}-error`} className="field-error">{errors[key]}</small>}
        {index === 0 && <input className="slider" type="range" min={minimum} max={maximum} step={variable.display.step} value={value} onChange={(event) => changeDraft(key, event.target.value)} onPointerUp={(event) => changeDraft(key, event.currentTarget.value, true)} aria-label={`${variable.label} slider`} />}
      </div>
    })}
  </fieldset>
}

function ControlsDrawer({ open, onClose, scenario, onChange, recentVariable, onReset, onImport, onExport }: { open: boolean; onClose: () => void; scenario: Scenario; onChange: (variableId: string, key: ParameterKey, value: number, immediate?: boolean) => void; recentVariable: string | null; onReset: () => void; onImport: () => void; onExport: () => void }) {
  if (!open) return null
  const groups = [['Shared assumptions', 'shared'], [scenario.options[0].name, 'a'], [scenario.options[1].name, 'b']] as const
  return <aside className="classic-drawer" aria-label="Instrument menu">
    <header><div><span>MODEL CONTROLS &amp; RECORDS</span><h2>Instrument menu</h2></div><button onClick={onClose}>Close</button></header>
    <div className="drawer-actions" aria-label="Scenario actions">
      <button onClick={onReset}>Reset scenario</button>
      <button onClick={onImport}>Import record</button>
      <button onClick={onExport}>Export record</button>
    </div>
    <p>Exact inputs remain available here for keyboard, screen reader, and detailed model editing.</p>
    {groups.map(([label, group]) => <section key={group}><h3>{label}</h3>{scenario.variables.filter((variable) => variable.display.group === group).map((variable) => <ClassicControl key={variable.id} variable={variable} scenario={scenario} recent={recentVariable === variable.id} onChange={onChange} />)}</section>)}
    <details className="advanced"><summary>Advanced model</summary><dl><div><dt>Runs</dt><dd>10,000 fixed</dd></div><div><dt>Simulation seed</dt><dd>{scenario.seed}</dd></div><div><dt>Visual seed</dt><dd>{scenario.visualSeed}</dd></div></dl><pre>{JSON.stringify({ formulas: scenario.options.map((option) => option.formula), distributions: scenario.variables.map(({ key, type }) => ({ key, type })) }, null, 2)}</pre></details>
  </aside>
}

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), [])
  const restored = useMemo(() => loadScenario(), [])
  const [scenario, setScenario] = useState<Scenario>(() => restored.scenario ?? freshDefaultScenario())
  const scenarioRef = useRef(scenario)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [runNumber, setRunNumber] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(restored.notice ?? null)
  const [recentVariable, setRecentVariable] = useState<string | null>(null)
  const [present, setPresent] = useState(params.get('present') === '1')
  const vertical = params.get('aspect') === 'vertical'
  const [revealKey, setRevealKey] = useState(0)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [presentAssumptionsExpanded, setPresentAssumptionsExpanded] = useState(false)
  const initialScenarioRef = useRef(scenario)
  const shouldAutoplay = params.get('autoplay') === '1' || params.get('testMode') === '1'
  const captureMode = params.get('capture') === '1'
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  const latestRequestedRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const hasResultRef = useRef(false)

  const run = useCallback((nextScenario = scenarioRef.current, replay = false) => {
    if (!workerRef.current) return
    const requestId = ++requestRef.current
    latestRequestedRef.current = requestId
    setRunning(true)
    setError(null)
    if (replay) setRevealKey((key) => key + 1)
    workerRef.current.postMessage({ type: 'RUN', requestId, scenario: nextScenario })
  }, [])

  useEffect(() => {
    let active = true
    const worker = new Worker(new URL('../simulation/simulation.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (isStaleResponse(event.data.requestId, latestRequestedRef.current)) return
      setRunning(false)
      if (event.data.type === 'ERROR') return setError(event.data.message)
      hasResultRef.current = true
      setResult(event.data.result)
      setRunNumber((count) => count + 1)
    }
    worker.onerror = () => { setRunning(false); setError('The simulation worker stopped unexpectedly. Reset the demo to recover.') }
    if (shouldAutoplay) document.fonts.ready.then(() => {
      if (!active) return
      const requestId = ++requestRef.current
      latestRequestedRef.current = requestId
      setRunning(true)
      worker.postMessage({ type: 'RUN', requestId, scenario: initialScenarioRef.current })
    })
    return () => { active = false; worker.terminate() }
  }, [shouldAutoplay])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (controlsOpen) setControlsOpen(false); else if (present) setPresent(false) }
      if (event.key.toLowerCase() === 'p' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) setPresent((value) => !value)
      if (event.key.toLowerCase() === 'r' && result && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) run(scenarioRef.current, true)
    }
    addEventListener('keydown', keyboard)
    return () => removeEventListener('keydown', keyboard)
  }, [controlsOpen, present, result, run])

  useEffect(() => {
    if (present) setPresentAssumptionsExpanded(false)
  }, [present])

  function scenarioChanged(next: Scenario, variableId: string, immediate = false) {
    scenarioRef.current = next
    setScenario(next)
    setRecentVariable(variableId)
    saveScenario(next)
    if (!hasResultRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (immediate) run(next)
    else debounceRef.current = window.setTimeout(() => run(next), 145)
  }

  function changeVariable(variableId: string, key: ParameterKey, value: number, immediate = false) {
    const next = structuredClone(scenarioRef.current)
    const variable = next.variables.find((item) => item.id === variableId)
    if (!variable || !Number.isFinite(value)) return
    variable[key] = value
    scenarioChanged(next, variableId, immediate)
  }

  function reset() {
    const fresh = freshDefaultScenario()
    scenarioRef.current = fresh
    setScenario(fresh)
    saveScenario(fresh)
    setNotice('Demo restored to its original assumptions and seeds.')
    setRecentVariable(null)
    if (hasResultRef.current) run(fresh, true)
    else setResult(null)
  }

  async function handleImport(file: File) {
    try {
      const imported = await importScenario(file)
      scenarioRef.current = imported
      setScenario(imported)
      saveScenario(imported)
      setNotice('Scenario imported successfully.')
      if (hasResultRef.current) run(imported, true)
    } catch (importError) { setError(importError instanceof Error ? importError.message : 'Scenario import failed.') }
  }

  const copy = result ? resultCopy(scenario, result) : null
  const chips = scenario.variables.filter((variable) => variable.id !== 'years-v1' || !vertical)
  const visibleChips = present && !presentAssumptionsExpanded ? chips.filter((variable) => variable.display.prominent) : chips

  return <main className={`galaxy-app ${result ? 'has-result' : 'is-dormant'} ${running ? 'is-running' : ''} ${present ? 'presentation' : ''} ${vertical ? 'vertical' : ''} ${controlsOpen ? 'controls-open' : ''} ${captureMode ? 'capture-mode' : ''} ${params.get('testMode') === '1' ? 'test-mode' : ''}`}>
    <FutureField scenario={scenario} result={result} revealKey={revealKey} onRun={() => run()} running={running} instant={params.get('testMode') === '1'} captureMode={captureMode} />

    <header className="hud-top">
      <div className="brand"><strong>10,000 futures</strong></div>
      {!present && <nav aria-label="Scenario actions">
        <button className="controls-toggle" aria-expanded={controlsOpen} onClick={() => setControlsOpen((value) => !value)}>Menu</button>
        <button className="present-button" onClick={() => setPresent(true)}>Present</button>
      </nav>}
      {present && <button className="exit-present" onClick={() => setPresent(false)}>Exit presentation</button>}
    </header>

    <div className="question">
      <h1>{scenario.question}</h1>
      <p>a monte carlo simulation. put in a real decision, run 10,000 possible futures, and see the shape of each path.</p>
    </div>

    <aside className={`assumption-ledger ${present ? 'present-assumptions' : ''} ${present && !presentAssumptionsExpanded ? 'is-compact' : ''}`} aria-label="Direct manipulation assumptions">
      <header>
        <span>assumptions</span>
        {present ? <button aria-expanded={presentAssumptionsExpanded} onClick={() => setPresentAssumptionsExpanded((value) => !value)}>{presentAssumptionsExpanded ? 'show success only' : 'show all'}</button> : <small>drag a value to test it</small>}
      </header>
      <div>{visibleChips.map((variable) => <AssumptionChip key={variable.id} variable={variable} scenario={scenario} onChange={changeVariable} />)}</div>
    </aside>
    {result && !present && <div className="run-log">run no. {runNumber} · seed {scenario.seed} · {result.summary.durationMs.toFixed(1)} ms</div>}

    {running && result && <div className="sr-only" role="status">Recalculating futures</div>}
    {result ? <>
      <ResultStatement scenario={scenario} result={result} />
      <div className="outcome-ledger" aria-label="Simulation counts"><OptionSummary index={0} scenario={scenario} result={result} instant={params.get('testMode') === '1'} /><OptionSummary index={1} scenario={scenario} result={result} instant={params.get('testMode') === '1'} /></div>
      <div className="sr-only" aria-live="polite">{copy?.primary}</div>
      <div className="engine-stat sr-only" aria-hidden="true">10,000 paired futures · {result.summary.durationMs.toFixed(1)} ms</div>
    </> : null}

    {(notice || error) && <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error ?? notice}<button aria-label="Dismiss notice" onClick={() => { setError(null); setNotice(null) }}>Close</button></div>}
    <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file) }} />
    <ControlsDrawer open={controlsOpen && !present} onClose={() => setControlsOpen(false)} scenario={scenario} onChange={changeVariable} recentVariable={recentVariable} onReset={reset} onImport={() => importRef.current?.click()} onExport={() => exportScenario(scenario)} />
    {result && !present && <DisclaimerFooter />}
  </main>
}
