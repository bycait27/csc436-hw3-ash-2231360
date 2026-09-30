import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CsvUploader } from './components/CsvUploader'
import './app.css'

export function App() {
  return (
    <>
      <header className="app-header">
        <h1>Evidence before action</h1>
        <p>Campus service review / synthetic coursework data</p>
      </header>
      <main className="app-main">
        <CsvUploader
          onDatasetLoaded={({ rows }) => ({
            // Record-level validation will replace this parse-only count.
            acceptedCount: rows.length,
            rejectedCount: 0,
          })}
        />
      </main>
    </>
  )
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Could not find the app root element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
