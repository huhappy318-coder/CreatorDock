import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { platformPresets } from './catalog'
import './styles.css'

const verifiedCount = platformPresets.filter((preset) => preset.verification === 'verified').length

export function App() {
  return (
    <main className="shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="CreatorDock home"><span>CD</span> CreatorDock</a>
        <p>YOUR CREATOR WORKBENCH</p>
        <button type="button">Add destination</button>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">ONE QUIET PLACE</p>
        <h1>Begin where<br />your work lives.</h1>
        <p className="lede">A focused launchpad for the places you write, publish, and keep the momentum moving.</p>
      </section>

      <section className="catalog" aria-labelledby="catalog-heading">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">STARTING POINTS</p>
            <h2 id="catalog-heading">Platform catalog</h2>
          </div>
          <p>{platformPresets.length} destinations · {verifiedCount} verified</p>
        </div>
        <div className="platform-grid">
          {platformPresets.map((preset, index) => (
            <a className="platform-card" href={preset.url} key={preset.id} target="_blank" rel="noreferrer">
              <span className="card-number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{preset.name}</strong>
              <span>{preset.category}</span>
              <span className={`status ${preset.verification}`}>{preset.verification}</span>
              {preset.verificationNote && <span className="verification-note">{preset.verificationNote}</span>}
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode><App /></StrictMode>,
  )
}
