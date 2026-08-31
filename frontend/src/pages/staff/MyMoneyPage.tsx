import { useEffect, useState } from 'react'
import {
  getDocumentWithPdf,
  getMyDocuments,
  type GeneratedDocument,
} from '../../api/documents'
import LoadingButton from '../../components/ui/LoadingButton'
import { downloadBase64Pdf } from '../../utils/download'

const DOCUMENT_TYPE_LABELS: Record<GeneratedDocument['documentType'], string> = {
  CONTRIBUTION_RECEIPT: 'Contribution receipt',
  LOAN_STATEMENT: 'Loan statement',
  PAYOUT_RECEIPT: 'Payout receipt',
  CUSTOM_INVOICE: 'Invoice',
  CUSTOM_RECEIPT: 'Receipt',
  AGM_STATEMENT: 'Annual statement',
}
import { Link, useParams } from 'react-router-dom'
import { getMySummary, CREDIT_SCORE_BAND_LABELS, type MemberSummary } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import Card from '../../components/ui/Card'
import FormError from '../../components/ui/FormError'
import Badge from '../../components/ui/Badge'
import { SkeletonLine } from '../../components/ui/Skeleton'
import Reveal from '../../components/ui/Reveal'

function money(currency: string, amount: string | null) {
  if (amount === null) return '—'
  return `${currency} ${Number(amount).toLocaleString()}`
}

function date(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A member's own money in one place.
 *
 * <p>Everything here was already reachable across the contributions, loans, penalties, payouts and
 * welfare pages. What a member did not have was one answer to "where do I stand", without visiting
 * five pages and adding things up themselves.
 *
 * <p>Laid out single column and read first on a phone, because that is what a member uses. The
 * management pages are wide tables; this one is not.
 */
export default function MyMoneyPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)

  const [summary, setSummary] = useState<MemberSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [documentError, setDocumentError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMySummary(chamaId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chamaId])

  // Its own request, with its own swallowing catch. The documents are supplementary: a member who
  // cannot load them should still see what they owe.
  useEffect(() => {
    let cancelled = false
    getMyDocuments(chamaId)
      .then((data) => {
        if (!cancelled) setDocuments(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [chamaId])

  const handleDownload = async (doc: GeneratedDocument) => {
    setDownloadingId(doc.id)
    setDocumentError(null)
    try {
      // The list omits the bytes on purpose, so they are fetched only for the one being saved.
      const full = await getDocumentWithPdf(chamaId, doc.id)
      if (!full.pdfBase64) throw new Error('That document has no file attached.')
      downloadBase64Pdf(`${full.documentNumber}.pdf`, full.pdfBase64)
    } catch (err) {
      setDocumentError(extractErrorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) {
    return (
      <div data-testid="my-money-loading" className="space-y-4">
        <SkeletonLine className="h-8 w-48" />
        <SkeletonLine className="h-32 w-full" />
        <SkeletonLine className="h-32 w-full" />
      </div>
    )
  }

  if (error || !summary) {
    return <FormError message={error ?? 'Could not load your summary.'} />
  }

  const owing = Number(summary.contributionsOutstanding) + Number(summary.outstandingPenaltyTotal)

  return (
    <div data-testid="page-my-money" className="mx-auto max-w-2xl space-y-4">
      <Reveal eager>
        <h1 className="font-heading text-2xl font-bold text-ink">My money</h1>
        <p className="text-sm text-muted">{summary.fullName}</p>
      </Reveal>

      {/* The one number a member actually opens this page for. */}
      <Card className="space-y-1">
        <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
          {owing > 0 ? 'You owe' : 'You are up to date'}
        </p>
        <p className="font-display text-4xl font-bold text-ink">
          {summary.currency} {owing.toLocaleString()}
        </p>
        {summary.overdueContributionCount > 0 && (
          <p className="text-sm text-danger">
            {summary.overdueContributionCount} overdue{' '}
            {summary.overdueContributionCount === 1 ? 'contribution' : 'contributions'}
          </p>
        )}
        {summary.onTimeStreak > 0 && (
          <p className="text-sm text-success">🔥 {summary.onTimeStreak} on-time streak</p>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Contributions</h2>
          <Link to={`/chamas/${chamaId}/contributions`} className="text-xs text-brand hover:underline">
            View all
          </Link>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="Paid so far" value={money(summary.currency, summary.contributedTotal)} />
          <Row label="Still owed" value={money(summary.currency, summary.contributionsOutstanding)} />
          <Row
            label="Next due"
            value={
              summary.nextContributionDue
                ? `${money(summary.currency, summary.nextContributionAmount)} on ${date(summary.nextContributionDue)}`
                : 'Nothing outstanding'
            }
          />
        </dl>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Loans</h2>
          <Link to={`/chamas/${chamaId}/loans`} className="text-xs text-brand hover:underline">
            View all
          </Link>
        </div>
        {summary.activeLoanCount === 0 ? (
          <p className="text-sm text-muted">No loans running.</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Loans running" value={String(summary.activeLoanCount)} />
            <Row label="Still to repay" value={money(summary.currency, summary.loanOutstanding)} />
            <Row
              label="Next repayment"
              value={
                summary.nextRepaymentDue
                  ? `${money(summary.currency, summary.nextRepaymentAmount)} on ${date(summary.nextRepaymentDue)}`
                  : 'Nothing scheduled'
              }
            />
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Payouts and penalties</h2>
          <Link to={`/chamas/${chamaId}/payouts`} className="text-xs text-brand hover:underline">
            View payouts
          </Link>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="Payouts received" value={String(summary.payoutsReceived)} />
          <Row
            label="Your next turn"
            value={
              summary.nextPayoutDate
                ? `Round ${summary.nextPayoutRound} on ${date(summary.nextPayoutDate)}`
                : 'Not scheduled yet'
            }
          />
          <div className="flex items-center justify-between">
            <dt className="text-muted">Penalties owed</dt>
            <dd>
              {summary.outstandingPenaltyCount === 0 ? (
                <span className="font-mono text-muted">None</span>
              ) : (
                <Badge
                  variant="danger"
                  label={money(summary.currency, summary.outstandingPenaltyTotal)}
                  description={`across ${summary.outstandingPenaltyCount} ${summary.outstandingPenaltyCount === 1 ? 'penalty' : 'penalties'}`}
                />
              )}
            </dd>
          </div>
          <Row label="Welfare fund contributed" value={money(summary.currency, summary.welfareContributed)} />
        </dl>
      </Card>

      {/*
        The member's own standing, shown to them rather than only to the treasurer reviewing a loan
        request. A thin record says so instead of presenting a number as settled.
      */}
      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-ink">Your documents</h2>
        {documentError && <FormError message={documentError} />}
        {documents.length === 0 ? (
          <p className="text-sm text-muted">
            Receipts and statements you ask for appear here. You can get one from any contribution,
            loan or payout of your own.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-ink">{doc.documentNumber}</p>
                  <p className="text-xs text-muted">
                    {DOCUMENT_TYPE_LABELS[doc.documentType]} &middot;{' '}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <LoadingButton
                  variant="secondary"
                  loading={downloadingId === doc.id}
                  loadingText="Preparing…"
                  onClick={() => handleDownload(doc)}
                >
                  Download
                </LoadingButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-ink">Your standing</h2>
        {summary.creditScore === null ? (
          <p className="text-sm text-muted">
            Not enough history yet to score. Contributing on time and repaying loans builds it.
          </p>
        ) : (
          <div className="flex items-baseline gap-3">
            <p className="font-display text-3xl font-bold text-ink">{summary.creditScore}</p>
            <p className="text-sm text-muted">{CREDIT_SCORE_BAND_LABELS[summary.creditScoreBand]}</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-ink">{value}</dd>
    </div>
  )
}
