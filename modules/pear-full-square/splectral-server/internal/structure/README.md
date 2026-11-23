# structure

Folds the completed records of an install into its structure: the mrepos, a tree, each with its state.

Nothing is asked of the mrepos: what a command answered says what it
changed. A deploy adds a node below the mrepo that executed it, a
teardown takes one away with what was below it, a service command moves
a node's state, the container protocol's answers say its container's.

## Signature

`createStructure(root)`: `root` is the root mrepo's unique URI: where a
record that was sent on nowhere was executed.

## Returns

`{ apply(envelope), snapshot() }`

- `apply`: a completed record taken in; the unique URI of the node it
  changed, `null` when it changed nothing.
- `snapshot`: `{ root, version, nodes }`: `version` how many times it
  changed so far; the nodes each parent before its children, the
  children by position. A node: `{ uri, parent, at, package, service,
  container, depth }`: its unique URI, its parent's, its position
  there, the package it was deployed from, its service state (as its
  deploy said it, its commission done; `null` until one said it), and its container: `null`, or
  `{ name, state, service }`: Docker's state as last said, and the
  replica's service state.

## Design

- **A swarm node is one node**: its replica in a container is no node
  of its own. What is executed in the replica (`<node>/container`) is
  its node's container's: the replica's service state.
- **Where a command was executed**: the last mrepo it was sent on to,
  from its log; the root when it was sent on nowhere.
- **Only what completed without error** changes anything.
- **As the commands made it**: a runtime or a container that ended
  without a command is not seen.
