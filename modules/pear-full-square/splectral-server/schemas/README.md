# schemas/

The server's schemas, each named by its URI, `pear-full-square/splectral-server/<name>`.

- `data.json`: a component's data request and its answer (`data`), as
  it goes back into the component's Splectral inbox when the component
  asked for it typed (`as`): `request`, `at`, `command`, `as`, `raw`,
  then `output` (the next level: the answer written as the schema it was
  asked as, or `json`, single-object encoded), `error`, `record`.
