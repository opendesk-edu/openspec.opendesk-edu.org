<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# HAProxy Ingress

## Purpose

Primary ingress controller for the openDesk Edu platform. Routes external
HTTPS traffic to backend services based on host headers, performs TLS
termination, and provides HTTP/S proxy functionality.

HAProxy Ingress is the default ingress class (`ingressClassName: haproxy`) for
all platform services. An `ingress-nginx` controller coexists but is only used
for services explicitly requiring `ingressClassName: nginx`.

## Scope

- ✅ **In scope**: HAProxy Ingress deployment, host-based routing, TLS termination, per-service timeout configuration, snippet annotation support, large header support, ACME HTTP-01 challenge routing, monitoring via `haproxy_exporter`
- ❌ **Out of scope**: nginx-ingress configuration (only referenced for coexistence issues), service mesh (Istio/Linkerd), internal cluster networking (CoreDNS)

## Non-Goals

- nginx-ingress controller management (minimal coexistence, see Known Quirks)
- Service mesh or east-west traffic management
- DDoS protection (HRZ network-level responsibility)
- WAF (Web Application Firewall)

## Requirements

### Requirement: Host-based HTTPS routing

HAProxy Ingress SHALL route external HTTPS traffic to backend services based on
the `Host` header, with TLS termination at the ingress.

#### Scenario: Service routing
- GIVEN an Ingress resource with `ingressClassName: haproxy` and a host rule
  for `nextcloud.opendesk.hrz.uni-marburg.de`
- WHEN an HTTPS request arrives matching the host header
- THEN HAProxy routes the request to the Nextcloud backend service
- AND TLS is terminated at the ingress (backend receives HTTP)
- AND the backend service responds with the application content

#### Scenario: Default timeout
- GIVEN an Ingress resource without explicit timeout configuration
- WHEN a request is proxied to the backend
- THEN HAProxy uses the default body timeout of 100 seconds

### Requirement: Per-service timeout configuration

HAProxy Ingress SHALL support per-service timeout overrides for long-running
operations.

#### Scenario: Extended timeout for Collabora
- GIVEN Collabora Ingress with extended timeout
- WHEN a document editing session is active
- THEN HAProxy uses a 600-second body timeout (long document processing)
- AND the connection is not terminated prematurely

#### Scenario: Extended timeout for Jitsi
- GIVEN Jitsi Ingress with extended timeout
- WHEN a video conference is in progress
- THEN HAProxy uses a 3600-second timeout (long-lived WebSocket)
- AND the WebSocket connection persists for the duration of the meeting

#### Scenario: Extended timeout for Notes Y-Provider
- GIVEN Notes Y-Provider Ingress with extended timeout
- WHEN Y.js WebSocket connections are active
- THEN HAProxy uses an 86400-second timeout (24h WebSocket)

### Requirement: Snippet annotations enabled

HAProxy Ingress SHALL allow snippet annotations for services that require
custom HAProxy configuration.

#### Scenario: Application with custom HAProxy config
- GIVEN an Ingress resource with HAProxy snippet annotations
- WHEN the ingress controller processes the Ingress
- THEN `allowSnippetAnnotations=true` is configured on the ingress controller
- AND `admissionWebhooks.allowSnippetAnnotations=true` is also enabled
- AND the snippet configuration is applied to the HAProxy backend

### Requirement: Large header support

HAProxy Ingress SHALL support HTTP requests with large headers without
rejecting them.

#### Scenario: UDM REST API large headers
- GIVEN a request to the UMS REST API with large HTTP headers
- WHEN HAProxy receives the request
- THEN HAProxy processes it with `tune.bufsize 65536` and `tune.http.maxhdr 256`
- AND the request is NOT rejected with `431 Request Header Fields Too Large`

### Requirement: ACME HTTP-01 challenge routing

HAProxy Ingress SHALL route ACME HTTP-01 challenge requests to the cert-manager
solver pod.

#### Scenario: Let's Encrypt challenge
- GIVEN cert-manager requesting a certificate via HTTP-01 challenge
- WHEN Let's Encrypt sends a request to `/.well-known/acme-challenge/`
- THEN HAProxy routes the request to the cert-manager solver pod
- AND the challenge response is returned
- AND the certificate is issued

## Component Reference

| Component | Purpose | Replicas | Notes |
|-----------|---------|----------|-------|
| HAProxy Ingress Controller | L7 proxy, TLS termination, routing | 2+ | `ingressClassName: haproxy` |
| haproxy_exporter | Prometheus metrics exporter | Sidecar | Port 10254 |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| HAProxy Ingress Controller | 1001 | NET_BIND_SERVICE | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| External IP | `192.168.3.201` (shared with ingress-nginx) |
| Ingress class | `haproxy` (default for all services) |
| Default timeout | 100s body timeout |
| Large headers | `tune.bufsize 65536`, `tune.http.maxhdr 256` |
| Snippet annotations | `allowSnippetAnnotations=true` |
| Metrics port | 10254 |
| Deploy stage | Pre-infra (required before service Ingresses) |

## Per-Service Timeout Configuration

| Service | Timeout (s) | Reason |
|---------|-------------|--------|
| Collabora | 600 | Long document processing |
| Jitsi | 3600 | Long-lived WebSocket during meetings |
| Nextcloud | 600 | Large file uploads |
| Notes Y-Provider | 86400 | Long-lived Y.js WebSocket connections |
| All others | 100 | Default body timeout |

## Known Quirks

### ingress-nginx and HAProxy share external IP

Both `ingress-nginx` and `haproxy` ingress controllers are deployed with the
external IP `192.168.3.201`. The nginx-ingress controller does NOT process all
ingresses — only those with `ingressClassName: nginx`. Most services use
`ingressClassName: haproxy`.

#### Scenario: Ingress class mismatch
- GIVEN a service Ingress with `ingressClassName: nginx`
- WHEN the nginx ingress controller does not have the matching host rule
- THEN traffic to that host is NOT routed
- AND the service SHALL use `ingressClassName: haproxy` instead

### Planka ingress class annotation conflict

The upstream Planka chart sets `kubernetes.io/ingress.class: nginx` annotation
in `values.yaml`. When using HAProxy ingress, this annotation MUST be removed,
keeping only `ingressClassName: haproxy`.

### Nextcloud AIO probe timing

Nextcloud AIO uses `initialDelaySeconds` instead of `periodSeconds` for
readiness/startup probes, causing 10x PHP-FPM load. The deployment and chart
template SHALL be patched to use `periodSeconds`.

## API Contracts

HAProxy Ingress is the TLS termination and routing layer for all platform API
contracts. Every contract listed below is proxied through HAProxy.

- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — routes `POST /realms/opendesk/protocol/openid-connect/token` to Keycloak
- [Keycloak SAML 2.0 SP-SSO](../../integrations/api-contracts/#contract-keycloak-saml-20-sp-initiated-sso) — routes SAML AuthnRequest/SAMLResponse to/from Keycloak
- [SAML POST Metadata (DFN-AAI)](../../integrations/api-contracts/#contract-saml-post-metadata-dfn-aai-idp-registration) — routes DFN-AAI metadata endpoint to Keycloak
- [Intercom Silent Login](../../integrations/api-contracts/#contract-intercom-silent-login) — routes `POST /api/silent-login` to Intercom
- [Nubus Portal Navigation](../../integrations/api-contracts/#contract-nubus-portal-navigation) — routes `GET /portal/navigation.json` to Nubus Portal
- [WOPI Discovery + CheckFileInfo](../../integrations/api-contracts/#contract-wopi-discovery-and-checkfileinfo) — routes WOPI requests to Collabora (600s timeout)
- [BBB Greenlight Room API](../../integrations/api-contracts/#contract-bbb-greenlight-room-api) — routes `POST /api/create` to BBB (100s timeout)
- [LDAP Bind/Search](../../integrations/api-contracts/#contract-ldap-bind-and-search) — NOT proxied (internal LDAP, no ingress routing)
- [S3 Object Storage](../../integrations/api-contracts/#contract-s3-object-storage) — NOT proxied (internal MinIO at `http://minio:9000`)
- [ClamAV ICAP Scan](../../integrations/api-contracts/#contract-clamav-icap-scan) — NOT proxied (internal ICAP protocol)
- [Dovecot IMAP](../../integrations/api-contracts/#contract-dovecot-imap) — NOT proxied (internal IMAP, no ingress routing)
- [Postfix SMTP Submission](../../integrations/api-contracts/#contract-postfix-smtp-submission) — NOT proxied (internal SMTP, no ingress routing)
- [Notify Push WebSocket](../../integrations/api-contracts/#contract-notify-push-websocket) — routes WSS to Nextcloud (600s timeout)

## Depends On

- cert-manager (TLS certificates)
- DNS (`*.opendesk.hrz.uni-marburg.de` → `192.168.3.201`)

## Integrates With

- All 25 services (HTTPS routing, TLS termination)
- [cert-manager](../cert-manager/) (ACME challenge routing)
- [Networking](../../platform/networking/) (DNS, proxy, timeouts)
- [Monitoring](../../platform/monitoring/) (haproxy_exporter metrics)
- [Operations](../../platform/operations/) (certificate rotation runbook)

## SLO

**Tier**: Critical (all service access depends on ingress)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | Uptime over 30-day window |
| **Request Latency (P95)** | <50ms (proxy latency, not backend) | haproxy_exporter |
| **Error Rate** | <0.1% (5xx from ingress) | haproxy_exporter response codes |

**Alerts**:
- Ingress down (`up{job="haproxy-ingress"} == 0`) for 2 minutes → Critical alert
- 5xx error rate >1% for 5 minutes → P2 alert
- TLS certificate expiry <7 days → P2 alert

## Disaster Recovery

**Tier**: Critical (RTO: 5 min, no data loss)

**Recovery Strategy**:
- HAProxy Ingress is stateless — redeployment restores full functionality
- No persistent data to recover

**Recovery Steps**:
1. Check pod status: `kubectl get pods -l app.kubernetes.io/name=haproxy-ingress`
2. If pods are failing: `kubectl delete pods -l app.kubernetes.io/name=haproxy-ingress`
3. Verify: `curl -I https://portal.opendesk.hrz.uni-marburg.de`

## Known Quirks

- **Shared IP**: Both `ingress-nginx` and `haproxy` share `192.168.3.201`. Services MUST use `ingressClassName: haproxy` unless they explicitly need nginx.
- **Planka annotation conflict**: Upstream Planka chart sets `kubernetes.io/ingress.class: nginx`. Remove the annotation and set `ingressClassName: haproxy`.
- **Nextcloud AIO probes**: Patch deployment to use `periodSeconds` instead of `initialDelaySeconds`.
