# Local development

The local environment runs one kind node, one Backstage replica, and one
PostgreSQL replica. It does not install AWS or GitOps controllers.

## Start the portal

```sh
make local-up
make local-port-forward
```

Open `http://localhost:7007`, sign in as Guest, open the **Database Developer
Portal** component, and select the **Docs** tab. TechDocs generates this site on
first access.

After changing application code or documentation, rebuild the local image:

```sh
make local-reload
```

## Validate without AWS

```sh
make validate
```

This renders the production and local Kustomize trees and validates both
database templates. It does not connect to AWS, create a GitHub pull request,
or reconcile Crossplane resources.

Use `make local-logs` if generation fails. A successful generation contains a
TechDocs completion message and no missing `mkdocs` executable error.
