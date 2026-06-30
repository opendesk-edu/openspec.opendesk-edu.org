<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# MinIO

## Purpose

S3-compatible object storage for the openDesk Edu platform. Provides object
storage for application files, k8up backup targets, ILIAS course content, and
other services requiring S3 API access.

MinIO runs as a single StatefulSet exposing an S3 API endpoint, used by
Nextcloud (S3 primary storage), OpenCloud (S3 backend), ILIAS (course files),
Notes (Y.js documents), Planka (attachments), and k8up (backup target).

## Scope

- ✅ **In scope**: MinIO server deployment, S3 API endpoint, bucket management, access key management, monitoring via MinIO metrics, k8up backup target
- ❌ **Out of scope**: Ceph RBD/CephFS storage (see `../../platform/storage/`), SeaweedFS (separate S3-compatible store), S3 lifecycle policies (bucket-level, application-managed)

## Non-Goals

- Ceph CSI storage classes (see [Storage platform spec](../../platform/storage/))
- SeaweedFS S3-compatible storage (separate deployment)
- CDN or edge caching of S3 objects
- Cross-region S3 replication

## Requirements

### Requirement: S3-compatible API endpoint

MinIO SHALL expose an S3-compatible API at cluster-internal URL
`http://minio:9000` for all platform services.

#### Scenario: Service connects to MinIO
- GIVEN a service requiring S3 storage (e.g., Nextcloud)
- WHEN the service connects to `http://minio:9000`
- THEN the S3 API is accessible with valid access key and secret key
- AND the service can perform standard S3 operations (PUT, GET, DELETE, LIST)

#### Scenario: Bucket access
- GIVEN a service configured with bucket name and credentials
- WHEN the service performs S3 operations
- THEN operations are scoped to the configured bucket only
- AND the service cannot access other service buckets

### Requirement: Storage provisioning

MinIO SHALL use persistent storage for object data.

#### Scenario: PVC provisioning
- GIVEN MinIO StatefulSet requesting a persistent volume
- WHEN the PVC is created with the configured storage class
- THEN the volume is provisioned for MinIO object data
- AND the PVC has annotation `k8up.io/exclude: "true"` (RWO exclusion)

### Requirement: k8up backup target

MinIO SHALL serve as the S3-compatible backup target for k8up and native
database backup jobs.

#### Scenario: k8up backup to MinIO
- GIVEN k8up Schedule configured with S3 backend
- WHEN a backup job runs
- THEN the backup is streamed to MinIO S3 bucket `opendesk-backups`
- AND MinIO is accessible from backup pods via `http://minio:9000`

#### Scenario: Database dump to MinIO
- GIVEN a native database backup job (PostgreSQL `pg_dump`, MariaDB `mysqldump`)
- WHEN the backup completes
- THEN the dump file is copied to MinIO via `mc cp`
- AND the file is stored in `opendesk-backups` bucket

### Requirement: Monitoring via MinIO metrics

MinIO SHALL expose cluster metrics at `/minio/v2/metrics/cluster` on port 9000
for Prometheus scraping.

#### Scenario: Metrics collection
- GIVEN MinIO running with metrics enabled
- WHEN Prometheus scrapes `http://minio:9000/minio/v2/metrics/cluster`
- THEN metrics include bucket usage, API operation counts, health status,
  and request latency

## Component Reference

| Component | Purpose | Replicas | Storage |
|-----------|---------|----------|---------|
| MinIO Server | S3-compatible object storage | 1 (StatefulSet) | RWO PVC (size per chart config) |

## Security Context

| Component | RunAsUser | Capabilities | Seccomp |
|-----------|-----------|--------------|---------|
| MinIO Server | 1000 (minio) | drop: ALL | RuntimeDefault |

## Configuration Reference

| Property | Value |
|----------|-------|
| Image | MinIO (version managed by upstream chart) |
| Internal endpoint | `http://minio:9000` |
| Metrics path | `/minio/v2/metrics/cluster` |
| Metrics port | 9000 |
| Deploy stage | `010-infra` |
| RWO exclusion | `k8up.io/exclude: "true"` |
| Credentials | S3 secret (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) |

## Bucket Catalog

| Bucket | Service | Use Case | Backup |
|--------|---------|----------|--------|
| `opendesk-backups` | k8up / all DBs | Backup target (pg_dump, mysqldump, RDB snapshots) | N/A (is the backup target) |
| `nextcloud` | Nextcloud | Primary S3 storage (files, shares) | k8up (main schedule) |
| `opendesk-opencloud` | OpenCloud | CS3 S3 backend (files, shares) | k8up (main schedule) |
| `ilias` | ILIAS | Course content, SCORM packages | k8up (main schedule) |
| `notes` | Notes | Y.js document storage | k8up (main schedule) |

## API Contracts

- [S3 Object Storage](../../integrations/api-contracts/#contract-s3-object-storage) — S3 API for Nextcloud, OpenCloud, Element, Notes, ILIAS, OpenProject

## Depends On

- Ceph CSI driver (storage for MinIO data PVC)
- cert-manager (TLS certificate if external access required)

## Integrates With

- [Nextcloud](../nextcloud/) (S3 primary storage)
- [OpenCloud](../opencloud/) (S3 backend)
- [ILIAS](../ilias/) (course file storage)
- [Notes](../notes/) (document storage)
- [Planka](../planka/) (attachment storage)
- [Backup](../../platform/backup/) (S3 backup target)
- [Monitoring](../../platform/monitoring/) (MinIO cluster metrics)

## SLO

**Tier**: Critical (backup target + application storage)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | Uptime over 30-day window |
| **API Latency (P95)** | <50ms (PUT/GET) | MinIO metrics |
| **Bucket Growth** | Monitor >10GB/day | `ceph_rgw_usage_bytes` (info alert) |

**Alerts**:
- MinIO down for 5 minutes → Critical alert
- S3 operation errors >1% for 5 minutes → P2 alert
- Bucket growth >10GB/day → Info alert (next business day)

**Capacity**:
- Storage sized per deployment (expandable via PVC resize)
- Per-bucket quotas managed at application level

## Disaster Recovery

**Tier**: Critical (RPO: 24h for backups, RTO: 30 min)

**Backup Strategy**:
- MinIO data PVC backed up via k8up (if RWX) or native MinIO replication
- Database backups stored IN MinIO — MinIO loss means loss of backup history

**Recovery Order**:
1. Restore MinIO PVC from backup (or accept data loss)
2. Restore service data from application-level backups
3. Verify S3 connectivity from all services

**Failure Scenarios**:
- **Data PVC corruption**: Restore from backup. Application files in S3 may need re-upload from source.
- **Backup loss**: Database dumps (pg_dump, mysqldump) are lost. Restore from the most recent surviving copy.

## Known Quirks

- **Single point of backup**: MinIO stores ALL database backups. MinIO failure = loss of ALL backup history. Consider offsite replication.
- **Internal access only**: MinIO is accessed via cluster-internal URL `http://minio:9000`. External S3 access (e.g., `s3.hrz.uni-marburg.de`) is a separate endpoint (HRZ Ceph RGW).
- **SeaweedFS coexistence**: Some deployments also run SeaweedFS as an S3-compatible store (`seaweedfs-all-in-one-data`). MinIO and SeaweedFS serve different use cases.
