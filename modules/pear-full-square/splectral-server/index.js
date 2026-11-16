// splectral-server: its documented methods, a directory each (README.md beside each).
//   external/   the splectral protocol's actions: start, stop, status
//   internal/   serve: the server, in this process; records: a completed
//               record summed up, a folder of them followed; page: the
//               page it serves; process: the server as its own process;
//               config.js: the protocol's config
// cli.js is the server's command line: the program an mrepo starts.
export { start } from './external/start/index.js'
export { stop } from './external/stop/index.js'
export { status } from './external/status/index.js'
export { serve, PORT, HOST } from './internal/serve/index.js'
export { summaryOf, follow } from './internal/records/index.js'
export { PAGE } from './internal/page/index.js'
export { program, launch, end, stateOf, STATE } from './internal/process/index.js'
export { CONFIG } from './internal/config.js'
