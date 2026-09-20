# Kubernetes manifests

`backstage/` is the complete Kustomize source consumed by Argo CD. Configure the Argo CD Application with:

```text
Repository: https://github.com/JohnMonteir0/idp-with-backstage.git
Revision: main
Path: manifests/backstage
Namespace: backstage
```

The image workflow updates `manifests/backstage/deployment.yaml` with the immutable ECR image digest and opens a pull request. Merge that pull request; Argo CD then syncs the change from `main`.

Render or inspect the exact resources locally:

```sh
kubectl kustomize manifests/backstage
```
