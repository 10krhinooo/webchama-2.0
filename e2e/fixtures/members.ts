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

  // Chama 3, owned by the members spec, which invites, suspends and exits people here.
  { id: 8,  chamaId: 3, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 180, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 9,  chamaId: 3, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 175, roles: ['TREASURER', 'MEMBER'] },
  { id: 10, chamaId: 3, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 170, roles: ['MEMBER'] },

  // Chama 4, owned by the loan specs.
  //
  // Carol holds TREASURER here and SECRETARY in chama 1, which is the point: a chama role comes
  // from member_role for the chama in the path and never from the token, so the same person is
  // legitimately different things in different chamas. It also gives this chama the three distinct
  // signatories a dual sign-off needs, since the maker may not sign and only a chairperson or a
  // treasurer may.
  { id: 11, chamaId: 4, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 260, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 12, chamaId: 4, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 255, roles: ['TREASURER', 'MEMBER'] },
  { id: 13, chamaId: 4, keycloakUserId: SECRETARY,   fullName: 'Carol Secretary',   phone: '+254700000003', nationalId: null, nextOfKin: 'Next Of Kin C', joinedDaysAgo: 250, roles: ['TREASURER', 'MEMBER'] },
  { id: 14, chamaId: 4, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 245, roles: ['MEMBER'] },

  // Chama 5, owned by the penalties spec.
  { id: 15, chamaId: 5, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 200, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 16, chamaId: 5, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 195, roles: ['TREASURER', 'MEMBER'] },
  { id: 17, chamaId: 5, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 190, roles: ['MEMBER'] },

  // Chama 7, owned by the payouts spec. Three members, because a rotation with one person in it
  // does not demonstrate an order.
  { id: 18, chamaId: 7, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 300, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 19, chamaId: 7, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 290, roles: ['TREASURER', 'MEMBER'] },
  { id: 20, chamaId: 7, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 280, roles: ['MEMBER'] },

  // Chama 8, owned by the welfare spec.
  { id: 21, chamaId: 8, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 150, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 22, chamaId: 8, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 145, roles: ['TREASURER', 'MEMBER'] },
  { id: 23, chamaId: 8, keycloakUserId: SECRETARY,   fullName: 'Carol Secretary',   phone: '+254700000003', nationalId: null, nextOfKin: 'Next Of Kin C', joinedDaysAgo: 140, roles: ['TREASURER', 'MEMBER'] },
  { id: 24, chamaId: 8, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 135, roles: ['MEMBER'] },

  // Chama 9, owned by the meetings spec. Carol is its secretary, which is who schedules meetings
  // and records attendance.
  { id: 25, chamaId: 9, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 330, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 26, chamaId: 9, keycloakUserId: SECRETARY,   fullName: 'Carol Secretary',   phone: '+254700000003', nationalId: null, nextOfKin: 'Next Of Kin C', joinedDaysAgo: 325, roles: ['SECRETARY', 'MEMBER'] },
  { id: 27, chamaId: 9, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 320, roles: ['MEMBER'] },

  // Chama 11, owned by the documents spec.
  { id: 28, chamaId: 11, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 390, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 29, chamaId: 11, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 385, roles: ['TREASURER', 'MEMBER'] },
  { id: 30, chamaId: 11, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 380, roles: ['MEMBER'] },

  // Chama 12, owned by the dual sign-off spec, which used to share chama 4 with the loan lifecycle
  // spec. Two files mutating one chama is exactly what the one-chama-per-file rule exists to
  // prevent, and it only showed up once there were enough spec files to schedule them together.
  //
  // Carol holds TREASURER here as well, giving the three distinct signatories a dual sign-off
  // needs: only a chairperson or treasurer may sign, and the maker may not sign their own request.
  { id: 31, chamaId: 12, keycloakUserId: CHAIRPERSON, fullName: 'Amina Chairperson', phone: '+254700000001', nationalId: null, nextOfKin: 'Next Of Kin A', joinedDaysAgo: 420, roles: ['CHAIRPERSON', 'MEMBER'] },
  { id: 32, chamaId: 12, keycloakUserId: TREASURER,   fullName: 'Brian Treasurer',   phone: '+254700000002', nationalId: null, nextOfKin: 'Next Of Kin B', joinedDaysAgo: 415, roles: ['TREASURER', 'MEMBER'] },
  { id: 33, chamaId: 12, keycloakUserId: SECRETARY,   fullName: 'Carol Secretary',   phone: '+254700000003', nationalId: null, nextOfKin: 'Next Of Kin C', joinedDaysAgo: 410, roles: ['TREASURER', 'MEMBER'] },
  { id: 34, chamaId: 12, keycloakUserId: MEMBER,      fullName: 'Daniel Member',     phone: '+254700000004', nationalId: null, nextOfKin: 'Next Of Kin D', joinedDaysAgo: 405, roles: ['MEMBER'] },
]
