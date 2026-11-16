// Splectral's server, as a program: what an mrepo's splectral/start starts.
//   bare cli.js --dir=<mrepo's folder> --outbox=<folder> [--root=<unique URI>] [--port=<n>] [--runtime=<pid>]
// Its arguments and what it does: internal/process (README.md there).
import process from 'bare-process'
import { program } from './internal/process/index.js'

await program(process.argv.slice(2))
process.exit(0) // closed: ended here (its signal handlers would hold the process open)
