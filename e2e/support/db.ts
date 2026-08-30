import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { DATABASE } from './env'
import { encryptPii } from './crypto'
import { FIXTURE_MEMBERS } from '../fixtures/members'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'fixtures')

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool(DATABASE)
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/**
 * Empties every table and reapplies the fixture.
 *
 * Applied out of band rather than through Flyway on purpose. quarkus.flyway.locations is fixed at
 * build time, so a profile-specific seed would not be picked up by the image the suite actually
 * runs; a seed migration would ship fixture data to production; and a reset endpoint would put a
 * truncate-the-database route in the production jar.
 */
export async function resetAndSeed(): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query(await readFile(join(fixtures, 'schema-reset.sql'), 'utf8'))
    await client.query(await readFile(join(fixtures, 'seed-chamas.sql'), 'utf8'))
    await insertMembers(client)
    await client.query(await readFile(join(fixtures, 'seed-contributions.sql'), 'utf8'))
  } finally {
    client.release()
  }
}

/**
 * Members are written from TypeScript rather than SQL because phone and national_id are encrypted
 * on the way in. Keeping the plaintext in fixtures/members.ts and encrypting here means the
 * fixture is readable and a key change needs no regeneration.
 */
async function insertMembers(client: pg.PoolClient): Promise<void> {
  for (const member of FIXTURE_MEMBERS) {
    await client.query(
      `INSERT INTO member (id, chama_id, keycloak_user_id, full_name, phone, national_id,
                           next_of_kin, join_date, status, auto_pay_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - $8::int, 'ACTIVE', false)`,
      [
        member.id,
        member.chamaId,
        member.keycloakUserId,
        member.fullName,
        encryptPii(member.phone),
        member.nationalId === null ? null : encryptPii(member.nationalId),
        member.nextOfKin,
        member.joinedDaysAgo,
      ],
    )

    for (const role of member.roles) {
      await client.query('INSERT INTO member_role (member_id, role) VALUES ($1, $2)', [
        member.id,
        role,
      ])
    }
  }

  // Leaves room above the fixture ids so anything a spec creates cannot collide with them.
  await client.query("SELECT setval('member_id_seq', 1000, false)")
  await client.query("SELECT setval('member_role_id_seq', 1000, false)")
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params)
  return result.rows
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return (await query<T>(sql, params))[0]
}

/**
 * Ids the fixture pins, so specs can navigate directly instead of discovering them.
 * Chamas 1 and 2 are read only; everything from 3 up belongs to exactly one spec file.
 */
export const FIXTURE = {
  chama: {
    umoja: 1,
    kilele: 2,
    tumaini: 3,
    nuru: 4,
    baraka: 5,
    imani: 6,
    pamoja: 7,
    salama: 8,
    faraja: 9,
    neema: 10,
    mwanzo: 11,
  },
  member: {
    chairperson: 1,
    treasurer: 2,
    secretary: 3,
    member: 4,
  },
} as const
