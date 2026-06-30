<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# cert-manager

## Purpose

Automated TLS certificate management for the openDesk Edu platform. Issues,
renews, and manages X.509 certificates for all Ingress resources, supporting
both Let's Encrypt (ACME) automatic issuance and pre-existing institutional
certificates.

cert-manager ensures all services have valid TLS certificates without manual
intervention, with automatic renewal before expiration.

## Scope

- ✅ **In scope**: Certificate issuance via ACME (Let's Encrypt), certificate renewal, ClusterIssuer configuration, pre-existing certificate support, certificate validation, Certificate CRD management
- ❌ **Out of scope**: Ingress routing (see `../haproxy-ingress/`), DNS management (see `../../platform/networking/`), internal mTLS between services

## Non-Goals

- Manual certificate management (cert-manager automates this)
- Internal service-to-service mTLS (not required for current platform)
- Certificate pinning or HSTS enforcement (service-level configuration)
- Wildcard certificate automation (each service gets its own certificate)

## Requirements

### Requirement: Automatic TLS certificate issuance

cert-manager SHALL automatically issue TLS certificates for all Ingress
resources using the configured ClusterIssuer.

#### Scenario: Certificate issued via Let's Encrypt
- GIVEN cert-manager installed with a `ClusterIssuer` configured for Let's Encrypt
- AND an Ingress resource with `ingressClassName: haproxy` and TLS configuration
- WHEN the Ingress is created
- THEN cert-manager requests a certificate from Let's Encrypt (ACME HTTP-01 challenge)
- AND the certificate is stored in a Kubernetes secret
- AND the Ingress references the secret for TLS termination

#### Scenario: Certificate auto-renewal
- GIVEN a certificate issued by cert-manager
- WHEN the certificate approaches expiration (30 days before)
- THEN cert-manager automatically renews the certificate
- AND the new certificate replaces the old one in the Kubernetes secret
- AND there is no service disruption during renewal

### Requirement: Pre-existing certificate support

cert-manager SHALL support using pre-existing institutional certificates
instead of ACME-issued certificates.

#### Scenario: Institutional certificate deployment
- GIVEN a TLS certificate provided by the university (institutional CA)
- WHEN certificate management is disabled in configuration
- THEN the Ingress references the provided Kubernetes secret directly
- AND no cert-manager `Certificate` CRD is deployed for that service
- AND no ACME challenge is initiated

### Requirement: ClusterIssuer configuration

cert-manager SHALL be configured with at least one `ClusterIssuer` for
certificate issuance.

#### Scenario: Let's Encrypt ClusterIssuer
- GIVEN cert-manager deployed in the cluster
- THEN a `ClusterIssuer` of type `acme` is configured with:
  - Server: Let's Encrypt production (`https://acme-v02.api.letsencrypt.org/directory`)
  - Solver: HTTP-01 (via HAProxy Ingress)
  - Email: platform administrator email
- AND the issuer is available to all namespaces

### Requirement: Certificate validation

Certificates SHALL be validated before deployment to prevent service
disruption.

#### Scenario: Certificate expiry check
- GIVEN a TLS certificate stored in a Kubernetes secret
- WHEN the certificate is checked for expiration
- THEN `notAfter` date is more than 30 days in the future
- AND browser clients do not show `NET::ERR_CERT_DATE_INVALID`

#### Scenario: Certificate chain validation
- GIVEN a certificate issued by Let's Encrypt or institutional CA
- WHEN a client connects via HTTPS
- THEN the certificate chain is valid
- AND no `CERT_AUTHORITY_INVALID` errors occur

## Component Reference

| Component | Purpose | Namespace |
|-----------|---------|-----------|
| cert-manager Controller | Certificate issuance, renewal, management | `cert-manager` |
| cert-manager Webhook | Admission/validation webhook | `cert-manager` |
| cert-manager cainjector | CA certificate injection into ConfigMaps | `cert-manager` |
| ClusterIssuer | ACME issuer configuration | Cluster-scoped |

## Configuration Reference

| Property | Value |
|----------|-------|
| ACME Server | `https://acme-v02.api.letsencrypt.org/directory` (production) |
| Challenge Type | HTTP-01 (via HAProxy Ingress) |
| Certificate Secret | `opendesk-certificates-tls` (wildcard/primary) |
| Deploy stage | Pre-infra (required before Ingress resources) |
| Namespace | `cert-manager` |

## Services Using cert-manager

| Service | Domain | Certificate Method |
|---------|--------|-------------------|
| Keycloak | `keycloak.opendesk.hrz.uni-marburg.de` | ACME (Let's Encrypt) |
| Nubus Portal | `portal.opendesk.hrz.uni-marburg.de` | ACME (Let's Encrypt) |
| Nextcloud | `nextcloud.opendesk.hrz.uni-marburg.de` | ACME (Let's Encrypt) |
| OpenCloud | `opencloud.opendesk.hrz.uni-marburg.de` | ACME (Let's Encrypt) |
| All services | `*.opendesk.hrz.uni-marburg.de` | ACME or institutional |

## API Contracts

cert-manager does not expose service-level API contracts. It manages
TLS certificates for services that have their own API contracts.

- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — cert-manager issues TLS cert for Keycloak endpoint
- [Keycloak SAML 2.0 SP-SSO](../../integrations/api-contracts/#contract-keycloak-saml-20-sp-initiated-sso) — cert-manager issues TLS certs for all SAML SP endpoints
- [Intercom Silent Login](../../integrations/api-contracts/#contract-intercom-silent-login) — cert-manager issues TLS cert for Intercom endpoint
- All 13 contracts in the [Contract Index](../../integrations/api-contracts/#contract-index) depend on cert-manager for TLS

## Depends On

- HAProxy Ingress (HTTP-01 challenge solver)
- DNS (`*.opendesk.hrz.uni-marburg.de` → `192.168.3.201`)
- Internet access (ACME validation requires outbound HTTPS to Let's Encrypt)

## Integrates With

- [HAProxy Ingress](../haproxy-ingress/) (TLS termination, ACME challenge routing)
- [Networking](../../platform/networking/) (DNS, proxy configuration)
- [Operations](../../platform/operations/) (certificate rotation runbook)

## SLO

**Tier**: Critical (certificate expiration = service outage)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Certificate Validity** | >30 days remaining | `kubectl get secret` + `openssl x509 -noout -dates` |
| **Renewal Success Rate** | 100% | cert-manager events |
| **Issuance Latency** | <5 minutes | Time from Ingress creation to valid cert |

**Alerts**:
- Certificate expiring in <7 days → P2 alert
- Certificate issuance failure → P3 alert
- ACME challenge failure → P3 alert

## Disaster Recovery

**Tier**: Non-critical (certificates are re-issuable)

**Recovery Strategy**:
- Certificates can be re-issued at any time from Let's Encrypt
- Institutional certificates can be re-deployed from files in `helmfile/files/certificates/`
- No data loss — certificates are ephemeral by nature

**Recovery Steps**:
1. Delete stuck Certificate CRD: `kubectl delete certificate <name>`
2. Re-create Certificate or re-deploy Ingress
3. Verify new certificate issued

## Known Quirks

- **HTTP-01 challenge**: Requires HAProxy Ingress to route ACME challenge requests (`/.well-known/acme-challenge/`) to the cert-manager solver pod.
- **Rate limits**: Let's Encrypt has issuance rate limits (50 certificates per registered domain per week). Do not delete and re-create certificates unnecessarily.
- **Pre-existing certs**: Some services use institutional certificates instead of Let's Encrypt. These require manual rotation when they expire (see [Operations runbook](../../platform/operations/)).
