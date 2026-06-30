<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Keycloak

## Purpose

OIDC/SAML 2.0 identity provider (IdP) for the openDesk Edu platform. Provides
authentication, single sign-on (SSO), token issuance, and user session
management. Runs as part of the Nubus IAM stack with a dedicated PostgreSQL
database.

Keycloak is the central authentication authority — all services authenticate
users through Keycloak via OIDC (9 services) or SAML 2.0 (8 services).

## Scope

- ✅ **In scope**: Keycloak IdP deployment, realm `opendesk` configuration, OIDC client management (19 clients), SAML 2.0 SP entity management (8 SPs), session management, token issuance, DFN-AAI federation, health endpoints
- ❌ **Out of scope**: OpenLDAP directory (see `../nubus/`), UMS REST API (see `../nubus/`), Portal frontend (see `../nubus/`), SCIM provisioning (future)

## Non-Goals

- OpenLDAP schema and user directory management (Nubus responsibility)
- UMS REST API provisioning (Nubus responsibility)
- SCIM provisioning protocol (planned future enhancement)
- Keycloak theme customization (managed by Nubus upstream)

## Requirements

### Requirement: Realm configuration

Keycloak SHALL run with realm `opendesk` and pre-configured OIDC clients and
SAML 2.0 SP entities for all platform services.

#### Scenario: OIDC client pre-configuration
- GIVEN Keycloak realm `opendesk`
- THEN 19 OIDC clients are pre-configured with redirect URIs:
  - `sogo`, `opendesk-opencloud`, `opendesk-matrix` (Element), `opendesk-jitsi`,
    `opendesk-xwiki`, `opendesk-planka`, `opendesk-etherpad`, `opendesk-notes`,
    `opendesk-typo3`
- AND each client has a unique client secret stored in Kubernetes secrets

#### Scenario: SAML 2.0 SP pre-configuration
- GIVEN Keycloak realm `opendesk`
- THEN 8 SAML 2.0 SP entities are pre-configured:
  - Nextcloud, BigBlueButton, ILIAS, Moodle, BookStack, Zammad, OpenProject, OX AppSuite
- AND all SPs trust the Keycloak SAML IdP (Shibboleth protocol)
- AND entity IDs match service URLs (e.g., `https://nextcloud.opendesk.hrz.uni-marburg.de`)

### Requirement: OIDC token endpoint

Keycloak SHALL expose the OIDC token endpoint at
`/realms/opendesk/protocol/openid-connect/token` for all OIDC clients.

#### Scenario: Client credentials token issuance
- GIVEN an OIDC client with valid `client_id` and `client_secret`
- WHEN a POST request is made to the token endpoint with `grant_type=client_credentials`
- THEN Keycloak returns a valid JWT `access_token`
- AND the token includes realm roles and client scopes

#### Scenario: Authorization code flow
- GIVEN a user authenticating via a browser redirect
- WHEN the service initiates the OIDC authorization code flow
- THEN Keycloak authenticates the user and redirects back with an authorization code
- AND the service exchanges the code for tokens at the token endpoint

### Requirement: SAML 2.0 SP-initiated SSO

Keycloak SHALL support Shibboleth SAML 2.0 SP-initiated SSO for all SAML-using
services.

#### Scenario: SAML authentication flow
- GIVEN a user accessing a SAML-protected service (e.g., ILIAS)
- WHEN the SP generates an `AuthnRequest` and redirects to Keycloak
- THEN Keycloak authenticates the user and generates a `SAMLResponse`
- AND POSTs the response to the SP's ACS URL
- AND the user is logged in without re-authentication

### Requirement: DFN-AAI federation

Keycloak SHALL support federated identity via DFN-AAI (German research network
identity federation), linking external academic identities to local Keycloak
accounts.

#### Scenario: Federated user login
- GIVEN a user with a DFN-AAI identity (e.g., `bob@ethz.ch`)
- WHEN the user selects DFN-AAI as the identity provider on the Keycloak login page
- THEN Keycloak redirects to the DFN-AAI IdP
- AND upon successful authentication, the DFN-AAI identity is linked to a local Keycloak account
- AND the user can access all authorized platform services

### Requirement: Health endpoints

Keycloak SHALL expose liveness and readiness probes at `/health/live` and
`/health/ready` respectively.

#### Scenario: Liveness probe
- GIVEN Keycloak is running
- WHEN the liveness probe hits `/health/live`
- THEN Keycloak returns HTTP 200

#### Scenario: Readiness probe
- GIVEN Keycloak is ready to accept requests (database connected, realm loaded)
- WHEN the readiness probe hits `/health/ready`
- THEN Keycloak returns HTTP 200

## Component Reference

| Component | Purpose | Replicas | Storage |
|-----------|---------|----------|---------|
| Keycloak Server | OIDC/SAML IdP, session management | 1 (StatefulSet) | RWO PVC `data-keycloak-0` (10Gi, `ceph-rbd-ssd`) |
| PostgreSQL | Keycloak user/session/client data | 1 (shared, Nubus) | RWO PVC `data-postgresql-0` (10Gi, `ceph-rbd-ssd`) |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| Keycloak Server | 1001 (keycloak) | drop: ALL | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| Realm | `opendesk` |
| Base URL | `https://keycloak.opendesk.hrz.uni-marburg.de` |
| Token endpoint | `/realms/opendesk/protocol/openid-connect/token` |
| OIDC clients | 19 pre-configured |
| SAML SP entities | 8 pre-configured |
| Health live | `/health/live` |
| Health ready | `/health/ready` |
| Deploy stage | `010-infra` |
| Storage class | `ceph-rbd-ssd` (RWO, `k8up.io/exclude: "true"`) |

## API Contracts

- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — authentication
- [Keycloak SAML 2.0 SP-SSO](../../integrations/api-contracts/#contract-keycloak-saml-20-sp-initiated-sso) — SAML authentication
- [SAML POST Metadata (DFN-AAI)](../../integrations/api-contracts/#contract-saml-post-metadata-dfn-aai-idp-registration) — federation
- [LDAP Bind/Search](../../integrations/api-contracts/#contract-ldap-bind-and-search) — user directory lookup

## Depends On

- PostgreSQL (Keycloak database)
- OpenLDAP (user directory, via Nubus)
- HAProxy Ingress (TLS termination, routing)
- cert-manager (TLS certificate for `keycloak.opendesk.hrz.uni-marburg.de`)

## Integrates With

- All 25 services (OIDC or SAML authentication)
- [Nubus](../nubus/) (IAM stack, Portal, UMS REST API)
- [Intercom](../../integrations/cross-service-workflows/) (portal tile SSO navigation)
- [Provisioning](../../integrations/provisioning/) (federated account linking)

## SLO

**Tier**: Critical (foundation for all authentication)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% (43.2 min downtime/month max) | Uptime over 30-day window |
| **Latency (P95)** | <100ms (OIDC token issuance) | Prometheus histogram from Keycloak metrics |
| **Error Rate** | <0.1% (authentication failures) | Failed login ratio vs total attempts |

**Alerts**:
- Keycloak OIDC endpoint error rate >1% for 5 minutes → P2 alert
- Keycloak health probe failures for 2 minutes → P1 alert
- PostgreSQL connection failures for Keycloak → P2 alert

**Capacity**:
- 5,000 concurrent authenticated users (typical semester load)
- 50,000 OIDC token issuances per hour (peak: exam periods)

## Disaster Recovery

**Tier**: Critical (RPO: 5 min, RTO: 30 min)

**Backup Strategy**:
- **PostgreSQL** (Keycloak database): Hourly incremental + daily full backup, PITR enabled
- **Configuration**: GitOps-managed via ArgoCD

**Recovery Order**:
1. PostgreSQL cluster (Keycloak database) - 5 min
2. Keycloak realm import - 2 min
3. Verify token issuance and SAML SP connectivity - 3 min

**Failure Scenarios**:
- **Database corruption**: Restore from PITR, re-apply recent realm changes
- **JWT key mismatch**: Rollback Keycloak deployment to previous version

## Known Quirks

- **Nubus-managed**: Keycloak realm configuration is managed by Nubus upstream. Direct realm modifications should use UMC, not Keycloak admin console.
- **Token validation failure**: If Keycloak database is corrupted, JWT signature verification fails. All services return 401. Restore from PITR backup (see [Operations runbook](../../platform/operations/)).
- **Session invalidation on FLUSHALL**: If Redis is flushed (`FLUSHALL`), all Keycloak sessions are invalidated, logging out all users.
