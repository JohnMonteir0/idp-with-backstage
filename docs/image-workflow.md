# Build Backstage and deploy through Argo CD

GitHub Actions workflows live in **`.github/workflows/`**. `backstage-image.yaml` builds the existing Backstage application, pushes it to ECR and opens a deployment pull request in this repository. Merging that PR lets the existing Argo CD `backstage` Application roll out the image by immutable digest.

This configuration uses **Cilium ingress** and your existing **ExternalDNS + Cloudflare** installation. The URL is:

```text
http://backstage-<environment>.<AWS-account-ID>.montlabz.com
```

The account ID comes from `aws sts get-caller-identity` after GitHub assumes the ECR publisher role. The update script changes the image, Ingress rule, both ExternalDNS hostname annotations, and the container's HTTP `BACKSTAGE_BASE_URL` together. Kubernetes YAML does not evaluate Terraform `${var.environment}` expressions; the workflow writes concrete values before Argo sync.

## Application source

This repository now includes the Backstage application workspace at the repository root. It has a committed `yarn.lock`, pinned Yarn via Corepack, `tsc` and `build:backend` scripts, `packages/backend/Dockerfile`, `app-config.yaml`, and `app-config.production.yaml`. The workflow builds this checked-out repository directly; no source repository secret is needed. Preserve production authentication and include the GitHub scaffolder module described in the root README.

The source Dockerfile remains responsible for packaging the app and its dependencies. `docker/Dockerfile` adds the public AWS RDS certificate bundle expected by this deployment. No application credentials are passed into the image build. The workflow builds Linux amd64 images; ARM-only EKS node pools require an ARM build/runner adjustment.

Changes to the Backstage application, workflow, `docker/`, or deployment update script trigger a build. Use **Actions → Build Backstage and propose deployment → Run workflow** on `main` for a manual build.

## GitHub and AWS setup

1. Create an ECR repository and allow your EKS node role (or Fargate execution role) to pull from it:

   ```sh
   aws ecr create-repository --repository-name backstage --image-tag-mutability IMMUTABLE --region YOUR_REGION
   ```

2. Register GitHub's OIDC provider in IAM if it does not already exist: issuer `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`. Replace placeholders in `docs/aws/github-build-*.json`. Create the publisher role:

   ```sh
   aws iam create-role --role-name github-backstage-build --assume-role-policy-document file://docs/aws/github-build-trust-policy.json
   aws iam put-role-policy --role-name github-backstage-build --policy-name ecr-publish --policy-document file://docs/aws/github-build-permissions-policy.json
   ```

   This role only publishes to ECR; it does not access EKS or Cloudflare. GitHub uses this repository's immutable OIDC subject: `repo:JohnMonteir0@88355956/idp-with-backstage@1377758631:ref:refs/heads/main`. GitHub repositories created after July 15, 2026 use owner and repository IDs in the subject claim. Keep workflow branch filters and the trust policy aligned if you rename the branch. If you configure a GitHub Environment later, the subject changes to an environment form and must be updated accordingly.

3. Set `AWS_REGION` as a **repository variable** under **Settings → Secrets and variables → Actions → Variables**. Set every `BACKSTAGE_*` entry below as a **repository secret** under **Settings → Secrets and variables → Actions → Secrets**:

   | Setting | Value |
   | --- | --- |
   | `AWS_REGION` | ECR region, for example `us-east-1` |
   | `BACKSTAGE_BUILD_ROLE_ARN` | `arn:aws:iam::<account>:role/github-backstage-build` |
   | `BACKSTAGE_ECR_REPOSITORY` | Defaults to `backstage` |
   | `BACKSTAGE_ENVIRONMENT` | Defaults to `dev`, e.g. `prod` |
   | `BACKSTAGE_CLOUDFLARE_PROXIED` | Defaults to `false`; see Cloudflare requirements below |

4. Under **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. The workflow requests Contents and Pull requests write access for its deployment PR. It does not approve or merge its own PR. If your organization prevents bot-created PRs, the PR step needs an approved GitHub App token. PRs created with the built-in token do not trigger ordinary `pull_request` workflows; use an App token for that step if required checks depend on such triggers.

5. Run the workflow on `main`. Review the `automation/backstage-image` PR and merge it. The Argo Application must already be connected to this repository and tracking `main` as described in the root README. No kubeconfig or manual `kubectl set image` is used by CI.

There is one deployment directory and one automation PR branch. The environment setting names this deployment; it does not create isolated dev/prod deployments. Introduce separate overlays and Argo Applications before using this repository to deploy multiple environments concurrently.

## Cilium, TLS and automatic Cloudflare DNS

`manifests/backstage/ingress.yaml` uses `ingressClassName: cilium`, shared load balancer mode, `ingress.cilium.io/force-https: disabled`, and `ingress.cilium.io/backend-service-port: http`. It routes HTTP to the existing ClusterIP Service on port 7007. Your existing Cilium ingress controller must be enabled and its shared load balancer must be reachable by your intended clients. The cluster's Cilium/load-balancer configuration controls the public/private exposure; this repository does not change it. If your setup uses dedicated mode, change `ingress.cilium.io/loadbalancer-mode` to `dedicated` and apply your existing Service load balancer annotation policy.

This PoC intentionally has no TLS secret and uses HTTP. ExternalDNS creates the DNS record, while Cilium serves HTTP through its shared load balancer. Update the Backstage sign-in provider's callback URLs for the generated `http://` hostname. The Deployment's explicit `BACKSTAGE_BASE_URL` overrides the older value in `backstage-secrets`.

The Ingress includes your requested annotation:

```yaml
external-dns.alpha.kubernetes.io/hostname: backstage-dev.123456789012.montlabz.com
```

It also carries `external-dns.kubernetes.io/hostname` with the same value to support newer installations. Both annotation prefixes carry the same `cloudflare-proxied` setting. ExternalDNS must watch **Ingress** resources (`--source=ingress`), include `montlabz.com` in its domain filter, and have Cloudflare Zone Read and DNS Edit permissions for that zone. Keep its existing credentials in the controller; CI and Backstage do not need them. The controller's annotation/namespace filters must include this Ingress, and its TXT ownership configuration must not conflict with another controller.

The default is DNS-only (`cloudflare-proxied: "false"`). For a private Cilium load balancer, clients need private connectivity; public Cloudflare proxy servers cannot reach it directly. HTTP is suitable for this PoC only; enable TLS and Cloudflare **Full (strict)** before production.

## Verify

Local checks: `python3 scripts/test_configure_backstage.py` (requires PyYAML), `actionlint .github/workflows/backstage-image.yaml`, and `kubectl kustomize manifests/backstage`.

```sh
kubectl kustomize manifests/backstage
argocd app get backstage
kubectl -n backstage rollout status deployment/backstage
kubectl -n backstage get ingress backstage -o wide
kubectl -n backstage describe ingress backstage
# Use the actual namespace/deployment of your existing ExternalDNS controller:
kubectl -n YOUR_EXTERNAL_DNS_NAMESPACE logs deployment/YOUR_EXTERNAL_DNS_DEPLOYMENT --tail=100
dig backstage-dev.123456789012.montlabz.com
```

The Ingress must get a load balancer address before ExternalDNS can discover its target. If it stays empty, check Cilium ingress and the existing load balancer provisioning configuration. Once the record exists, test HTTP and Backstage login. Argo sync only confirms resource application; it does not confirm DNS propagation or successful login.

References: [Backstage image builds](https://backstage.io/docs/deployment/docker/), [GitHub AWS OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [Cilium ingress](https://docs.cilium.io/en/stable/network/servicemesh/ingress/), [ExternalDNS annotations](https://github.com/kubernetes-sigs/external-dns/blob/master/docs/annotations/annotations.md), and [Cloudflare provider](https://github.com/kubernetes-sigs/external-dns/blob/master/docs/tutorials/cloudflare.md).
