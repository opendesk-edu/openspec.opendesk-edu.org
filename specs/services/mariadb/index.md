<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# MariaDB

## Purpose

Shared relational database service with Galera cluster support for the openDesk
Edu platform. Provides MariaDB database instances for Nextcloud, OpenCloud,
OX AppSuite, ILIAS, Moodle, BigBlueButton, BookStack, OpenProject, Zammad,
LimeSurvey, Dovecot-Postfix, and other SAML/LDAP-authenticated services.

MariaDB runs as a StatefulSet (optionally with Galera replication) on Ceph RBD
SSD storage, backed up via native `mysqldump` (not k8up — RWO PVCs excluded).

## Scope

- ✅ **In scope**: MariaDB server deployment, Galera cluster support (HA), database provisioning per service, user/role management, native backup via `mysqldump`, PVC storage management, monitoring via `mariadb_exporter`, password synchronization
- ❌ **Out of scope**: PostgreSQL (see `../postgresql/`), application-specific schema migrations, MySQL Router / ProxySQL

## Non-Goals

- PostgreSQL (separate database server, see `../postgresql/`)
- Connection pooling proxies (MySQL Router, ProxySQL)
- NDB cluster or other storage engines (InnoDB only)

## Requirements

### Requirement: Shared MariaDB instance with Galera support

The platform SHALL deploy MariaDB as a StatefulSet with optional Galera cluster
replication for high availability.

#### Scenario: Multi-database hosting
- GIVEN MariaDB StatefulSet with `replicaCount: 1` (or `2` for Galera)
- THEN separate databases are created for each service:
  - `nextcloud` (Nextcloud file metadata, user config)
  - `opencloud` (OpenCloud CS3 metadata)
  - `ox` (OX AppSuite groupware)
  - `ilias` (ILIAS LMS data, course content)
  - `moodle` (Moodle LMS data)
  - `bigbluebutton` (BigBlueButton recordings metadata)
  - `bookstack` (BookStack documentation)
  - `openproject` (OpenProject project management)
  - `zammad` (Zammad ticket system)
  - `limesurvey` (LimeSurvey survey data)
  - `dovecot` (Dovecot mail metadata, Postfix lookup tables)
- AND each database has a dedicated user with least-privilege access

### Requirement: Storage on Ceph RBD SSD

MariaDB SHALL use a ReadWriteOnce PVC provisioned from `ceph-rbd-ssd`
storage class for optimal database I/O performance.

#### Scenario: PVC provisioning
- GIVEN MariaDB StatefulSet requesting a persistent volume
- WHEN the PVC is created with `storageClassName: ceph-rbd-ssd`
- THEN the volume is provisioned as a Ceph RBD image on SSD storage
- AND the volume is 10Gi capacity (per-node)
- AND the PVC has annotation `k8up.io/exclude: "true"` (RWO exclusion)

### Requirement: Native backup via mysqldump

MariaDB PVCs SHALL be backed up via native `mysqldump` within the
MariaDB pod (not via k8up RWO mount).

#### Scenario: Daily mysqldump to S3
- GIVEN MariaDB StatefulSet Pod with RWO PVC `mariadb-galera-data`
- WHEN the backup job runs on the same node as MariaDB primary
- THEN `mysqldump --all-databases` is executed inside the pod
- AND the dump is streamed to MinIO S3 bucket `opendesk-backups` via `mc cp`

#### Scenario: Per-node backup (multi-node Galera)
- GIVEN MariaDB Galera with 2 nodes (primary + secondary)
- WHEN backup jobs run on each node independently
- THEN each node's backup is tagged with the node name
- AND backups do not interfere with Galera replication

#### Scenario: Backup validation
- GIVEN a fresh MariaDB PVC
- WHEN restored from the latest `mysqldump` backup
- THEN all databases are present (`nextcloud`, `ilias`, `moodle`, etc.)
- AND all database users have correct permissions and passwords

### Requirement: Helm password synchronization

Helm-deployed MariaDB passwords MUST be synchronized with the running MariaDB
instance. Helm generates new passwords on each upgrade, but MariaDB retains
the original password set during initial deployment.

#### Scenario: Password mismatch after upgrade
- GIVEN a MariaDB instance deployed via Helm with a generated password
- WHEN the Helm release is upgraded with a new generated password
- THEN the database retains the original password
- AND service pods fail to connect with `SQLSTATE[HY000] [2002] Connection refused`
- AND the operator MUST run `ALTER USER` to sync the Helm-managed value

**Prevention**: Verify password sync BEFORE `helmfile apply`. See
[Operations runbook](../../platform/operations/).

### Requirement: Monitoring via mariadb_exporter

MariaDB SHALL expose metrics at port 9104 via `mariadb_exporter`
for Prometheus scraping.

#### Scenario: Metrics collection
- GIVEN `mariadb_exporter` running alongside MariaDB
- WHEN Prometheus scrapes `http://<pod>:9104/metrics`
- THEN metrics include query counts, connection stats, replication status,
  and Galera cluster health

## Component Reference

| Component | Purpose | Replicas | Storage |
|-----------|---------|----------|---------|
| MariaDB Server | Relational database (InnoDB) | 1-2 (StatefulSet, Galera) | RWO PVC `mariadb-galera-data` (10Gi/node, `ceph-rbd-ssd`) |
| mariadb_exporter | Prometheus metrics exporter | Sidecar | None |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| MariaDB Server | 999 (mysql) | drop: ALL | RuntimeDefault |
| mariadb_exporter | 1001 | drop: ALL | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| Image | MariaDB (version managed by upstream chart) |
| PVC name | `mariadb-galera-data` |
| Storage class | `ceph-rbd-ssd` |
| PVC size | 10Gi per node |
| Metrics port | 9104 (mariadb_exporter) |
| Deploy stage | `010-infra` |
| RWO exclusion | `k8up.io/exclude: "true"` |
| Galera support | Yes (optional, `replicaCount: 2` for HA) |

## Database Catalog

| Database | Service | Auth Method | Notes |
|----------|---------|-------------|-------|
| `nextcloud` | Nextcloud | SAML 2.0 | File metadata, app config |
| `opencloud` | OpenCloud | OIDC | CS3 metadata, Graph service |
| `ox` | OX AppSuite | SAML 2.0 | Groupware, mail, calendar |
| `ilias` | ILIAS | SAML 2.0 | LMS data, SCORM, assessments |
| `moodle` | Moodle | SAML 2.0 | LMS data, courses, quizzes |
| `bigbluebutton` | BigBlueButton | SAML 2.0 | Meeting recordings metadata |
| `bookstack` | BookStack | SAML 2.0 | Documentation shelves/pages |
| `openproject` | OpenProject | SAML 2.0 | Projects, work packages |
| `zammad` | Zammad | SAML 2.0 | Tickets, customer data |
| `limesurvey` | LimeSurvey | LDAP | Survey responses |
| `dovecot` | Dovecot-Postfix | LDAP | Mail metadata, alias maps |

## API Contracts

MariaDB does not expose external API contracts. It is a consumer of
platform contracts and an internal data store.

- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — consumed indirectly (services authenticate via Keycloak before accessing MariaDB)
- [LDAP Bind/Search](../../integrations/api-contracts/#contract-ldap-bind-and-search) — consumed by LimeSurvey (LDAP auth before MariaDB query)

## Depends On

- Ceph CSI driver (`ceph-rbd-ssd` storage class)
- MinIO (S3 backup target for `mysqldump` output)

## Integrates With

- [Nextcloud](../nextcloud/) (file metadata database)
- [OpenCloud](../opencloud/) (CS3 metadata database)
- [OX AppSuite](../ox-appsuite/) (groupware database)
- [ILIAS](../ilias/) (LMS database)
- [Moodle](../moodle/) (LMS database)
- [BigBlueButton](../bigbluebutton/) (recordings metadata)
- [BookStack](../bookstack/) (documentation database)
- [OpenProject](../openproject/) (project management database)
- [Zammad](../zammad/) (ticket system database)
- [LimeSurvey](../limesurvey/) (survey database)
- [Dovecot-Postfix](../dovecot-postfix/) (mail metadata database)
- [Backup](../../platform/backup/) (mysqldump schedules)

## SLO

**Tier**: Critical (foundation for multiple services)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | Uptime over 30-day window |
| **Query Latency (P95)** | <100ms | mariadb_exporter query duration |
| **Galera Sync** | <1s replication lag | Galera wsrep metrics |

**Alerts**:
- MariaDB down (`mysql_up == 0`) for 5 minutes → Critical alert
- Galera replication desync for 10 minutes → P2 alert
- Connection count >80% max for 10 minutes → P3 alert

**Capacity**:
- 500 max connections
- 10Gi storage per node (expandable via PVC resize)

## Disaster Recovery

**Tier**: Critical (RPO: 24h via daily mysqldump, RTO: 30 min)

**Backup Strategy**:
- Daily `mysqldump --all-databases` to S3 bucket `opendesk-backups`
- Backup job runs on same node as MariaDB primary (RWO constraint)

**Recovery Order**:
1. Restore PVC from latest `mysqldump` backup
2. Restart MariaDB pod(s)
3. If Galera: verify cluster sync
4. Verify all databases present and passwords match Helm values

**Failure Scenarios**:
- **PVC corruption**: Delete PVC, restore from `mysqldump`, recreate StatefulSet pod
- **Galera split-brain**: Force quorum on surviving node, re-bootstrap cluster
- **Password desync**: Run `ALTER USER` to sync with Helm values

## Known Quirks

- **Password desync**: Helm generates new passwords on upgrade. MariaDB retains old password. See [Operations runbook](../../platform/operations/).
- **Transient connection failures**: Newly created pods MAY experience `Connection refused` on first attempt. Applications MUST retry with backoff (5 attempts, 10s sleep).
- **SETUID/SETGID**: MariaDB init scripts require SETUID/SETGID capabilities. This is an accepted exception to the platform's capability drop policy.
- **BigBlueButton**: BBB requires its own MariaDB instance or a separate database. Cross-reference with BBB chart values.
