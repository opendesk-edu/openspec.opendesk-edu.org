<!--
SPDX-FileCopyrightText: 2026 openDesk Edu Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Interactive OpenSpec documentation for the openDesk Edu ecosystem

Interactive OpenSpec documentation for the openDesk Edu ecosystem - integrated open-source services with complete specifications.

**Live Site**: https://spec.opendesk-edu.org

## What is This?

This is the **interactive documentation platform** for the [openDesk Edu Spec](https://github.com/opendesk-edu/opendesk-edu/tree/main/openspec/specs), built with [Docusaurus](https://docusaurus.io/).

It provides:
- 📖 **Complete specifications** for the full service portfolio
- 🏗️ **Platform documentation** (backup, monitoring, security, etc.)
- 🔗 **Integration patterns** between services
- 🌄 **Embedded Landscape** - interactive visual map
- 💬 **Community features** (GitHub integration, edit links)
- 🔍 **Powerful search** across all documentation

## Framework Choice: Why Docusaurus?

We chose **Docusaurus** over alternatives because it provides:

✅ **Built-in versioning** - Document API changes over time
✅ **MDX support** - Embed React components in markdown
✅ **Search** - Full-text search out of the box
✅ **i18n** - Multi-language support (English + German)
✅ **GitHub integration** - Edit links, issue tracking
✅ **Mobile-friendly** - Responsive design
✅ **Dark mode** - Automatic based on user preference
✅ **SEO-optimized** - Meta tags, sitemaps
✅ **Fast** - Static site generation, CDN-ready
✅ **Open source** - MIT licensed, community-driven

**Alternatives considered**:
- **GitBook** - Proprietary, limited customization
- **MkDocs** - Python-based, less feature-rich
- **Sphinx** - Python-focused, steeper learning curve
- **Docusaurus** ✅ - Best balance of features, customization, and community

## Architecture

```
| /
├── docs/                      # Documentation content
│   ├── intro.md              # Landing page
│   ├── methodology.md        # Spec methodology
│   ├── quickstart.md          # Getting started
│   ├── landscape.md           # Embedded landscape
│   ├── services/              # Service specs (imported)
│   ├── platform/              # 17 platform specs (imported)
│   ├── integrations/          # 6 integration specs (imported)
│   ├── registry/              # Registry documents (imported)
│   └── community/             # Contributing, governance
├── src/
│   ├── css/                  # Custom styles
│   └── pages/                 # Custom React pages
├── scripts/
│   └── import-specs.sh       # Sync from main repository
├── docusaurus.config.ts       # Main configuration
├── sidebars.ts                # Navigation structure
├── package.json               # Dependencies
└── CNAME                      # Custom domain
```

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Open http://localhost:3000
```

### Import Specs from Main Repository

```bash
# Set path to opendesk-edu repository
export OPENDESK_REPO=/path/to/opendesk-edu

# Import all spec files
bash scripts/import-specs.sh
```

### Build for Production

```bash
# Generate static site
npm run build

# Output in build/ directory
# Deploy to any static hosting
```

## Deployment

The site is deployed as a static build to **chemie-lernen.org** server via Traefik:

1. **Build**: `npm run build` generates `build/` directory
2. **Upload**: Static files copied to hugo-chemie-lernen-org
3. **Routing**: Traefik routes `openspec.opendesk-edu.org` to the static files
4. **SSL**: Automatic Let's Encrypt certificate

### Automated Deployment

The deployment can be automated with the provided scripts:

```bash
# Build and deploy
npm run build
scp -r build/* user@server:/path/to/openspec/
```

## Features

### 1. **Interactive Landscape**

The [landscape.opendesk-edu.org](https://landscape.opendesk-edu.org) is embedded as an iframe, providing:
- Visual service map
- Search and filtering
- Statistics dashboard
- Direct service links

### 2. **Comprehensive Search**

Docusaurus provides full-text search across all documentation:
- Powered by [Algolia DocSearch](https://docsearch.algolia.com/)
- Real-time results
- Keyboard navigation (`/` to focus)

### 3. **Multi-Language Support**

Current languages:
- 🇬🇧 English (default)
- 🇩🇪 German (planned)

Add a new language:
```bash
npm run write-translations -- --locale de
```

### 4. **Version Management**

Document API changes with versioning:
```bash
npm run docusaurus docs:version 2.0
```

### 5. **Community Features**

- **Edit Links**: Every page has a "Edit this page" link to GitHub
- **Issue Tracking**: Direct links to GitHub issues
- **Last Updated**: Automatic timestamps on all pages
- **Edit Authors**: Track who last edited each page

## Content Organization

### Navigation Structure

```
Documentation
├── Introduction (Landing)
├── Methodology (How we structure specs)
├── Quickstart (5-minute tour)
├── 🌄 Landscape (Embedded interactive map)
├── Platform Specifications (17)
│   ├── Backup
│   ├── Monitoring
│   ├── Security
│   ├── Operations
│   ├── Disaster Recovery
│   └── ...
├── Integration Specifications (6)
│   ├── API Contracts
│   ├── Cross-Service Workflows
│   ├── Intercom (Cross-app SSO)
│   ├── LTI Integration
│   └── ...
├── Registry (Indexes and metadata)
│   ├── Interconnection Matrix
│   ├── Test Coverage Gaps
│   └── Glossary
└── Community
    ├── Contributing
    ├── Governance
    └── Roadmap

Services (Separate Sidebar)
├── 🎓 Learning Management (4)
├── 🔐 Identity & Access (3)
├── 📚 Content & Collaboration (8)
├── 📊 Project Management (2)
└── 📧 Communication (6)
```

## Integration with Landscape

The [landscape.opendesk-edu.org](https://landscape.opendesk-edu.org) is embedded as an iframe:

```html
<iframe
  src="https://landscape.opendesk-edu.org"
  style="width: 100%; height: 600px; border: 0;"
  title="openDesk Edu Landscape"
></iframe>
```

This provides:
- **Single Source of Truth**: Both sites reference the same data
- **Visual + Detailed**: Landscape shows overview, OpenSpec shows details
- **Cross-linking**: Easy navigation between visual and technical views

## Continuous Integration

The OpenSpec is automatically validated by the **self-improvement agent**:

```bash
# Runs weekly via GitLab CI
python3 .gitlab/self-improvement/improvement_agent.py
```

The agent checks for:
- Missing required sections
- Broken cross-references
- Inconsistencies between specs
- Improvement opportunities

## Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/opendesk-edu/opendesk-edu/blob/main/CONTRIBUTING.md) for details.

### Quick Contribution

1. **Improve existing specs**: Edit files in `docs/`
2. **Add new content**: Create new markdown files
3. **Fix issues**: Report bugs or suggest improvements

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/openspec.opendesk-edu.org.git
cd openspec.opendesk-edu.org

# Create branch
git checkout -b feature/improve-docs

# Make changes, commit, push
git add .
git commit -m "docs: improve service descriptions"
git push origin feature/improve-docs

# Open Pull Request
```

## Technology Stack

- **Framework**: [Docusaurus 3.5](https://docusaurus.io/)
- **Language**: TypeScript
- **UI**: React 18
- **Styling**: CSS3 with custom properties
- **Search**: Algolia DocSearch (or local search)
- **Deployment**: Static site (any CDN)

## License

Apache-2.0

Copyright 2026 openDesk Edu Contributors

## Related Projects

- 🌄 **[landscape.opendesk-edu.org](https://landscape.opendesk-edu.org)** - Interactive service map
- 📚 **[opendesk-edu.org](https://opendesk-edu.org)** - Main project website
- 🔧 **[opendesk-edu](https://github.com/opendesk-edu/opendesk-edu)** - Source code and OpenSpec
- 🤖 **[Self-Improvement Agent](https://github.com/opendesk-edu/opendesk-edu/tree/main/.gitlab/self-improvement)** - Automated OpenSpec validation

## Support

- 💬 [GitHub Discussions](https://github.com/opendesk-edu/opendesk-edu/discussions)
- 🐛 [Issue Tracker](https://github.com/opendesk-edu/opendesk-edu/issues)
- 📧 [Email](mailto:tobias.weiss@uni-marburg.de)
- 🌐 [opendesk-edu.org](https://opendesk-edu.org)

---

**Built with ❤️ by the openDesk Edu Community**
