import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { client } from './client'
import {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeetingMinutes,
  getMeetingAttendance,
  recordAttendance,
  type Meeting,
  type MeetingAttendance,
} from './meetings'

const meeting = { id: 1, agenda: 'Monthly review' } as Meeting
const attendance = { id: 9, memberId: 4, status: 'PRESENT' } as MeetingAttendance

beforeEach(() => {
  vi.clearAllMocks()
})

describe('meetings api', () => {
  it('lists meetings', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [meeting] })
    await expect(getMeetings(9)).resolves.toEqual([meeting])
    expect(client.get).toHaveBeenCalledWith('/chamas/9/meetings')
  })

  it('fetches one meeting', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: meeting })
    await expect(getMeeting(9, 1)).resolves.toEqual(meeting)
    expect(client.get).toHaveBeenCalledWith('/chamas/9/meetings/1')
  })

  it('schedules a meeting', async () => {
    ;(client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: meeting })
    const body = { meetingDate: '2026-09-01', agenda: 'Monthly review' }
    await expect(createMeeting(9, body)).resolves.toEqual(meeting)
    expect(client.post).toHaveBeenCalledWith('/chamas/9/meetings', body)
  })

  it('records minutes', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: meeting })
    await expect(updateMeetingMinutes(9, 1, 'Agreed the budget')).resolves.toEqual(meeting)
    expect(client.put).toHaveBeenCalledWith('/chamas/9/meetings/1/minutes', {
      minutes: 'Agreed the budget',
    })
  })

  it('fetches attendance for a meeting', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [attendance] })
    await expect(getMeetingAttendance(9, 1)).resolves.toEqual([attendance])
    expect(client.get).toHaveBeenCalledWith('/chamas/9/meetings/1/attendance')
  })

  it('records one member attendance against the meeting and member', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: attendance })
    await expect(recordAttendance(9, 1, 4, 'EXCUSED')).resolves.toEqual(attendance)
    expect(client.put).toHaveBeenCalledWith('/chamas/9/meetings/1/attendance/4', {
      status: 'EXCUSED',
    })
  })
})
