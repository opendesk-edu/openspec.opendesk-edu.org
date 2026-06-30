<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# PostgreSQL

## Purpose

Shared relational database service for the openDesk Edu platform. Provides
PostgreSQL database instances for Keycloak (IAM), Element (Matrix), Notes,
Planka, SOGo, XWiki, Dovecot, and other OIDC-authenticated services.

PostgreSQL runs as a single StatefulSet with RWO PVC on Ceph RBD SSD storage,
backed up via native `pg_dump` (not k8up — RWO PVCs are excluded from the main
backup schedule).

## Scope

- ✅ **In scope**: PostgreSQL server deployment, database provisioning per service, user/role management, native backup via `pg_dump`, PVC storage management, monitoring via `postgres_exporter`
- ❌ **Out of scope**: MariaDB (see `../mariadb/`), application-specific schema migrations, connection pooling (PgBouncer), replication/HA clustering

## Non-Goals

- MariaDB (separate database server, see `../mariadb/`)
- PgBouncer or other connection poolers (application-managed pooling)
- Streaming replication / Patroni HA (single-node deployment)
- Schema migrations (each application manages its own)

## Requirements

### Requirement: Single shared PostgreSQL instance

The platform SHALL deploy a single PostgreSQL StatefulSet serving all
PostgreSQL-dependent services via separate databases.

#### Scenario: Multi-database hosting
- GIVEN PostgreSQL StatefulSet with `replicaCount: 1`
- THEN separate databases are created for each service:
  - `keycloak` (Keycloak IAM data)
  - `element` (Matrix Synapse homeserver)
  - `notes` (Notes file metadata)
  - `planka` (Planka project board)
  - `sogo` (SOGo groupware)
  - `xwiki` (XWiki wiki content)
  - `dovecot` (Dovecot IMAP mail store)
- AND each database has a dedicated user with least-privilege access

### Requirement: Storage on Ceph RBD SSD

PostgreSQL SHALL use a ReadWriteOnce PVC provisioned from `ceph-rbd-ssd`
storage class for optimal database I/O performance.

#### Scenario: PVC provisioning
- GIVEN PostgreSQL StatefulSet requesting a persistent volume
- WHEN the PVC is created with `storageClassName: ceph-rbd-ssd`
- THEN the volume is provisioned as a Ceph RBD image on SSD storage
- AND the volume is 10Gi capacity
- AND the PVC has annotation `k8up.io/exclude: "true"` (RWO exclusion)

### Requirement: Native backup via pg_dump

PostgreSQL PVCs SHALL be backed up via native `pg_dump` within the
PostgreSQL pod (not via k8up RWO mount, which would fail on multi-node).

#### Scenario: Daily pg_dump to S3
- GIVEN PostgreSQL StatefulSet Pod with RWO PVC `data-postgresql-0`
- WHEN the backup job runs on the same node as PostgreSQL
- THEN `pg_dump --all` is executed inside the pod
- AND the dump is streamed to MinIO S3 bucket `opendesk-backups` via `mc cp`

#### Scenario: Backup validation
- GIVEN a fresh PostgreSQL PVC
- WHEN restored from the latest `pg_dump` backup
- THEN all databases are present (`keycloak`, `element`, `notes`, `planka`, etc.)
- AND all database users have correct permissions

### Requirement: Monitoring via postgres_exporter

PostgreSQL SHALL expose metrics at port 9187 via `postgres_exporter`
for Prometheus scraping.

#### Scenario: Metrics collection
- GIVEN `postgres_exporter` running alongside PostgreSQL
- WHEN Prometheus scrapes `http://<pod>:9187/metrics`
- THEN metrics include connection counts, lock counts, replication status, and query performance

## Component Reference

| Component | Purpose | Replicas | Storage |
|-----------|---------|----------|---------|
| PostgreSQL Server | Relational database | 1 (StatefulSet) | RWO PVC `data-postgresql-0` (10Gi, `ceph-rbd-ssd`) |
| postgres_exporter | Prometheus metrics exporter | Sidecar | None |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| PostgreSQL Server | 999 (postgres) | drop: ALL | RuntimeDefault |
| postgres_exporter | 1001 | drop: ALL | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| Image | PostgreSQL (version managed by upstream chart) |
| PVC name | `data-postgresql-0` |
| Storage class | `ceph-rbd-ssd` |
| PVC size | 10Gi |
| Metrics port | 9187 (postgres_exporter) |
| Deploy stage | `010-infra` |
| RWO exclusion | `k8up.io/exclude: "true"` |

## Database Catalog

| Database | Service | Notes |
|----------|---------|-------|
| `keycloak` | Keycloak | Users, sessions, clients, roles |
| `element` | Element (Matrix) | Synapse homeserver data |
| `notes` | Notes | File metadata, Y.js documents |
| `planka` | Planka | Project boards, cards |
| `sogo` | SOGo | Calendar, contacts, mail metadata |
| `xwiki` | XWiki | Wiki pages, attachments |
| `dovecot` | Dovecot | IMAP mail store, user mailboxes |

## API Contracts

PostgreSQL does not expose external API contracts. It is a consumer of
platform contracts and an internal data store.

- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — consumed indirectly (Keycloak stores sessions in PostgreSQL)

## Depends On

- Ceph CSI driver (`ceph-rbd-ssd` storage class)
- MinIO (S3 backup target for `pg_dump` output)

## Integrates With

- [Keycloak](../keycloak/) (IAM database)
- [Element](../element/) (Matrix database)
- [Notes](../notes/) (file metadata database)
- [Planka](../planka/) (project board database)
- [SOGo](../sogo/) (groupware database)
- [XWiki](../xwiki/) (wiki database)
- [Backup](../../platform/backup/) (pg_dump schedules)
- [Monitoring](../../platform/monitoring/) (postgres_exporter metrics)

## SLO

**Tier**: Critical (foundation for multiple services)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | Uptime over 30-day window |
| **Query Latency (P95)** | <50ms | postgres_exporter query duration histogram |
| **Connection Pool** | <80% max connections | postgres_exporter connection count |

**Alerts**:
- PostgreSQL down (`mysql_up == 0`) for 5 minutes → Critical alert
- Connection count >80% max for 10 minutes → P3 alert
- Replication lag (if enabled) >30 seconds → P2 alert

**Capacity**:
- 200 max connections
- 10Gi storage (expandable via PVC resize)

## Disaster Recovery

**Tier**: Critical (RPO: 24h via daily pg_dump, RTO: 30 min)

**Backup Strategy**:
- Daily `pg_dump --all` to S3 bucket `opendesk-backups`
- Backup job runs on same node as PostgreSQL (RWO constraint)

**Recovery Order**:
1. Restore PVC from latest `pg_dump` backup
2. Restart PostgreSQL pod
3. Verify all databases present

**Failure Scenarios**:
- **PVC corruption**: Delete PVC, restore from `pg_dump`, recreate StatefulSet pod
- **Data loss**: Restore from latest S3 backup (up to 24h data loss)

## Known Quirks

- **Single node**: No replication or HA. All services depending on PostgreSQL share a single point of failure.
- **RWO constraint**: Backup pods must run on the same node as PostgreSQL pod (cannot mount RWO PVC across nodes).
- **Helm password sync**: Passwords are managed via Helm values. Password changes require Helm upgrade.
