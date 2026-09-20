# Kubernetes manifests

`backstage/` is the complete Kustomize source consumed by Argo CD. Configure the Argo CD Application with:

```text
Repository: https://github.com/JohnMonteir0/idp-with-backstage.git
Revision: main
Path: manifests/backstage
Namespace: backstage
```

The image workflow updates `manifests/backstage/deployment.yaml` with the immutable ECR image digest and opens a pull request. Merge that pull request; Argo CD then syncs the change from `main`.

The Deployment follows Backstage's Kubernetes guidance: PostgreSQL runs as a separate Deployment with a Service and PVC, `postgres-secrets` supplies its credentials, and `backstage-secrets` supplies the GitHub token and portal URL. This example uses the in-cluster hostname `postgres.backstage` and the cluster's default StorageClass. The committed values are demo values only; replace `GITHUB_TOKEN` and protect both Secrets with SealedSecrets or ExternalSecrets before production use.

Render or inspect the exact resources locally:

```sh
kubectl kustomize manifests/backstage
```
