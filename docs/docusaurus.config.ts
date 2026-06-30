import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'OpenSpec | openDesk Edu',
  tagline: 'Complete specification framework for the openDesk Edu ecosystem',
  favicon: 'img/favicon.ico',

  url: 'https://spec.opendesk-edu.org',
  baseUrl: '/',

  organizationName: 'opendesk-edu',
  projectName: 'opendesk-edu-spec',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  presets: [
    [
      'classic',
      {
        docs: {
          path: './specs',
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
          editUrl: 'https://github.com/opendesk-edu/opendesk-edu-spec/tree/main/specs/',
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'OpenSpec',
      logo: {
        alt: 'openDesk Edu Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'docSidebar',
          sidebarId: 'servicesSidebar',
          position: 'left',
          label: 'Services',
        },
        {
          href: 'https://opendesk-edu.org',
          label: 'opendesk-edu.org',
          position: 'right',
        },
        {
          href: 'https://github.com/opendesk-edu/opendesk-edu-spec',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Spec Index', to: '/_registry/index'},
            {label: 'Methodology', to: '/methodology/spec-writing'},
            {label: 'Glossary', to: '/platform/glossary'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'opendesk-edu.org', href: 'https://opendesk-edu.org'},
            {label: 'GitHub', href: 'https://github.com/opendesk-edu'},
            {label: 'Codeberg', href: 'https://codeberg.org/opendesk-edu'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} openDesk Edu Contributors. Licensed under Apache-2.0.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'docker'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
