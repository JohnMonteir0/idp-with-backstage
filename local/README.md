# Lightweight local Backstage environment

This environment tests the Backstage image, PostgreSQL migrations, catalog, and
database request templates on a single-node kind cluster. It intentionally does
not install Argo CD, Cilium, Crossplane, AWS providers, EBS CSI, ExternalDNS,
Sealed Secrets, or either AWS load balancer controller. Those components either
only reconcile Git/AWS state or duplicate features already supplied by kind.

The local cluster therefore makes **no AWS infrastructure changes**. Template
shape and generated Crossplane manifests are checked by `make validate`; actual
AWS reconciliation remains a remote integration test after review.

## Start

Prerequisites: Docker, kind, and kubectl. The build uses the repository's
checked-in Yarn release inside a pinned Node 24 container, so Node, Yarn, and
Corepack are not required on the host.

```sh
make local-up
make local-port-forward
```

Open <http://localhost:7007> and sign in as Guest. The second command stays in
the foreground; use another terminal for logs and status:

```sh
make local-status
make local-logs
```

`make local-up` performs the first dependency install and image build. For an
application change, use `make local-reload`. Docker and Yarn caches make later
builds faster. For frontend-only work, `yarn start` remains the fastest loop and
does not require Kubernetes.

The local catalog reads `catalog/` and `requests/` copied from the current
working tree. The database templates still contain their production GitHub PR
action. Without a GitHub token in this local environment, that action cannot
write to the remote repository. Use `make validate` to safely render and check
both templates without AWS or GitHub writes.

## Stop and clean up

```sh
make local-down
```

This deletes only the kind cluster named `backstage-local`, including its local
PostgreSQL volume. Override defaults when needed, for example
`make local-up CLUSTER_NAME=my-backstage`.
