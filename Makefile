SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

CLUSTER_NAME ?= backstage-local
KIND_CONFIG ?= local/kind.yaml
LOCAL_IMAGE ?= idp-backstage:local
LOCAL_OVERLAY ?= local/kubernetes
NODE_BUILD_IMAGE ?= node:24-trixie
KUBECTL := kubectl --context kind-$(CLUSTER_NAME)

.PHONY: help local-check local-create local-build local-load local-deploy local-up local-reload local-status local-logs local-port-forward local-down validate validate-deps

help: ## Show the available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

local-check: ## Verify that the local tools are installed
	@for tool in docker kind kubectl; do command -v $$tool >/dev/null || { echo "Missing required tool: $$tool" >&2; exit 1; }; done
	@docker info >/dev/null 2>&1 || { echo "Docker is not running or is not accessible." >&2; exit 1; }

local-create: local-check ## Create the small, single-node kind cluster if needed
	@if ! kind get clusters | grep -qx '$(CLUSTER_NAME)'; then kind create cluster --name '$(CLUSTER_NAME)' --config '$(KIND_CONFIG)'; else echo "kind cluster $(CLUSTER_NAME) already exists"; fi

local-build: local-check ## Build the Backstage bundle and local container image
	docker run --rm --user "$$(id -u):$$(id -g)" -e HOME=/tmp -v '$(CURDIR):/app' -w /app '$(NODE_BUILD_IMAGE)' bash -lc 'node .yarn/releases/yarn-4.13.0.cjs install --immutable && node .yarn/releases/yarn-4.13.0.cjs tsc && node .yarn/releases/yarn-4.13.0.cjs build:backend'
	docker build -f packages/backend/Dockerfile -t '$(LOCAL_IMAGE)' .

local-load: local-create ## Load the local image into kind without a registry
	kind load docker-image '$(LOCAL_IMAGE)' --name '$(CLUSTER_NAME)'

local-deploy: local-create ## Apply the local-only Kubernetes overlay
	$(KUBECTL) apply -k '$(LOCAL_OVERLAY)'
	$(KUBECTL) -n backstage rollout status deployment/postgres --timeout=180s
	$(KUBECTL) -n backstage rollout status deployment/backstage --timeout=300s

local-up: local-build local-load local-deploy ## Build and start the complete local environment
	@echo "Backstage is ready. Run: make local-port-forward"

local-reload: local-build local-load ## Rebuild after a code change and restart Backstage
	$(KUBECTL) apply -k '$(LOCAL_OVERLAY)'
	$(KUBECTL) -n backstage rollout restart deployment/backstage
	$(KUBECTL) -n backstage rollout status deployment/backstage --timeout=300s

local-status: ## Show local pods, services, storage, and resource usage if available
	$(KUBECTL) -n backstage get pods,services,pvc
	@$(KUBECTL) -n backstage top pods 2>/dev/null || true

local-logs: ## Follow Backstage logs
	$(KUBECTL) -n backstage logs deployment/backstage --all-containers --tail=200 -f

local-port-forward: ## Serve Backstage at http://localhost:7007 (keep this running)
	$(KUBECTL) -n backstage port-forward service/backstage 7007:80

local-down: ## Delete only the dedicated local kind cluster
	kind delete cluster --name '$(CLUSTER_NAME)'

validate-deps:
	@test -d /tmp/idp-validation/node_modules/nunjucks || npm install --prefix /tmp/idp-validation --no-audit --no-fund nunjucks@3.2.4 yaml@2.8.1 ajv@8.17.1

validate: validate-deps ## Validate templates and render both production and local manifests
	kubectl kustomize manifests/backstage >/dev/null
	kubectl kustomize '$(LOCAL_OVERLAY)' >/dev/null
	NODE_PATH="$${NODE_PATH:-/tmp/idp-validation/node_modules}" node scripts/validate.cjs
