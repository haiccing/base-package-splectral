# base-package-splectral

The Splectral platform: the server, its shell, the contract and model, transports, and the extensions for p2p swarms (watchers, actions, observer), scenarios, the timeline and replay; the map view (splectral/base-view-map), shared by the demos.

A package: self-contained, its code ready to run, laid out as it is installed. Written by the package manager (`pear-full-square/pkgm-base-manager`) from the development repository; do not edit here.

- requires: `haiccing/base-package-p2p`
- hash: `a43e93018c67806efc97305f0494bf855a60d09e7202faf31e189f834fbe7da6`

## Holds

- `pear-full-square/splectral-contract`
- `pear-full-square/splectral-model`
- `pear-full-square/splectral-transport`
- `pear-full-square/splectral-server`
- `pear-full-square/splectral-shell`
- `pear-full-square/splectral-p2p-observer`
- `pear-full-square/splectral-p2p-watchers`
- `pear-full-square/splectral-p2p-actions`
- `pear-full-square/splectral-scenario`
- `pear-full-square/splectral-timeline`
- `pear-full-square/splectral-replay`
- `splectral/base-view-map`

## Installed

By the package manager, into the host's install folder (`~/.haicc/packages`), with the packages it requires; its tests run there:

```sh
node <install folder>/pear-full-square/pkgm-base-manager/cli.js install splectral --from <folder of haiccing repositories>
node <install folder>/pear-full-square/pkgm-base-manager/cli.js test splectral
```
