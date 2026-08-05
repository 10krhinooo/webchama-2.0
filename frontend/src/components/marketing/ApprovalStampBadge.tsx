export type ApprovalStampStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

const STAMP_CONFIG: Record<ApprovalStampStatus, { label: string; rotate: string; solid: boolean; colorClass: string }> = {
  PENDING: { label: 'Pending', rotate: '-3deg', solid: false, colorClass: 'border-warning text-warning' },
  APPROVED: { label: 'Approved', rotate: '-2deg', solid: true, colorClass: 'border-success text-success' },
  REJECTED: { label: 'Rejected', rotate: '2deg', solid: true, colorClass: 'border-danger text-danger' },
}

/** Small ink-stamp styled status badge, echoing the homepage's dual-signature stamp motif inside the actual approvals table. */
export default function ApprovalStampBadge({ status }: { status: ApprovalStampStatus }) {
  const config = STAMP_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center rounded border-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${config.colorClass} ${config.solid ? 'border-solid' : 'border-dashed'}`}
      style={{ transform: `rotate(${config.rotate})` }}
    >
      {config.label}
    </span>
  )
}
