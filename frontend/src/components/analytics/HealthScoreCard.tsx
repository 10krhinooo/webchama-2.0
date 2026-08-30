import { HEALTH_BAND_LABELS, type ChamaHealth } from '../../api/analytics'
import Card from '../ui/Card'

function bandTone(band: ChamaHealth['band']) {
  if (band === 'THRIVING' || band === 'GOOD') return 'text-success'
  if (band === 'FAIR') return 'text-warning'
  if (band === 'AT_RISK') return 'text-danger'
  return 'text-muted'
}

/**
 * The chama's health score and the components behind it.
 *
 * <p>A chama with nothing recorded shows the band and an explanation rather than a number: the
 * backend returns a null score in that case precisely so the UI cannot present an unearned one.
 */
export default function HealthScoreCard({ health }: { health: ChamaHealth }) {
  const band = HEALTH_BAND_LABELS[health.band]

  return (
    <Card data-testid="health-score-card" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Chama health</h2>
        <span className={`text-sm font-semibold ${bandTone(health.band)}`}>{band}</span>
      </div>

      {health.score === null ? (
        <p className="text-sm text-muted">
          Not enough recorded yet to score this chama. Contributions, loan repayments and meeting
          attendance all feed the score once they exist.
        </p>
      ) : (
        <>
          <p className="font-display text-5xl font-bold text-ink">{health.score}</p>
          <ul className="space-y-2">
            {health.components.map((component) => (
              <li key={component.code}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink/80">{component.label}</span>
                  <span className="font-mono text-muted">
                    {Math.round(component.rate * 100)}%
                    <span className="ml-2 text-xs text-subtle">
                      {Math.round(component.weight * 100)}% of score
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(component.rate * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-subtle">
            Only what this chama records is scored. Anything it does not track is left out rather
            than counted as a pass.
          </p>
        </>
      )}
    </Card>
  )
}
