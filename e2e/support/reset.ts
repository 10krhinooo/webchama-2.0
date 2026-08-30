/** Reapplies the fixture by hand, for recovering from an aborted local run. */
import { closePool, resetAndSeed } from './db'

await resetAndSeed()
await closePool()
console.log('e2e fixture reapplied')
