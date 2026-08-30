import { KEYCLOAK_URL } from './env'
import { realmUserId } from './realm'

export type RoleName = 'chairperson' | 'treasurer' | 'secretary' | 'member' | 'superadmin'

export interface Role {
  name: RoleName
  username: string
  password: string
  /** Pinned in keycloak/realm-chama.json, so the fixture can reference the user directly. */
  keycloakUserId: string
  storageState: string
}

/**
 * The demo realm gives each seed user a password derived from their own username: the username
 * capitalised, then "!". Deriving it here rather than restating it keeps this file describing the
 * convention instead of carrying a second copy of credentials that already live in
 * keycloak/realm-chama.json.
 */
const seedPassword = (username: string) =>
  `${username.charAt(0).toUpperCase()}${username.slice(1)}!`

/**
 * The platform admin is the one account that does not follow the convention: its password is
 * substituted into the realm import at container start from CHAMA_SUPERADMIN_PASSWORD, which
 * docker-compose.e2e.yml sets. Override here if the stack was started with a different value.
 */
const superadminPassword = () => process.env.E2E_SUPERADMIN_PASSWORD ?? seedPassword('superadmin1')

export const ROLES: Record<RoleName, Role> = {
  chairperson: {
    name: 'chairperson',
    username: 'chairperson1',
    password: seedPassword('chairperson1'),
    keycloakUserId: realmUserId('chairperson1'),
    storageState: '.auth/chairperson.json',
  },
  treasurer: {
    name: 'treasurer',
    username: 'treasurer1',
    password: seedPassword('treasurer1'),
    keycloakUserId: realmUserId('treasurer1'),
    storageState: '.auth/treasurer.json',
  },
  secretary: {
    name: 'secretary',
    username: 'secretary1',
    password: seedPassword('secretary1'),
    keycloakUserId: realmUserId('secretary1'),
    storageState: '.auth/secretary.json',
  },
  member: {
    name: 'member',
    username: 'member1',
    password: seedPassword('member1'),
    keycloakUserId: realmUserId('member1'),
    storageState: '.auth/member.json',
  },
  superadmin: {
    name: 'superadmin',
    username: 'admin',
    password: superadminPassword(),
    // The admin user is created by the realm import without a pinned id, and holds no chama
    // membership by design, so nothing in the fixture needs to reference it.
    keycloakUserId: '',
    storageState: '.auth/superadmin.json',
  },
}

export const OIDC_AUTH_PATH = `${KEYCLOAK_URL}/realms/chama/protocol/openid-connect/auth`
