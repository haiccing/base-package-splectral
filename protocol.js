// base-package-splectral's protocol: splectral, Splectral's server started,
// stopped and asked for its state. Linked into an mrepo, its config is
// loaded by the runtime and its actions run.
// The work is splectral-server's; here the mounting.
import { start, stop, status, install } from './modules/pear-full-square/splectral-server/index.js'

// The splectral protocol's config, the package's: each action at the mrepo itself (`.`),
// the Splectral mrepo whose server it is about.
const here = (description, rest = {}) => ({ uris: ['.'], ...rest, description })

export const protocols = {
  splectral: {
    package: 'haiccing/base-package-splectral',
    description: 'Splectral, an app platform: its server, the commands of the install shown in a browser as they complete; its components installed, each served at its position.',
    actions: {
      start: here('The server started: the page served, the root mrepo\'s outbox folder followed; its argument the port, 4400 when none (another when that one is taken).', { args: ['port?'] }),
      stop: here('The server ended.'),
      status: here('Whether the server runs, where it is served and what it follows.'),
      install: { uris: ['**'], target: true, args: ['package'], description: 'A component\'s packages laid on top of the mrepo deployed at a position (boot/deploy <position> base-package-service): placed in its folder, its Splectral inbox and outbox made, its runtime config laid by the mrepo itself; the server routes the browser to it at /<position>/.' }
    }
  }
}

export const actions = {
  splectral: { start, stop, status, install }
}
