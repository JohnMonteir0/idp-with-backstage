# Kubernetes manifests

`backstage/` is the complete Kustomize source consumed by Argo CD. Configure the Argo CD Application with:

```text
Repository: https://github.com/JohnMonteir0/idp-with-backstage.git
Revision: main
Path: manifests/backstage
Namespace: backstage
```

The image workflow updates `manifests/backstage/deployment.yaml` with the immutable ECR image digest and opens a pull request. Merge that pull request; Argo CD then syncs the change from `main`.

The Deployment follows Backstage's Kubernetes guidance: PostgreSQL connection values come from `postgres-secrets`, and GitHub/portal values come from `backstage-secrets`. The `*.example.yaml` files are references only and are intentionally excluded from `kustomization.yaml`.

Create the real Secrets before syncing:

```sh
kubectl -n backstage create secret generic postgres-secrets \
  --from-literal=POSTGRES_HOST='<postgres-host>' \
  --from-literal=POSTGRES_PORT='5432' \
  --from-literal=POSTGRES_USER='<postgres-user>' \
  --from-literal=POSTGRES_PASSWORD='<postgres-password>'

kubectl -n backstage create secret generic backstage-secrets \
  --from-literal=BACKSTAGE_BASE_URL='https://backstage-<environment>.<account-id>.montlabz.com' \
  --from-literal=GITHUB_TOKEN='<github-fine-grained-token>'
```

Use your existing Backstage PostgreSQL database. The official guide also shows a PostgreSQL Deployment, PVC, and Service for local or non-managed environments; this EKS setup keeps PostgreSQL external and managed separately.

Render or inspect the exact resources locally:

```sh
kubectl kustomize manifests/backstage
```
