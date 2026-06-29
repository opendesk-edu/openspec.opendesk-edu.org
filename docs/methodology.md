---
title: Specification Methodology
sidebar_position: 2
description: How openDesk Edu structures its specifications using the Fission AI OpenSpec format.
---

# Specification Methodology

The openDesk Edu OpenSpec follows the **Fission AI OpenSpec format**, a structured approach to documenting complex systems that enables both human understanding and machine processing.

## Core Principles

### 1. Standardized Structure

Every specification follows the same template, making it easy to:
- Navigate between specs
- Compare similar services
- Identify gaps and inconsistencies
- Enable automated tooling

### 2. Machine-Verifiable

Specifications are written in a way that allows:
- Automated gap detection
- Cross-reference validation
- Consistency checking
- AI-assisted analysis

### 3. Living Documentation

Specs are:
- Versioned with the code
- Automatically validated
- Continuously improved
- Community-maintained

## The Five Pillars

Every service specification includes these five sections:

### 1. Purpose & Scope

**What it does** and **what it doesn't do**.

```markdown
## Purpose
[What the system does and why]

## Scope
### In Scope
- ✅ [Feature 1]
- ✅ [Feature 2]

### Out of Scope
- ❌ [Exclusion 1]
- ❌ [Exclusion 2]
```

**Why this matters**: Clear boundaries prevent scope creep and help users understand what to expect.

### 2. Requirements

**Functional** and **non-functional requirements** with testable scenarios.

```markdown
## Requirements

### Functional Requirements

#### Scenario: User creates a project
- GIVEN an authenticated user
- WHEN they create a new project
- THEN the project is stored securely
- AND the user receives confirmation

### Non-Functional Requirements
- Performance: <100ms response time
- Scalability: 10,000 concurrent users
- Security: GDPR-compliant
```

**Why this matters**: BDD-style scenarios are testable and executable.

### 3. Dependencies & Integration

**What the service needs** and **how it connects**.

```markdown
## Depends On
- **PostgreSQL**: Persistent data storage
- **Keycloak**: Authentication
- **Redis**: Session caching

## Integrates With
- **Nextcloud**: File sharing
- **Element**: Cross-app SSO
```

**Why this matters**: Dependency mapping enables impact analysis and deployment planning.

### 4. Service Level Objectives (SLOs)

**Quantifiable reliability targets**.

```markdown
## SLO

| Metric | Target |
|--------|--------|
| Availability | 99.9% (43.2 min downtime/month) |
| Latency P95 | &lt;200ms |
| Error Rate | &lt;0.1% |
| Capacity | 5,000 concurrent users |
```

**Why this matters**: SLOs are measurable and enable SLA definition.

### 5. Disaster Recovery

**Backup and recovery procedures**.

```markdown
## Disaster Recovery

- **RPO**: 15 minutes (maximum data loss)
- **RTO**: 1 hour (maximum downtime)
- **Backup Strategy**: Hourly incremental + daily full
- **Recovery Order**: Database → Cache → Application → Verification
```

**Why this matters**: DR procedures must be documented before incidents occur.

## Specification Layers

The OpenSpec is organized in layers:

```
┌─────────────────────────────────────┐
│  Service Specifications (25)       │  ← Individual services
├─────────────────────────────────────┤
│  Platform Specifications (17)      │  ← Cross-cutting concerns
├─────────────────────────────────────┤
│  Integration Specifications (6)     │  ← How services work together
├─────────────────────────────────────┤
│  Registry Documents (10)           │  ← Metadata and indexes
└─────────────────────────────────────┘
```

### Service Specifications

One per integrated service (e.g., `services/keycloak/spec.md`)

### Platform Specifications

Cross-cutting concerns:
- Backup & Restore
- Monitoring & Alerting
- Security & Compliance
- Operations & Runbooks
- Performance & Scaling
- Disaster Recovery
- Secret Management
- Upgrade & Migration

### Integration Specifications

How services interact:
- API Contracts
- Cross-Service Workflows
- Authentication Flows
- File Storage Integration
- LTI Integration
- User Provisioning

### Registry Documents

Metadata and indexes:
- Service Interconnection Matrix
- Test Coverage Gaps
- Glossary
- Service Tier Classification

## Quality Standards

Every specification must:

✅ **Be Specific** - No vague terms like "fast" or "secure"
✅ **Be Measurable** - Include numbers, percentages, timeouts
✅ **Be Testable** - Scenarios must be executable
✅ **Be Complete** - All five pillars present
✅ **Be Current** - Updated when service changes
✅ **Be Cross-Referenced** - Links to related specs

## Automation

The OpenSpec is continuously validated by the **self-improvement agent**:

- **Weekly audits** check for missing sections
- **Cross-reference validation** ensures consistency
- **Gap analysis** identifies improvements
- **Automated PRs** suggest fixes

See the [Self-Improvement Agent](https://github.com/opendesk-edu/opendesk-edu/tree/main/.gitlab/self-improvement) for details.

## Examples

### Good Specification

```markdown
## Purpose
Keycloak provides single sign-on (SSO) and identity brokering
for all openDesk Edu services using SAML 2.0 and OpenID Connect.

## Scope
### In Scope
- ✅ User authentication via OIDC
- ✅ Service-to-service authentication
- ✅ Identity brokering (LDAP, SAML)
- ✅ User federation (DFN-AAI)

### Out of Scope
- ❌ User management UI (handled by Nubus)
- ❌ Authorization policies (handled per-service)
```

### Poor Specification

```markdown
## Purpose
This service does authentication and stuff.

## Scope
Many things related to security and login.
```

## Inspiration

The openDesk Edu OpenSpec is inspired by:
- [OpenSpec format](https://github.com/opendesk-edu/openspec.opendesk-edu.org)
- [CNCF Landscape](https://landscape.cncf.io) categorization
- [Keep a Changelog](https://keepachangelog.com) versioning
- [Conventional Commits](https://www.conventionalcommits.org) standardization

## Next Steps

- 📖 Read the [Quickstart Guide](/docs/quickstart)
- 🔧 Browse [Platform Specifications](/docs/category/platform-specifications)
- 🛠️ Explore [Service Specifications](/docs/category/services)
- 🤝 Learn how to [Contribute](/docs/community/contributing)
