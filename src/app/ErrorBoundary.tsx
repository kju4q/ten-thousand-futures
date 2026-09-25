import { Component, type ErrorInfo, type ReactNode } from 'react'
import { DisclaimerFooter } from '../components/DisclaimerFooter'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="fatal"><div><span>SIMULATION INTERRUPTED</span><h1>The model hit an unexpected error.</h1><p>Your saved valid scenario remains on this device.</p><button onClick={() => location.reload()}>Reload application</button><button onClick={() => { localStorage.clear(); location.reload() }}>Reset Demo</button></div><DisclaimerFooter /></main>
  }
}
