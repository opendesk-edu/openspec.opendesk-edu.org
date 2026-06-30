<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Redis

## Purpose

In-memory data store used as a distributed cache and session store for the
openDesk Edu platform. Provides caching for Keycloak (sessions, tokens),
Nextcloud (file locking), Element (message cache), Intercom Service (token
cache), SOGo (session cache), Notes (Y.js sync), and other services.

Redis runs as a single StatefulSet with RWO PVC, backed up via RDB snapshots
(not k8up — RWO PVCs excluded).

## Scope

- ✅ **In scope**: Redis server deployment, cache for Keycloak/Nextcloud/Element/SOGo/Notes, session management, RDB snapshot backup, monitoring via `redis_exporter`
- ❌ **Out of scope**: Redis Sentinel (HA), Redis Cluster (sharding), Redis Streams (pub/sub), application-specific key patterns

## Non-Goals

- Redis Sentinel or Cluster mode (single-node deployment only)
- Redis Streams as a message broker (use Matrix/Element instead)
- Persistent storage for application data (Redis is cache-only)

## Requirements

### Requirement: Shared Redis instance for platform caching

The platform SHALL deploy a single Redis instance serving all
Redis-dependent services via a shared `redis-headless` service.

#### Scenario: Multi-service caching
- GIVEN Redis StatefulSet with `replicaCount: 1`
- THEN the following services connect to `redis-headless`:
  - Keycloak (session cache, token cache)
  - Intercom Service (token cache)
  - Nextcloud (distributed file locking)
  - Element (Matrix message cache)
  - SOGo (session cache via Memcached — separate, see SOGo spec)
  - Notes (Y.js document synchronization)
- AND each service uses a unique key prefix to avoid collisions

### Requirement: Storage on Ceph RBD SSD

Redis SHALL use a ReadWriteOnce PVC provisioned from `ceph-rbd-ssd`
storage class for RDB persistence.

#### Scenario: PVC provisioning
- GIVEN Redis StatefulSet requesting a persistent volume
- WHEN the PVC is created with `storageClassName: ceph-rbd-ssd`
- THEN the volume is provisioned as a Ceph RBD image on SSD storage
- AND the volume is 1Gi capacity
- AND the PVC has annotation `k8up.io/exclude: "true"` (RWO exclusion)

### Requirement: RDB snapshot backup

Redis SHALL be backed up via RDB snapshots stored to MinIO S3.

#### Scenario: RDB snapshot to S3
- GIVEN Redis StatefulSet Pod with RWO PVC `data-redis-0`
- WHEN the backup job triggers an RDB snapshot
- THEN the snapshot is copied to MinIO S3 bucket `opendesk-backups`
- AND the snapshot includes all keys at the time of the dump

### Requirement: Cache flush procedure

Redis SHALL support selective and full cache flush for operational recovery.

#### Scenario: Full cache flush (emergency)
- GIVEN confirmed cache corruption (stale sessions, invalid tokens)
- WHEN `redis-cli FLUSHALL` is executed
- THEN all keys are cleared from Redis
- AND all users are logged out (Keycloak sessions invalidated)
- AND affected services must restart to rebuild their caches

#### Scenario: Selective key flush
- GIVEN stale cache for a specific service (e.g., Keycloak sessions)
- WHEN `redis-cli DEL keycloak:*` is executed via SCAN pattern
- THEN only Keycloak-related keys are removed
- AND other service caches remain intact

### Requirement: Monitoring via redis_exporter

Redis SHALL expose metrics at port 9121 via `redis_exporter`
for Prometheus scraping.

#### Scenario: Metrics collection
- GIVEN `redis_exporter` running alongside Redis
- WHEN Prometheus scrapes `http://<pod>:9121/metrics`
- THEN metrics include memory usage, key counts, connection stats,
  command rates, and hit/miss ratios

## Component Reference

| Component | Purpose | Replicas | Storage |
|-----------|---------|----------|---------|
| Redis Server | In-memory cache, session store | 1 (StatefulSet) | RWO PVC `data-redis-0` (1Gi, `ceph-rbd-ssd`) |
| redis_exporter | Prometheus metrics exporter | Sidecar | None |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| Redis Server | 999 (redis) | drop: ALL | RuntimeDefault |
| redis_exporter | 1001 | drop: ALL | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| Image | Redis (version managed by upstream chart) |
| PVC name | `data-redis-0` |
| Storage class | `ceph-rbd-ssd` |
| PVC size | 1Gi |
| Service name | `redis-headless` (headless service for DNS) |
| Metrics port | 9121 (redis_exporter) |
| Deploy stage | `010-infra` |
| RWO exclusion | `k8up.io/exclude: "true"` |
| Persistence | RDB snapshots |

## Service Consumers

| Service | Key Prefix | Use Case | Impact on FLUSHALL |
|---------|-----------|----------|-------------------|
| Keycloak | `keycloak:*` | Session cache, token cache | All users logged out |
| Intercom Service | `intercom:*` | Token cache | Re-authentication required |
| Nextcloud | `nextcloud:*` | Distributed file locking | File lock timeout (~30s) |
| Element | `element:*` | Matrix message cache | Message reload from DB |
| Notes | `notes:*` | Y.js document sync | Document re-sync from S3 |
| BigBlueButton | `bbb:*` | Chat/sessions (own Redis) | Not affected (separate) |
| Zammad | `zammad:*` | Session cache (own Redis) | Not affected (separate) |

## API Contracts

Redis does not expose external API contracts. It is an internal cache/store
consumed by services that have their own API contracts.

- [Intercom Silent Login](../../integrations/api-contracts/#contract-intercom-silent-login) — Intercom caches silent login tokens in Redis (key: `intercom:token:<consumer>:<target>`, TTL: 300s)
- [Keycloak OIDC Token](../../integrations/api-contracts/#contract-keycloak-oidc-token-endpoint) — Keycloak caches sessions/tokens in Redis

## Depends On

- Ceph CSI driver (`ceph-rbd-ssd` storage class)
- MinIO (S3 backup target for RDB snapshots)

## Integrates With

- [Keycloak](../keycloak/) (session/token cache)
- [Nextcloud](../nextcloud/) (file locking cache)
- [Element](../element/) (message cache)
- [Notes](../notes/) (Y.js document sync)
- [Backup](../../platform/backup/) (RDB snapshot schedules)
- [Monitoring](../../platform/monitoring/) (redis_exporter metrics)
- [Operations](../../platform/operations/) (cache flush runbook)

## SLO

**Tier**: Critical (foundation for multiple services)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | Uptime over 30-day window |
| **Latency (P95)** | <1ms (GET/SET) | redis_exporter command latency |
| **Memory Usage** | <80% max memory | redis_exporter `used_memory_bytes` |
| **Hit Ratio** | >80% | redis_exporter keyspace hits vs misses |

**Alerts**:
- Redis down (`up{job="redis"} == 0`) for 5 minutes → Critical alert
- Memory usage >80% for 15 minutes → P3 alert
- Hit ratio <50% for 30 minutes → P4 info

**Capacity**:
- 1Gi storage
- Memory-limited by container resources

## Disaster Recovery

**Tier**: Critical (RPO: 24h via RDB snapshot, RTO: 5 min)

**Backup Strategy**:
- Daily RDB snapshot to S3 bucket `opendesk-backups`
- Redis is cache-first — data loss is recoverable from source databases

**Recovery Order**:
1. Restore PVC from RDB snapshot (or accept cache loss)
2. Restart Redis pod
3. Restart dependent services to rebuild caches

**Failure Scenarios**:
- **PVC corruption**: Accept cache loss, restart Redis, services rebuild from source
- **OOM kill**: Increase memory limit, restart Redis
- **Cache corruption**: `FLUSHALL` all keys, restart dependent services

## Known Quirks

- **FLUSHALL impact**: Flushing Redis logs out ALL users across all services. Use only as last resort. Prefer selective key deletion.
- **Cache-only**: Redis stores no authoritative data. All cached data can be rebuilt from source databases (PostgreSQL, MariaDB, S3).
- **BigBlueButton and Zammad**: These services run their own separate Redis instances, NOT the shared `redis-headless`. FLUSHALL on shared Redis does NOT affect them.
- **Key prefix collisions**: Each service MUST use a unique key prefix. Missing prefixes cause cross-service cache pollution.
