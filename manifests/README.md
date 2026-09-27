# Kubernetes manifests

`backstage/` is the complete Kustomize source consumed by Argo CD. Do not create
the Backstage Application manually in the Argo CD UI. Bootstrap the repository's
root application after its configuration has been merged into `main`:

```sh
kubectl apply -f argocd/bootstrap/root.yaml
```

The root application manages the Backstage Application and the other platform
applications declared under `argocd/applications/`. See `argocd/README.md` for
the complete bootstrap flow.

The image workflow updates `manifests/backstage/backstage-deployment.yaml` with the immutable ECR image digest and opens a pull request. Merge that pull request; Argo CD then syncs the change from `main`.

The Deployment follows Backstage's Kubernetes guidance: PostgreSQL runs as a separate Deployment with a Service and PVC, `postgres-secrets` supplies its credentials, and `backstage-secrets` supplies the GitHub token and portal URL. This example uses the in-cluster hostname `postgres.backstage` and the EKS `ebs-csi` StorageClass. The committed values are demo values only; replace `GITHUB_TOKEN` and protect both Secrets with SealedSecrets or ExternalSecrets before production use.

Render or inspect the exact resources locally:

```sh
kubectl kustomize manifests/backstage
```
