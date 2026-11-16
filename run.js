// Splectral's server, this process, for one Splectral mrepo: the page
// served and a folder of completed records followed, until it is ended
// (SIGTERM, SIGINT), its mrepo's folder is gone or its mrepo's runtime
// has ended. Started by the mrepo's splectral/start, from its own
// packages/.
//   bare <repo dir>/packages/haiccing/base-package-splectral.bundle
//       --dir=<repo dir> --outbox=<folder> [--port=<n>] [--runtime=<pid>]
import process from './modules/node_modules/bare-process/index.js'
import { program } from './modules/pear-full-square/splectral-server/index.js'

await program(process.argv.slice(2))
process.exit(0) // closed: ended here (its signal handlers would hold the process open)
