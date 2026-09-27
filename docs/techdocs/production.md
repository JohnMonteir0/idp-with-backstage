# Production operation

Production runs the same `mkdocs-techdocs-core` toolchain embedded in the
Backstage runtime image. The backend generates documentation locally and serves
it through the TechDocs API.

## Deployment

The image workflow builds the Backstage bundle and runtime image, publishes an
immutable ECR digest, and proposes the Deployment update. After merging it,
Argo CD rolls out the new image.

Verify the portal and documentation:

```sh
kubectl -n backstage rollout status deployment/backstage --timeout=300s
kubectl -n backstage logs deployment/backstage --tail=200
```

The included local publisher stores generated sites on the Backstage pod and
therefore uses one replica. A pod replacement regenerates a site on its next
request. Before scaling Backstage above one replica, configure the TechDocs
publisher for shared object storage such as S3 and give the Backstage service
account only the required bucket permissions.

Do not mount the Docker socket into Backstage. TechDocs is configured with
`generator.runIn: local` specifically to avoid a privileged application pod.
