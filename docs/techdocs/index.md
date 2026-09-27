# Database Developer Portal

This portal provides reviewed, GitOps-based requests for private PostgreSQL
databases. Backstage collects the database and network inputs, generates
Crossplane manifests, and opens a pull request. Merging a reviewed request lets
Argo CD apply it and Crossplane reconcile the corresponding AWS resources.

## Delivery flow

1. A developer selects an RDS PostgreSQL or Aurora PostgreSQL template.
2. Backstage renders the request manifests and opens a GitHub pull request.
3. A platform reviewer verifies networking, sizing, security, and cost.
4. Argo CD applies the merged manifests.
5. Crossplane creates or updates the AWS resources.

Creating a pull request is not proof that a database is ready. Always verify
the managed resources report both `Ready=True` and `Synced=True`.

## Documentation modes

The same documentation source works in both environments:

- The kind environment reads the current checkout copied into the local image.
- Production reads the repository through the catalog location on `main`.

TechDocs generation runs inside the Backstage image, so neither environment
requires a Docker socket in the application pod.
