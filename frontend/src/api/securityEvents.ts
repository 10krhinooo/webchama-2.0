import { client } from './client'

export type SecurityEventSource = 'LOGIN' | 'ADMIN'

export interface SecurityEvent {
  id: number
  source: SecurityEventSource
  eventTime: string
  type: string
  keycloakUserId: string | null
  ipAddress: string | null
  clientId: string | null
  error: string | null
  resourceType: string | null
  resourcePath: string | null
}

export interface SecurityEventFilters {
  type?: string
  error?: string
  keycloakUserId?: string
  limit?: number
}

export async function getSecurityEvents(filters: SecurityEventFilters = {}): Promise<SecurityEvent[]> {
  const { data } = await client.get<SecurityEvent[]>('/admin/security-events', { params: filters })
  return data
}
