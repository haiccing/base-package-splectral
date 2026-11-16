// base-package-splectral's protocol: splectral, Splectral's server started,
// stopped and asked for its state. Linked into an mrepo, its config is
// loaded by the runtime and its actions run.
// The work and the config are splectral-server's; here the mounting.
import { start, stop, status, CONFIG } from './modules/pear-full-square/splectral-server/index.js'

export const protocols = {
  splectral: { package: 'haiccing/base-package-splectral', ...CONFIG }
}

export const actions = {
  splectral: { start, stop, status }
}
