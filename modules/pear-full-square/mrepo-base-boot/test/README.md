# test/

The tests of mrepo-base-boot, a section per file, each test by its name.

## `build.test.js`

- the boot mrepo: built from its folder, the same twice
- the boot mrepo running, without its packages: its boot hook run, what it activated answering; its preloaded deploy refused (no boot protocol linked); stopped
- the structure written for the tests removed

## `deploy.test.js`

The boot protocol's actions, with a context like the execute protocol's (reads from the repository, writes collected, then committed; exec.commit() a local commit).

- documents: store: the list laid in and placed, nothing more: its info extraction reads the store; documents anything else refused
- schemas: each package placed registers the schemas it carries, its own and its modules', in the install's registry
- deploy from a target package's list, linked first, placed by its unique URI, its scripts placed; idempotent; redeploy; teardown; the registry, mrepos/; a swarm's node
- deploy the runtime: the child's runtime started from its own packages, its inbox answering; teardown stops it
- commission and decommission: the deploy waits for the child's commission, a failed one leaving nothing; the teardown asks for its decommission first, a failed one removing nothing
