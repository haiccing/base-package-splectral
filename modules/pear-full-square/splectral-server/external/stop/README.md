# stop

Ends Splectral's server, and waits until its process has ended.

## Signature

`stop(exec)`: requested as `splectral/stop`, at the mrepo itself.

## Returns

`{ splectral: "stopped", pid }`: the process that was ended; `pid` is
`null` when none was running, which is no error.

## Errors

The server's process did not end.
