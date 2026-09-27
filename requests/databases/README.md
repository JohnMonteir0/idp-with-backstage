# Database desired state

New requests use the namespaced `PostgreSQLDatabase` platform API and are
organized by environment, owning team, and resource name:

```text
requests/databases/<environment>/<team>/<database>/database.yaml
```

Each directory contains one intent-based request. Crossplane Compositions under
`platform/crossplane/apis/` own the AWS implementation details. The older
`testing/` and `testing2/` directories contain legacy direct managed resources;
they are retained to avoid implicitly changing or deleting existing AWS state.

Production requests require platform review. Removing a directory does not
decommission its database because pruning is disabled and composed resources
use `deletionPolicy: Orphan`. Use an explicit, reviewed decommission procedure.
