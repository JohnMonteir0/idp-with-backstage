# Argo CD bootstrap

Argo CD is installed by the EKS infrastructure repository, but installing the
controller does not register this repository's `Application` resources. After
the files in this directory are merged into `main`, bootstrap the root
application once:

```sh
kubectl apply -f argocd/bootstrap/root.yaml
```

The `idp-root` application then manages the `idp` project and every application
listed in `argocd/kustomization.yaml`. No application needs to be created
manually in the Argo CD UI.

The `database-requests` application recursively watches
`requests/databases/**/*.yaml`. Consequently, merging a Backstage-generated
request into `main` is enough for Argo CD to deploy it. Backstage
`catalog-info.yaml` files are excluded because they are catalog descriptors,
not Kubernetes resources.

Check the bootstrap and child applications with:

```sh
kubectl get applications -n argocd
kubectl get appproject idp -n argocd
```
