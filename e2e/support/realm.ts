import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Reads the seed users out of the realm import.
 *
 * The realm file is the source of truth for who exists and what their Keycloak id is, so those
 * ids are looked up here rather than copied. A duplicated id is a second thing to keep in step,
 * and a stale one fails as a member row that matches nobody, which is a confusing way to discover
 * a typo.
 */
const here = dirname(fileURLToPath(import.meta.url))
const REALM_PATH = join(here, '..', '..', 'keycloak', 'realm-chama.json')

interface RealmUser {
  username: string
  id?: string
  email?: string
}

const realm = JSON.parse(readFileSync(REALM_PATH, 'utf8')) as { users?: RealmUser[] }
const users = new Map((realm.users ?? []).map((user) => [user.username, user]))

/**
 * The Keycloak id for a seed user.
 *
 * Throws rather than returning empty, because a member row carrying an empty keycloak_user_id
 * silently matches no one, and every spec acting as that role then fails at its first assertion
 * with nothing pointing back here.
 */
export function realmUserId(username: string): string {
  const id = users.get(username)?.id
  if (!id) {
    throw new Error(
      `No pinned id for "${username}" in keycloak/realm-chama.json. ` +
        'Seed users that a fixture references must declare an "id".',
    )
  }
  return id
}

export function realmUserEmail(username: string): string | undefined {
  return users.get(username)?.email
}
