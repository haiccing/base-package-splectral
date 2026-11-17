# scripts/

The scripts of base-package-splectral: scripts to go on with after a deploy, their lines simple commands.

Asked for with the deploy, by name, a script is answered as the deploy's
continuation, and the `haicc` command sends it on, `haicc/script`, to
the deployed mrepo, where its lines are executed.

```
haicc . boot/deploy splectral base-package-splectral --flags continuation=start
```

| script | |
|---|---|
| `start.haicc` | the mrepo brought into service: `service/initialise`, then `service/start`, which starts its server |
