# scripts/

The scripts of base-package-splectral: lists of commands to go on with after a deploy.

Asked for with the deploy, by name, a script is answered as the deploy's
continuation, and the `haicc` command runs it.

```
haicc . boot/deploy splectral base-package-splectral --flags continuation=start
```

| script | |
|---|---|
| `start.json` | the mrepo brought into service: `service/initialise`, then `service/start`, which starts its server |
