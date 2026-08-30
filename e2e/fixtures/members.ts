/**
 * Fixture members, stated in plaintext.
 *
 * `phone` and `nationalId` are encrypted by `db.ts` as the rows are inserted, because those
 * columns are stored as ciphertext and their unique indexes are on the ciphertext. Keeping the
 * plaintext here means the fixture says what it means, and changing the encryption key needs no
 * regeneration.
 *
 * `admin` deliberately holds no membership anywhere. SUPER_ADMIN is a realm role with no tenant
 * bypass, and the isolation spec proves it.
 */
import { realmUserId } from '../support/realm'

export interface FixtureMember {
  id: number
  chamaId: number
  keycloakUserId: string
  fullName: string
  phone: string
  nationalId: string | null
  nextOfKin: string
  joinedDaysAgo: number
  roles: Array<'CHAIRPERSON' | 'TREASURER' | 'SECRETARY' | 'MEMBER'>
}

// Looked up from keycloak/realm-chama.json rather than copied, so there is one place that says
// which Keycloak user each seed member is.
const CHAIRPERSON = realmUserId('chairperson1')
const TREASURER = realmUserId('treasurer1')
const SECRETARY = realmUserId('secretary1')
const MEMBER = realmUserId('member1')

export const FIXTURE_MEMBERS: FixtureMember[] = [
  // Chama 1, fully populated and read only. Other specs assert against it, so nothing may mutate
  // it.
  { id: 1, chamaId: 1, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: '12345678', nextOfKin: 'Next Of Kin A', joinedDaysAgo: 540, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 2, chamaId: 1, keycloakUserId: TREASURER, fullName: 'Brian Treasurer', phone: '+254700000002', nationalId: '23456789', nextOfKin: 'Next Of Kin B', joinedDaysAgo: 520, roles: ['TREASURER', 'MEMBER'] },
  { id: 3, chamaId: 1, keycloakUserId: SECRETARY, fullName: 'Carol Secretary', phone: '+254700000003', nationalId: '34567890', nextOfKin: 'Next Of Kin C', joinedDaysAgo: 500, roles: ['SECRETARY', 'MEMBER'] },
  { id: 4, chamaId: 1, keycloakUserId: MEMBER, fullName: 'Daniel Member', phone: '+254700000004', nationalId: '45678901', nextOfKin: 'Next Of Kin D', joinedDaysAgo: 480, roles: ['MEMBER'] },

  // Chama 6, owned by the contribution payment specs, so paying never mutates chama 1.
  // National ids are null here: the uniqueness index on them is per chama and partial, and these
  // people already hold their real one in chama 1.
  { id: 5, chamaId: 6, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 240, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 6, chamaId: 6, keycloakUserId: TREASURER, fullName: 'Brian Treasurer', phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 240, roles: ['TREASURER', 'MEMBER'] },
  { id: 7, chamaId: 6, keycloakUserId: MEMBER, fullName: 'Daniel Member', phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 240, roles: ['MEMBER'] },
]
