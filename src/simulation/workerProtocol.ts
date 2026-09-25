import type { Scenario, SimulationResult } from './scenarioTypes'

export interface RunRequest { type: 'RUN'; requestId: number; scenario: Scenario }
export interface ResultResponse { type: 'RESULT'; requestId: number; result: SimulationResult }
export interface ErrorResponse { type: 'ERROR'; requestId: number; message: string }
export type WorkerRequest = RunRequest
export type WorkerResponse = ResultResponse | ErrorResponse

export function isStaleResponse(responseRequestId: number, latestRequestId: number): boolean {
  return responseRequestId < latestRequestId
}
