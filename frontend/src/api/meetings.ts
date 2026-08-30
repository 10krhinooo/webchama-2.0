import { client } from './client'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED'

export interface Meeting {
  id: number
  chamaId: number
  meetingDate: string
  agenda: string
  minutes: string | null
  createdAt: string
}

export interface MeetingAttendance {
  id: number
  meetingId: number
  memberId: number
  memberName: string
  status: AttendanceStatus
}

export interface CreateMeetingRequest {
  meetingDate: string
  agenda: string
}

export async function getMeetings(chamaId: number): Promise<Meeting[]> {
  const { data } = await client.get<Meeting[]>(`/chamas/${chamaId}/meetings`)
  return data
}

export async function getMeeting(chamaId: number, id: number): Promise<Meeting> {
  const { data } = await client.get<Meeting>(`/chamas/${chamaId}/meetings/${id}`)
  return data
}

/** Secretary or chairperson. Scheduling also notifies the members. */
export async function createMeeting(
  chamaId: number,
  body: CreateMeetingRequest,
): Promise<Meeting> {
  const { data } = await client.post<Meeting>(`/chamas/${chamaId}/meetings`, body)
  return data
}

/** Minutes are plain text; rich text was deliberately deferred. */
export async function updateMeetingMinutes(
  chamaId: number,
  id: number,
  minutes: string,
): Promise<Meeting> {
  const { data } = await client.put<Meeting>(`/chamas/${chamaId}/meetings/${id}/minutes`, { minutes })
  return data
}

export async function getMeetingAttendance(
  chamaId: number,
  id: number,
): Promise<MeetingAttendance[]> {
  const { data } = await client.get<MeetingAttendance[]>(`/chamas/${chamaId}/meetings/${id}/attendance`)
  return data
}

/**
 * Records one member's attendance. Attendance feeds the member credit score, where EXCUSED counts
 * neither for nor against, so marking someone excused is materially different from absent.
 */
export async function recordAttendance(
  chamaId: number,
  meetingId: number,
  memberId: number,
  status: AttendanceStatus,
): Promise<MeetingAttendance> {
  const { data } = await client.put<MeetingAttendance>(
    `/chamas/${chamaId}/meetings/${meetingId}/attendance/${memberId}`,
    { status },
  )
  return data
}
