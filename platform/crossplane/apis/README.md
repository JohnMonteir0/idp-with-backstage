# PostgreSQL platform API

`PostgreSQLDatabase` is the stable interface presented to portal users. The
RDS and Aurora Compositions own provider-specific resources and map the public
`small`, `medium`, and `large` classes to approved AWS instance/storage values.

Install order:

1. Crossplane core and the RDS/EC2 providers.
2. `crossplane-api` (XRD, compositions, and patch-and-transform function).
3. ProviderConfig and database requests.

The API is namespaced and requests currently use `crossplane-system`. Team
directories provide Git ownership boundaries; moving teams into dedicated
namespaces later also requires Crossplane/provider RBAC and Argo destination
changes. Do not assume directory separation alone is runtime tenant isolation.

Composed AWS resources use `deletionPolicy: Orphan`. A deleted XR therefore
does not delete its database. Implement decommissioning as a separate reviewed
workflow that first disables AWS deletion protection, selects a final snapshot,
and confirms ownership.

The network IDs are intentionally still explicit. A later iteration should
derive them from an environment/account inventory or EnvironmentConfig after
those platform boundaries exist.
