# Infrastructure

Kubernetes manifests and GitOps assets for the AI Task Platform.

```
infra/
├── k8s/                # Kubernetes manifests (managed with Kustomize)
│   ├── namespace.yaml
│   ├── configmap.yaml  # non-secret config (Mongo/Redis URLs, NODE_ENV, ...)
│   ├── secret.yaml     # JWT_SECRET and other secrets (placeholder values)
│   ├── mongo.yaml      # MongoDB Deployment + Service + PVC
│   ├── redis.yaml      # Redis Deployment + Service + PVC
│   ├── deployment.yaml # backend, frontend, worker Deployments
│   ├── service.yaml    # backend + frontend Services
│   ├── ingress.yaml    # routes / → frontend, /api → backend
│   ├── hpa.yaml        # HorizontalPodAutoscaler for the worker
│   └── kustomization.yaml
└── argocd/
    └── application.yaml  # Argo CD Application (GitOps auto-sync)
```

## Components

| Component | Kind | Replicas | Notes |
|-----------|------|----------|-------|
| frontend  | Deployment + Service | 2 | nginx serving the built SPA on port 8080, proxies `/api` → backend |
| backend   | Deployment + Service | 2 | Express API on port 5000; readiness `/api/ready`, liveness `/api/health` |
| worker    | Deployment (+ HPA)   | 2–6 | Python queue consumer; exec liveness probe via `healthcheck.py` heartbeat |
| mongo     | Deployment + Service + PVC | 1 | Persistent task state |
| redis     | Deployment + Service + PVC | 1 | Job queue (append-only persistence) |

All app Deployments set resource requests/limits and liveness + readiness probes. The worker is scaled by an HPA on CPU (min 2, max 6).

## Deploy with Kustomize

```bash
# Preview the fully-rendered manifests
kustomize build infra/k8s | less

# Apply to the current cluster context
kubectl apply -k infra/k8s
```

This creates the `ai-task-platform` namespace and all resources within it.

### Before deploying to a real cluster

1. **Secrets** — `secret.yaml` ships with placeholder values. Replace `JWT_SECRET` with a real secret (e.g. `kubectl create secret generic ... --dry-run=client -o yaml`), or wire in a sealed-secrets / external-secrets controller. Never commit real secrets.
2. **Ingress host** — `ingress.yaml` uses `ai-task-platform.local`. Point it at your real hostname and ensure an ingress controller (e.g. ingress-nginx) is installed. For local testing, add the host to `/etc/hosts`.
3. **Images** — the manifests use logical image names (`ai-task-platform/backend`, `-frontend`, `-worker`) that Kustomize rewrites to real registry images (see below).

## Image tags & GitOps flow

Image references are managed by the Kustomize `images:` transformer in `kustomization.yaml`. CI updates the tags automatically — you don't edit them by hand:

```bash
# What CI runs (per component), from infra/k8s:
kustomize edit set image ai-task-platform/backend=ghcr.io/<owner>/<repo>-backend:<git-sha>
```

End-to-end delivery pipeline (`.github/workflows/ci.yml`):

1. **lint** — ESLint (frontend + backend), ruff (worker). Runs on every push/PR.
2. **build-and-push** — builds each component's Docker image and pushes to GHCR
   (`ghcr.io/<owner>/<repo>-<component>:<git-sha>` and `:latest`). Runs on push to `main`.
3. **update-manifests** — runs `kustomize edit set image` to pin the new `<git-sha>`
   tags and commits the change back to `infra/k8s/kustomization.yaml` with `[skip ci]`.

The push trigger ignores `infra/**`, so the bot's tag-bump commit does not loop CI.

## Argo CD (continuous deployment)

`argocd/application.yaml` defines an Argo CD `Application` that watches `infra/k8s` and auto-syncs it to the cluster.

```bash
# Install once, then let Argo reconcile automatically:
kubectl apply -f infra/argocd/application.yaml
```

Key settings:
- `syncPolicy.automated` with `prune` + `selfHeal` — the cluster tracks git exactly; manual drift is reverted and removed resources are pruned.
- `CreateNamespace=true` — Argo creates the `ai-task-platform` namespace.
- `ignoreDifferences` on the worker's `/spec/replicas` — the HPA owns that field, so Argo won't fight the autoscaler.

**Before applying:** edit `repoURL` (currently the `CHANGE-ME` placeholder) to point at the repository that holds these manifests.

> The manifests live in this same repo under `infra/`. To use a **separate infrastructure repository** (as some GitOps setups prefer), move `infra/k8s` into that repo, update the CI `update-manifests` job to check out and push to it (using a PAT with write access), and update the Argo `repoURL` accordingly.

## Registry / image pull notes

Images are pushed to GHCR. If the packages are **private**, create an image pull secret in the namespace and reference it (or attach it to the default service account):

```bash
kubectl -n ai-task-platform create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=<user> --docker-password=<token>
```

Making the GHCR packages public avoids needing a pull secret.
