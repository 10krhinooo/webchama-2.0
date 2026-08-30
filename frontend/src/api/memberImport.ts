import { client } from './client'

export type MemberImportOutcome = 'READY' | 'CREATED' | 'SKIPPED' | 'FAILED'

export interface MemberImportRowResult {
  /** The line in the uploaded file, header included, so it matches the person's spreadsheet. */
  lineNumber: number
  email: string
  fullName: string
  outcome: MemberImportOutcome
  problems: string[]
  /** Set only on a committed row that provisioned a new account. */
  temporaryPassword: string | null
}

export interface MemberImportResult {
  dryRun: boolean
  totalRows: number
  created: number
  ready: number
  skipped: number
  failed: number
  /** A problem with the file itself. When this is non-empty, no row was even judged. */
  structuralErrors: string[]
  rows: MemberImportRowResult[]
}

export const MEMBER_IMPORT_TEMPLATE =
  'email,fullName,phone,nationalId,nextOfKin,roles\n' +
  'jane@example.com,Jane Doe,254700000001,12345678,"Doe, John",MEMBER\n'

/**
 * Uploads the file. A dry run creates nothing and reports what would happen, which is what the
 * preview uses; the same call without it commits.
 *
 * <p>The response is a 200 even when every row was rejected, so callers must read the outcomes
 * rather than relying on the status.
 */
export async function importMembers(
  chamaId: number,
  csv: string,
  dryRun: boolean,
): Promise<MemberImportResult> {
  const { data } = await client.post<MemberImportResult>(
    `/chamas/${chamaId}/members/import`,
    csv,
    { params: { dryRun }, headers: { 'Content-Type': 'text/csv' } },
  )
  return data
}
