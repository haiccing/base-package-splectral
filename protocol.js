// base-package-splectral's protocol: splectral, Splectral's server started,
// stopped and asked for its state. Linked into an mrepo, its config is
// loaded by the runtime and its actions run.
// The work is splectral-server's; here the mounting.
import { start, stop, status } from './modules/pear-full-square/splectral-server/index.js'

// The splectral protocol's config, the package's: each action at the mrepo itself (`.`),
// the Splectral mrepo whose server it is about.
const here = (description, rest = {}) => ({ uris: ['.'], ...rest, description })

export const protocols = {
  splectral: {
    package: 'haiccing/base-package-splectral',
    description: 'Splectral\'s server: the commands of the install shown in a browser as they complete.',
    actions: {
      start: here('The server started: the page served, the root mrepo\'s outbox folder followed; its argument the port, 4400 when none (another when that one is taken).', { args: ['port?'] }),
      stop: here('The server ended.'),
      status: here('Whether the server runs, where it is served and what it follows.')
    }
  }
}

export const actions = {
  splectral: { start, stop, status }
}
