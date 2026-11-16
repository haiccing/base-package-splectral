// The splectral protocol's config: each action at the mrepo itself (`.`),
// the Splectral mrepo whose server it is about.
const here = (description, rest = {}) => ({ uris: ['.'], ...rest, description })
export const CONFIG = {
  description: 'Splectral\'s server: the commands of the install shown in a browser as they complete.',
  actions: {
    start: here('The server started: the page served, the root mrepo\'s outbox folder followed; its argument the port, 4400 when none (another when that one is taken).', { args: ['port?'] }),
    stop: here('The server ended.'),
    status: here('Whether the server runs, where it is served and what it follows.')
  }
}
