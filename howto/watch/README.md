# watch

The commands of an install seen in a browser, as they arrive.

The boot mrepo is there (`haicc boot/deploy`). Splectral is deployed as
an mrepo of its own; its service's start starts the server, which
follows the boot mrepo's records.

## Steps

```sh
# deployed, brought into service by its commission: the server started
haicc . boot/deploy splectral haiccing/base-package-splectral
# where the page is: http://127.0.0.1:4400, or another port when taken
haicc splectral splectral/status
# open it in a browser on this machine, then send commands and see each arrive
haicc . boot/deploy host haiccing/base-component-haicc
# another port: stopped first (a running server keeps its port)
haicc splectral splectral/stop .
haicc splectral splectral/start . 4401
# ended
haicc splectral service/stop
haicc . boot/teardown splectral
```
