import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({ client: { post: vi.fn() } }))

import { client } from './client'
import { importMembers, MEMBER_IMPORT_TEMPLATE } from './memberImport'

const mockPost = client.post as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('member import api', () => {
  it('posts the file as text/csv with the dry run flag', async () => {
    mockPost.mockResolvedValue({ data: { dryRun: true, created: 0, ready: 1, rows: [] } })
    await importMembers(3, 'email,fullName,phone\n', true)

    expect(mockPost).toHaveBeenCalledWith(
      '/chamas/3/members/import',
      'email,fullName,phone\n',
      { params: { dryRun: true }, headers: { 'Content-Type': 'text/csv' } },
    )
  })

  it('commits when the dry run flag is false', async () => {
    mockPost.mockResolvedValue({ data: { dryRun: false, created: 2, rows: [] } })
    const result = await importMembers(3, 'csv', false)

    expect(mockPost.mock.calls[0][2]).toMatchObject({ params: { dryRun: false } })
    expect(result.created).toBe(2)
  })

  it('offers a template naming every column the parser accepts', () => {
    // A chairperson guessing at column names is the likeliest way an import fails on the first try.
    for (const column of ['email', 'fullName', 'phone', 'nationalId', 'nextOfKin', 'roles']) {
      expect(MEMBER_IMPORT_TEMPLATE).toContain(column)
    }
  })
})
