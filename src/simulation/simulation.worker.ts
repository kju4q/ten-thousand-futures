/// <reference lib="webworker" />
import { simulateScenario } from './simulationEngine'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, scenario } = event.data
  try {
    const result = simulateScenario(scenario)
    const response: WorkerResponse = { type: 'RESULT', requestId, result }
    self.postMessage(response, { transfer: [result.outcomesA.buffer, result.outcomesB.buffer, result.margins.buffer, result.winners.buffer, result.futureIds.buffer] })
  } catch (error) {
    const response: WorkerResponse = { type: 'ERROR', requestId, message: error instanceof Error ? error.message : 'Simulation failed.' }
    self.postMessage(response)
  }
}
