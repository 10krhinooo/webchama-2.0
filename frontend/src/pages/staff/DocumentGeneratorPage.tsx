import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getDocuments,
  generateCustomDocument,
  generateAgmStatement,
  sendDocumentEmail,
  type GeneratedDocument,
  type DeliveryStatus,
} from '../../api/documents'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Pagination from '../../components/ui/Pagination'
import { usePagination } from '../../hooks/usePagination'

const STEPS = ['Setup', 'Line Items', 'Details', 'Preview & Send']

type CustomDocumentType = 'CUSTOM_INVOICE' | 'CUSTOM_RECEIPT'

interface LineItemForm {
  description: string
  quantity: string
  unitPrice: string
}

const EMPTY_LINE_ITEM: LineItemForm = { description: '', quantity: '1', unitPrice: '' }

function statusVariant(status: DeliveryStatus | null) {
  if (status === 'SENT') return 'success' as const
  if (status === 'FAILED') return 'danger' as const
  return 'muted' as const
}

export default function DocumentGeneratorPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const [mode, setMode] = useState<'list' | 'wizard'>('list')
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const [step, setStep] = useState(0)
  const [documentType, setDocumentType] = useState<CustomDocumentType>('CUSTOM_INVOICE')
  const [memberId, setMemberId] = useState('')
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...EMPTY_LINE_ITEM }])
  const [billingPeriod, setBillingPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null)

  const currentYear = new Date().getFullYear()
  const [agmFrom, setAgmFrom] = useState(`${currentYear}-01-01`)
  const [agmTo, setAgmTo] = useState(`${currentYear}-12-31`)
  const [agmGenerating, setAgmGenerating] = useState(false)
  const [agmError, setAgmError] = useState<string | null>(null)
  const [agmResult, setAgmResult] = useState<GeneratedDocument | null>(null)

  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(documents)

  const refresh = () => {
    if (roleLoading || !canManage) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getDocuments(chamaId), getMembers(chamaId)])
      .then(([d, m]) => {
        setDocuments(d)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const openWizard = () => {
    setStep(0)
    setDocumentType('CUSTOM_INVOICE')
    setMemberId('')
    setLineItems([{ ...EMPTY_LINE_ITEM }])
    setBillingPeriod('')
    setNotes('')
    setWizardError(null)
    setGenerated(null)
    setMode('wizard')
  }

  const canProceedSetup = memberId !== ''
  const canProceedLineItems =
    lineItems.length > 0 &&
    lineItems.every(
      (item) => item.description.trim().length > 0 && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0,
    )

  const updateLineItem = (index: number, patch: Partial<LineItemForm>) => {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addLineItem = () => setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }])
  const removeLineItem = (index: number) => setLineItems((items) => items.filter((_, i) => i !== index))

  const lineItemTotal = (item: LineItemForm) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
  const grandTotal = lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0)

  const handleGenerate = async () => {
    setGenerating(true)
    setWizardError(null)
    try {
      const doc = await generateCustomDocument(chamaId, {
        documentType,
        memberId: Number(memberId),
        billingPeriod: billingPeriod || undefined,
        notes: notes || undefined,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      setGenerated(doc)
      setStep(3)
    } catch (err) {
      setWizardError(extractErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleNext = () => {
    if (step === 2) {
      handleGenerate()
      return
    }
    setStep((s) => s + 1)
  }

  const handleSendEmail = async () => {
    if (!generated) return
    setSendingEmail(true)
    try {
      const updated = await sendDocumentEmail(chamaId, generated.id)
      setGenerated(updated)
      setNotice({
        variant: updated.emailStatus === 'SENT' ? 'success' : 'error',
        message: updated.emailStatus === 'SENT' ? 'Document emailed.' : 'Could not email the document.',
      })
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setSendingEmail(false)
    }
  }

  const finishWizard = () => {
    setMode('list')
    refresh()
  }

  const handleGenerateAgmStatement = async () => {
    setAgmGenerating(true)
    setAgmError(null)
    try {
      const doc = await generateAgmStatement(chamaId, agmFrom, agmTo)
      setAgmResult(doc)
      refresh()
    } catch (err) {
      setAgmError(extractErrorMessage(err))
    } finally {
      setAgmGenerating(false)
    }
  }

  if (!roleLoading && !canManage) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-ink">Documents</h1>
        <div className="bg-paper-dim rounded-2xl p-8 text-center text-sm text-muted">
          Only treasurers and chairpersons can generate and send documents.
        </div>
      </div>
    )
  }

  if (mode === 'wizard') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-ink">New Document</h1>
          <Button variant="secondary" onClick={() => setMode('list')}>Cancel</Button>
        </div>

        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step ? 'bg-success text-white' : i === step ? 'bg-primary text-white' : 'bg-paper-dim text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${i === step ? 'font-semibold text-ink' : 'text-muted'}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-black/10" />}
            </li>
          ))}
        </ol>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          {wizardError && (
            <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{wizardError}</div>
          )}

          {step === 0 && (
            <div className="space-y-4 max-w-md">
              <FormField label="Document type" htmlFor="doc-type" required>
                <Select
                  id="doc-type"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as CustomDocumentType)}
                >
                  <option value="CUSTOM_INVOICE">Invoice</option>
                  <option value="CUSTOM_RECEIPT">Receipt</option>
                </Select>
              </FormField>
              <FormField label="Member" htmlFor="doc-member" required>
                <Select id="doc-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="" disabled>Select a member</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </Select>
              </FormField>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/80">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 w-24">Qty</th>
                    <th className="pb-2 w-32">Unit price</th>
                    <th className="pb-2 w-32 text-right">Amount</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td className="pr-2 py-1">
                        <Input
                          aria-label="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(i, { description: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <Input
                          aria-label="Quantity"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <Input
                          aria-label="Unit price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(i, { unitPrice: e.target.value })}
                        />
                      </td>
                      <td className="py-1 text-right font-mono text-muted">{lineItemTotal(item).toLocaleString()}</td>
                      <td className="py-1 text-right">
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLineItem(i)} className="text-danger text-xs hover:underline">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="ghost" onClick={addLineItem}>+ Add line item</Button>
              <div className="flex justify-end border-t border-black/10 pt-3">
                <p className="font-mono text-lg font-bold text-primary">Total {grandTotal.toLocaleString()}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 max-w-md">
              <FormField label="Billing period" htmlFor="doc-period" hint="Optional, e.g. July 2026">
                <Input id="doc-period" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} />
              </FormField>
              <FormField label="Notes" htmlFor="doc-notes" hint="Optional, e.g. due date, payment reference, terms">
                <Textarea id="doc-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
            </div>
          )}

          {step === 3 && generated && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{generated.documentNumber}</p>
                  <p className="font-mono text-2xl font-bold text-primary">KES {generated.totalAmount.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <LoadingButton onClick={handleSendEmail} loading={sendingEmail} loadingText="Sending…">
                    Send Email
                  </LoadingButton>
                  <Button variant="secondary" disabled title="WhatsApp delivery is not available yet">
                    WhatsApp (coming soon)
                  </Button>
                </div>
              </div>
              {generated.emailStatus && (
                <Badge label={`Email: ${generated.emailStatus}`} variant={statusVariant(generated.emailStatus)} />
              )}
              {generated.pdfBase64 && (
                <iframe
                  title="Document preview"
                  src={`data:application/pdf;base64,${generated.pdfBase64}`}
                  className="h-[500px] w-full rounded-xl border border-black/10"
                />
              )}
              <Button variant="secondary" onClick={finishWizard}>Done</Button>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            <LoadingButton
              onClick={handleNext}
              loading={generating}
              loadingText="Generating…"
              disabled={(step === 0 && !canProceedSetup) || (step === 1 && !canProceedLineItems)}
            >
              {step === 2 ? 'Generate' : 'Next'}
            </LoadingButton>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Documents</h1>
        <Button onClick={openWizard}>+ New Document</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">AGM / Auditor Export</h2>
          <p className="text-sm text-muted">
            One-click bank-ready annual financial statement: contributions, loans, payouts, penalties, and the
            opening/closing balance for a financial year or custom range.
          </p>
        </div>
        {agmError && (
          <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{agmError}</div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <FormField label="From" htmlFor="agm-from">
            <Input id="agm-from" type="date" value={agmFrom} onChange={(e) => setAgmFrom(e.target.value)} />
          </FormField>
          <FormField label="To" htmlFor="agm-to">
            <Input id="agm-to" type="date" value={agmTo} onChange={(e) => setAgmTo(e.target.value)} />
          </FormField>
          <LoadingButton onClick={handleGenerateAgmStatement} loading={agmGenerating} loadingText="Generating…">
            Generate AGM Statement
          </LoadingButton>
        </div>
        {agmResult && (
          <div className="space-y-3 border-t border-black/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted">{agmResult.documentNumber}</p>
                <p className="font-mono text-xl font-bold text-primary">
                  Closing balance: KES {agmResult.totalAmount.toLocaleString()}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setAgmResult(null)}>Dismiss</Button>
            </div>
            {agmResult.pdfBase64 && (
              <iframe
                title="AGM statement preview"
                src={`data:application/pdf;base64,${agmResult.pdfBase64}`}
                className="h-[500px] w-full rounded-xl border border-black/10"
              />
            )}
          </div>
        )}
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Number</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Total</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {documents.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-sm">No documents generated yet.</td></tr>
              )}
              {pageItems.map((doc) => (
                <tr key={doc.id} className="hover:bg-paper-dim/30">
                  <td className="px-4 py-3 font-mono text-ink">{doc.documentNumber}</td>
                  <td className="px-4 py-3 text-muted">{doc.documentType}</td>
                  <td className="px-4 py-3 font-medium text-ink">{doc.memberName}</td>
                  <td className="px-4 py-3 font-mono text-muted">{doc.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {doc.emailStatus ? (
                      <Badge label={doc.emailStatus} variant={statusVariant(doc.emailStatus)} />
                    ) : (
                      <span className="text-muted text-xs">Not sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="documents" />
      )}
    </div>
  )
}
