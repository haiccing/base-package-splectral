// splectral-server: its documented methods, a directory each (README.md beside each).
//   external/   the splectral protocol's actions: start, stop, status, install
//   internal/   serve: the server, in this process; records: a completed
//               record summed up, a folder of them followed; structure:
//               the install folded from its records; page: the page it
//               serves; process: the server as its own process;
//               components: the components, the exchange with each;
//               typed: a data answer as AVRO, the cascade;
// cli.js is the server's command line: the program an mrepo starts.
export { start } from './external/start/index.js'
export { stop } from './external/stop/index.js'
export { status } from './external/status/index.js'
export { install } from './external/install/index.js'
export { serve, mreposOf, PORT, HOST, ROOT, RESERVED } from './internal/serve/index.js'
export { createComponents, ask, typedBox, SIDE, COMPONENTS, TOPIC } from './internal/components/index.js'
export { encodeAnswer, decodeAnswer, DATA, RECORD, JSON_TYPE } from './internal/typed/index.js'
export { createStructure } from './internal/structure/index.js'
export { summaryOf, follow, followStream } from './internal/records/index.js'
export { PAGE } from './internal/page/index.js'
export { site, SHOWN } from './internal/site/index.js'
export { program, launch, end, stateOf, STATE } from './internal/process/index.js'
