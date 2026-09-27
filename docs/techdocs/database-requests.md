# Database requests

Two templates are available. Each creates one `PostgreSQLDatabase` platform
request; Crossplane Compositions own the lower-level AWS resources:

- **RDS PostgreSQL** creates a private, encrypted Multi-AZ PostgreSQL instance.
- **Aurora PostgreSQL** creates a private cluster with two instances.

Developers select an ownership, environment, size, and availability class
instead of an AWS instance class. Both templates currently require an existing VPC, at least two private subnets in
different availability zones, and the security group of the client workload.

## Review checklist

- Confirm all network IDs belong to the selected account, region, and VPC.
- Confirm the subnets are private and span at least two availability zones.
- Check that the selected instance class is available and appropriately sized.
- Verify deletion protection, encryption, backups, and public access settings.
- Review the expected AWS cost before merging.

## Readiness

After Argo CD applies a request, inspect all labeled managed resources:

```sh
kubectl get managed -l platform.example.org/database=DATABASE_NAME
```

Do not distribute connection details until every required resource reports
`Ready=True` and `Synced=True`. A successful Backstage task only means that the
pull request was created.
