# Database requests

Backstage writes each request to `<name>/*.yaml` through a pull request.
Argo CD recursively watches YAML files here. No live database is created by the initial setup.
Do not place Backstage catalog entities or example manifests in this directory.
Names must be unique across RDS and Aurora requests in the account/region.
