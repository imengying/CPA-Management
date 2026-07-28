import {
  ReactNode,
  RefObject,
  SVGProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react';
import { NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/common/PageTransition';
import { MainRoutes } from '@/router/MainRoutes';
import { pluginsApi } from '@/services/api';
import {
  IconSidebarAuthFiles,
  IconSidebarDashboard,
  IconSidebarOauth,
  IconSidebarQuota,
  IconSidebarStore,
  IconSidebarSystem,
  IconChevronDown,
  IconChevronLeft,
  IconNetwork,
  IconPlug,
  IconRefreshCw,
  IconScrollText,
  IconSlidersHorizontal,
  IconX,
} from '@/components/ui/icons';
import logoUrl from '@/assets/logo.jpg';
import {
  useAuthStore,
  useConfigStore,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import {
  collectPluginResourceEntries,
  PLUGIN_RESOURCES_REFRESH_EVENT,
  resolvePluginAssetURL,
  type PluginResourceEntry,
} from '@/features/plugins/pluginResources';
import { isPluginUiEnabled } from '@/features/plugins/pluginAvailability';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import type { Theme } from '@/types';

const sidebarIcons: Record<string, ReactNode> = {
  dashboard: <IconSidebarDashboard size={18} />,
  aiProviders: <IconNetwork size={18} />,
  authFiles: <IconSidebarAuthFiles size={18} />,
  oauth: <IconSidebarOauth size={18} />,
  quota: <IconSidebarQuota size={18} />,
  plugins: <IconPlug size={18} />,
  pluginStore: <IconSidebarStore size={18} />,
  config: <IconSlidersHorizontal size={18} />,
  logs: <IconScrollText size={18} />,
  system: <IconSidebarSystem size={18} />,
};

interface SidebarNavLinkItem {
  kind?: 'link';
  path: string;
  labelKey?: string;
  metaKey?: string;
  label?: string;
  meta?: string;
  icon: ReactNode;
}

interface SidebarNavDrawerItem {
  kind: 'drawer';
  id: string;
  label: string;
  meta?: string;
  icon: ReactNode;
  children: SidebarNavLinkItem[];
}

type SidebarNavItem = SidebarNavLinkItem | SidebarNavDrawerItem;

const NAV_TOOLTIP_ID = 'sidebar-nav-tooltip';
const NAV_TOOLTIP_VIEWPORT_MARGIN = 8;

interface SidebarNavGroup {
  id: string;
  labelKey: string;
  items: SidebarNavItem[];
}

const flattenNavItems = (items: SidebarNavItem[]): SidebarNavLinkItem[] =>
  items.flatMap((item) => (item.kind === 'drawer' ? item.children : [item]));

/** 点击菜单外或按下 Escape 时关闭弹出菜单 */
function useMenuDismiss(
  open: boolean,
  menuRef: RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, menuRef, onClose]);
}

function PluginSidebarIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return showImage ? (
    <img src={src} alt="" onError={() => setFailed(true)} />
  ) : (
    <IconPlug size={18} />
  );
}

// Header action icons - smaller size for header buttons
const headerIconProps: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

const headerIcons = {
  refresh: <IconRefreshCw size={16} />,
  menu: (
    <svg {...headerIconProps}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  ),
  close: <IconX size={16} />,
  language: (
    <svg {...headerIconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  monitor: (
    <svg {...headerIconProps}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  ),
  logout: (
    <svg {...headerIconProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
};

const THEME_CARDS: Array<{
  key: Theme;
  labelKey: string;
  colors: { bg: string; card: string; border: string; text: string; textMuted: string };
}> = [
  {
    key: 'auto',
    labelKey: 'theme.auto',
    colors: {
      bg: 'linear-gradient(135deg, #f8fafc 0 50%, #09090b 50% 100%)',
      card: 'linear-gradient(135deg, #ffffff 0 50%, #18181b 50% 100%)',
      border: '#a1a1aa',
      text: '#18181b',
      textMuted: 'linear-gradient(135deg, #94a3b8 0 50%, #71717a 50% 100%)',
    },
  },
  {
    key: 'light',
    labelKey: 'theme.light',
    colors: {
      bg: '#f8fafc',
      card: '#ffffff',
      border: '#e2e8f0',
      text: '#18181b',
      textMuted: '#64748b',
    },
  },
  {
    key: 'dark',
    labelKey: 'theme.dark',
    colors: {
      bg: '#09090b',
      card: '#18181b',
      border: '#27272a',
      text: '#fafafa',
      textMuted: '#a1a1aa',
    },
  },
];

export function MainLayout() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const location = useLocation();

  const logout = useAuthStore((state) => state.logout);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);

  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{
    targetID: string;
    label: string;
    meta?: string;
    anchorTop: number;
    top: number;
  } | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [pluginResources, setPluginResources] = useState<PluginResourceEntry[]>([]);
  const [expandedPluginResourceIDs, setExpandedPluginResourceIDs] = useState<Set<string>>(
    () => new Set()
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railTooltipRef = useRef<HTMLDivElement | null>(null);
  const focusedRailItemRef = useRef<HTMLElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const isLogsPage = location.pathname.startsWith('/logs');
  const pluginUiEnabled = isPluginUiEnabled(supportsPlugin, config);
  const isPluginResourcePage = pluginUiEnabled && location.pathname.startsWith('/plugin-pages');
  const showSidebarLabels = !sidebarCollapsed || sidebarOpen;

  // Keep floating header height available to sticky mobile elements and overlays.
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && headerRef.current
        ? new ResizeObserver(updateHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  useLayoutEffect(() => {
    if (!railTooltip) return;

    const updateRailTooltipPosition = () => {
      const tooltip = railTooltipRef.current;
      if (!tooltip) return;

      const halfHeight = tooltip.offsetHeight / 2;
      const minTop = NAV_TOOLTIP_VIEWPORT_MARGIN + halfHeight;
      const maxTop = Math.max(
        minTop,
        window.innerHeight - NAV_TOOLTIP_VIEWPORT_MARGIN - halfHeight
      );
      const top = Math.min(maxTop, Math.max(minTop, railTooltip.anchorTop));

      setRailTooltip((current) => {
        if (!current || current.targetID !== railTooltip.targetID || current.top === top) {
          return current;
        }
        return { ...current, top };
      });
    };

    updateRailTooltipPosition();
    window.addEventListener('resize', updateRailTooltipPosition);
    return () => window.removeEventListener('resize', updateRailTooltipPosition);
  }, [railTooltip]);

  // Keep the content center available to bottom overlays that align with the main area.
  useLayoutEffect(() => {
    const updateContentCenter = () => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      document.documentElement.style.setProperty('--content-center-x', `${centerX}px`);
    };

    updateContentCenter();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && contentRef.current
        ? new ResizeObserver(updateContentCenter)
        : null;

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateContentCenter);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateContentCenter);
      document.documentElement.style.removeProperty('--content-center-x');
    };
  }, []);

  const closeLanguageMenu = useCallback(() => setLanguageMenuOpen(false), []);
  const closeThemeMenu = useCallback(() => setThemeMenuOpen(false), []);
  useMenuDismiss(languageMenuOpen, languageMenuRef, closeLanguageMenu);
  useMenuDismiss(themeMenuOpen, themeMenuRef, closeThemeMenu);

  const toggleLanguageMenu = useCallback(() => {
    setLanguageMenuOpen((prev) => !prev);
    setThemeMenuOpen(false);
  }, []);

  const toggleThemeMenu = useCallback(() => {
    setThemeMenuOpen((prev) => !prev);
    setLanguageMenuOpen(false);
  }, []);

  const handleThemeSelect = useCallback(
    (nextTheme: Theme) => {
      setTheme(nextTheme);
      setThemeMenuOpen(false);
    },
    [setTheme]
  );

  const handleLanguageSelect = useCallback(
    (nextLanguage: string) => {
      if (!isSupportedLanguage(nextLanguage)) {
        return;
      }
      setLanguage(nextLanguage);
      setLanguageMenuOpen(false);
    },
    [setLanguage]
  );

  useEffect(() => {
    fetchConfig().catch(() => {
      // Ignore the initial failure; the login flow shows the user-facing prompt.
    });
  }, [fetchConfig]);

  const loadPluginResources = useCallback(async () => {
    if (connectionStatus !== 'connected' || !pluginUiEnabled) {
      setPluginResources([]);
      return;
    }

    try {
      const plugins = await pluginsApi.list();
      setPluginResources(collectPluginResourceEntries(plugins.plugins));
    } catch {
      setPluginResources([]);
    }
  }, [connectionStatus, pluginUiEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPluginResources();
    }, 0);

    window.addEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);
    };
  }, [apiBase, loadPluginResources]);

  const pluginResourceGroups = pluginResources.reduce<
    Array<{ pluginID: string; pluginTitle: string; entries: PluginResourceEntry[] }>
  >((groups, resource) => {
    const group = groups.find((item) => item.pluginID === resource.pluginID);
    if (group) {
      group.entries.push(resource);
      return groups;
    }

    groups.push({
      pluginID: resource.pluginID,
      pluginTitle: resource.pluginTitle,
      entries: [resource],
    });
    return groups;
  }, []);

  const pluginPageNavItems: SidebarNavItem[] = pluginResourceGroups.flatMap(
    (group): SidebarNavItem[] => {
      if (group.entries.length === 1) {
        const resource = group.entries[0];
        const pluginLogo = resolvePluginAssetURL(resource.pluginLogo, apiBase);
        return [
          {
            path: resource.route,
            label: resource.label,
            meta: resource.description,
            icon: <PluginSidebarIcon src={pluginLogo} />,
          },
        ];
      }

      const pluginLogo = resolvePluginAssetURL(group.entries[0]?.pluginLogo ?? '', apiBase);
      return [
        {
          kind: 'drawer',
          id: `plugin-pages-${group.pluginID}`,
          label: group.pluginTitle,
          meta: t('plugin_resource.page_count', { count: group.entries.length }),
          icon: <PluginSidebarIcon src={pluginLogo} />,
          children: group.entries.map((resource) => ({
            path: resource.route,
            label: resource.label,
            meta: resource.description,
            icon: <span className="nav-sub-dot" aria-hidden="true" />,
          })),
        },
      ];
    }
  );

  const navGroups: SidebarNavGroup[] = [
    {
      id: 'operate',
      labelKey: 'nav_groups.operate',
      items: [
        {
          path: '/',
          labelKey: 'nav.dashboard',
          metaKey: 'nav_meta.dashboard',
          icon: sidebarIcons.dashboard,
        },
      ],
    },
    {
      id: 'gateway',
      labelKey: 'nav_groups.gateway',
      items: [
        {
          path: '/ai-providers',
          labelKey: 'nav.ai_providers',
          metaKey: 'nav_meta.ai_providers',
          icon: sidebarIcons.aiProviders,
        },
        {
          path: '/auth-files',
          labelKey: 'nav.auth_files',
          metaKey: 'nav_meta.auth_files',
          icon: sidebarIcons.authFiles,
        },
        {
          path: '/oauth',
          labelKey: 'nav.oauth',
          metaKey: 'nav_meta.oauth',
          icon: sidebarIcons.oauth,
        },
      ],
    },
    {
      id: 'observe',
      labelKey: 'nav_groups.observe',
      items: [
        {
          path: '/quota',
          labelKey: 'nav.quota_management',
          metaKey: 'nav_meta.quota_management',
          icon: sidebarIcons.quota,
        },
        {
          path: '/logs',
          labelKey: 'nav.logs',
          metaKey: 'nav_meta.logs',
          icon: sidebarIcons.logs,
        },
      ],
    },
    {
      id: 'control',
      labelKey: 'nav_groups.control',
      items: [
        {
          path: '/config',
          labelKey: 'nav.config_management',
          metaKey: 'nav_meta.config_management',
          icon: sidebarIcons.config,
        },
        ...(pluginUiEnabled
          ? [
              {
                path: '/plugins',
                labelKey: 'nav.plugins',
                metaKey: 'nav_meta.plugins',
                icon: sidebarIcons.plugins,
              },
              {
                path: '/plugin-store',
                labelKey: 'nav.plugin_store',
                metaKey: 'nav_meta.plugin_store',
                icon: sidebarIcons.pluginStore,
              },
            ]
          : []),
        {
          path: '/system',
          labelKey: 'nav.system_info',
          metaKey: 'nav_meta.system_info',
          icon: sidebarIcons.system,
        },
      ],
    },
    ...(pluginUiEnabled && pluginPageNavItems.length > 0
      ? [
          {
            id: 'plugin-pages',
            labelKey: 'nav_groups.plugin_pages',
            items: pluginPageNavItems,
          },
        ]
      : []),
  ];
  const navItems = navGroups.flatMap((group) => flattenNavItems(group.items));
  const navOrder = navItems.map((item) => item.path);
  const normalizedCurrentPath = (() => {
    const trimmed =
      location.pathname.length > 1 && location.pathname.endsWith('/')
        ? location.pathname.slice(0, -1)
        : location.pathname;
    return trimmed === '/dashboard' ? '/' : trimmed;
  })();
  const currentNavItem =
    navItems.find((item) => item.path === normalizedCurrentPath) ??
    navItems.find(
      (item) => item.path !== '/' && normalizedCurrentPath.startsWith(`${item.path}/`)
    ) ??
    navItems[0];
  const currentPageTitle =
    currentNavItem?.label ?? (currentNavItem?.labelKey ? t(currentNavItem.labelKey) : '');
  const getRouteOrder = (pathname: string) => {
    const trimmedPath =
      pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedPath = trimmedPath === '/dashboard' ? '/' : trimmedPath;

    const authFilesIndex = navOrder.indexOf('/auth-files');
    if (authFilesIndex !== -1) {
      if (normalizedPath === '/auth-files') return authFilesIndex;
      if (normalizedPath.startsWith('/auth-files/')) {
        if (normalizedPath.startsWith('/auth-files/oauth-excluded')) return authFilesIndex + 0.1;
        if (normalizedPath.startsWith('/auth-files/oauth-model-alias')) return authFilesIndex + 0.2;
        return authFilesIndex + 0.05;
      }
    }

    const exactIndex = navOrder.indexOf(normalizedPath);
    if (exactIndex !== -1) return exactIndex;
    const nestedIndex = navOrder.findIndex(
      (path) => path !== '/' && normalizedPath.startsWith(`${path}/`)
    );
    return nestedIndex === -1 ? null : nestedIndex;
  };

  const getTransitionVariant = useCallback((fromPathname: string, toPathname: string) => {
    const normalize = (pathname: string) => {
      const trimmed =
        pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return trimmed === '/dashboard' ? '/' : trimmed;
    };

    const from = normalize(fromPathname);
    const to = normalize(toPathname);
    const isAuthFiles = (pathname: string) =>
      pathname === '/auth-files' || pathname.startsWith('/auth-files/');
    if (isAuthFiles(from) && isAuthFiles(to)) return 'ios';
    return 'vertical';
  }, []);

  const handleRefreshAll = async () => {
    clearCache();
    const results = await Promise.allSettled([
      fetchConfig(true),
      loadPluginResources(),
      triggerHeaderRefresh(),
    ]);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const reason = rejected.reason;
      const message =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
      showNotification(
        `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
      return;
    }
    showNotification(t('notification.data_refreshed'), 'success');
  };

  const togglePluginResourceDrawer = useCallback((drawerID: string) => {
    setExpandedPluginResourceIDs((current) => {
      const next = new Set(current);
      if (next.has(drawerID)) {
        next.delete(drawerID);
      } else {
        next.add(drawerID);
      }
      return next;
    });
  }, []);

  const showRailTooltip = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const anchorTop = rect.top + rect.height / 2;
      setRailTooltip({ targetID, label, meta, anchorTop, top: anchorTop });
    },
    []
  );
  const hideRailTooltip = useCallback(() => setRailTooltip(null), []);
  const handleRailTooltipMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      const focusedItem = focusedRailItemRef.current;
      if (focusedItem && focusedItem !== event.currentTarget) return;
      showRailTooltip(event, targetID, label, meta);
    },
    [showRailTooltip]
  );
  const handleRailTooltipMouseLeave = useCallback(() => {
    if (!focusedRailItemRef.current) hideRailTooltip();
  }, [hideRailTooltip]);
  const handleRailTooltipFocus = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      focusedRailItemRef.current = event.currentTarget;
      showRailTooltip(event, targetID, label, meta);
    },
    [showRailTooltip]
  );
  const handleRailTooltipBlur = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      if (focusedRailItemRef.current === event.currentTarget) {
        focusedRailItemRef.current = null;
      }
      if (event.currentTarget.matches(':hover')) {
        showRailTooltip(event, targetID, label, meta);
      } else {
        hideRailTooltip();
      }
    },
    [hideRailTooltip, showRailTooltip]
  );

  const renderNavLink = (item: SidebarNavLinkItem, className = 'nav-item') => {
    const itemLabel = item.label ?? (item.labelKey ? t(item.labelKey) : '');
    const itemMeta = item.meta ?? (item.metaKey ? t(item.metaKey) : '');

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) => `${className} ${isActive ? 'active' : ''}`}
        onClick={() => {
          focusedRailItemRef.current = null;
          setSidebarOpen(false);
          hideRailTooltip();
        }}
        aria-label={showSidebarLabels ? undefined : itemLabel}
        aria-describedby={
          !showSidebarLabels && itemMeta && railTooltip?.targetID === item.path
            ? NAV_TOOLTIP_ID
            : undefined
        }
        onMouseEnter={
          showSidebarLabels
            ? undefined
            : (event) => handleRailTooltipMouseEnter(event, item.path, itemLabel, itemMeta)
        }
        onMouseLeave={showSidebarLabels ? undefined : handleRailTooltipMouseLeave}
        onFocus={
          showSidebarLabels
            ? undefined
            : (event) => handleRailTooltipFocus(event, item.path, itemLabel, itemMeta)
        }
        onBlur={
          showSidebarLabels
            ? undefined
            : (event) => handleRailTooltipBlur(event, item.path, itemLabel, itemMeta)
        }
      >
        <span className="nav-icon">{item.icon}</span>
        {showSidebarLabels ? (
          <span className="nav-text">
            <span className="nav-label">{itemLabel}</span>
            {itemMeta ? <span className="nav-meta">{itemMeta}</span> : null}
          </span>
        ) : null}
      </NavLink>
    );
  };

  const renderNavItem = (item: SidebarNavItem) => {
    if (item.kind !== 'drawer') {
      return renderNavLink(item);
    }

    const isActive = item.children.some((child) => child.path === location.pathname);
    const isOpen = isActive || expandedPluginResourceIDs.has(item.id);

    return (
      <div className={`nav-drawer ${isOpen ? 'open' : ''}`} key={item.id}>
        <button
          type="button"
          className={`nav-item nav-drawer-toggle ${isActive ? 'active' : ''} ${
            isOpen ? 'open' : ''
          }`}
          onClick={() => togglePluginResourceDrawer(item.id)}
          aria-label={showSidebarLabels ? undefined : item.label}
          aria-describedby={
            !showSidebarLabels && item.meta && railTooltip?.targetID === item.id
              ? NAV_TOOLTIP_ID
              : undefined
          }
          aria-expanded={isOpen}
          onMouseEnter={
            showSidebarLabels
              ? undefined
              : (event) => handleRailTooltipMouseEnter(event, item.id, item.label, item.meta)
          }
          onMouseLeave={showSidebarLabels ? undefined : handleRailTooltipMouseLeave}
          onFocus={
            showSidebarLabels
              ? undefined
              : (event) => handleRailTooltipFocus(event, item.id, item.label, item.meta)
          }
          onBlur={
            showSidebarLabels
              ? undefined
              : (event) => handleRailTooltipBlur(event, item.id, item.label, item.meta)
          }
        >
          <span className="nav-icon">{item.icon}</span>
          {showSidebarLabels && (
            <>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
                {item.meta ? <span className="nav-meta">{item.meta}</span> : null}
              </span>
              <span className="nav-drawer-caret" aria-hidden="true">
                <IconChevronDown size={14} />
              </span>
            </>
          )}
        </button>
        {isOpen ? (
          <div className="nav-sub-list">
            {item.children.map((child) => renderNavLink(child, 'nav-item nav-sub-item'))}
          </div>
        ) : null}
      </div>
    );
  };

  const mobileSidebarToggleLabel = sidebarOpen
    ? t('sidebar.toggle_collapse', { defaultValue: 'Close navigation' })
    : t('sidebar.toggle_expand', { defaultValue: 'Open navigation' });

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <header className="main-header" ref={headerRef}>
        <button
          type="button"
          className="sidebar-toggle-floating"
          onClick={() => {
            focusedRailItemRef.current = null;
            hideRailTooltip();
            setSidebarCollapsed((prev) => !prev);
          }}
          title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <IconChevronLeft className={sidebarCollapsed ? 'is-reversed' : undefined} size={14} />
        </button>

        <div className="header-main">
          <Button
            className="header-menu-btn"
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title={mobileSidebarToggleLabel}
            aria-label={mobileSidebarToggleLabel}
          >
            {sidebarOpen ? headerIcons.close : headerIcons.menu}
          </Button>

          <div className="header-current-page">
            <span className="header-current-title">{currentPageTitle}</span>
          </div>
        </div>

        <div className="header-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            title={t('header.refresh_all')}
          >
            {headerIcons.refresh}
          </Button>
          <div className={`language-menu ${languageMenuOpen ? 'open' : ''}`} ref={languageMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguageMenu}
              title={t('language.switch')}
              aria-label={t('language.switch')}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
            >
              {headerIcons.language}
            </Button>
            {languageMenuOpen && (
              <div
                className="notification entering language-menu-popover"
                role="menu"
                aria-label={t('language.switch')}
              >
                {LANGUAGE_ORDER.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`language-menu-option ${language === lang ? 'active' : ''}`}
                    onClick={() => handleLanguageSelect(lang)}
                    role="menuitemradio"
                    aria-checked={language === lang}
                  >
                    <span>{t(LANGUAGE_LABEL_KEYS[lang])}</span>
                    {language === lang ? <span className="language-menu-check">✓</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={`theme-menu ${themeMenuOpen ? 'open' : ''}`} ref={themeMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleThemeMenu}
              title={t('theme.switch')}
              aria-label={t('theme.switch')}
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
            >
              {headerIcons.monitor}
            </Button>
            {themeMenuOpen && (
              <div
                className="notification entering theme-menu-popover"
                role="menu"
                aria-label={t('theme.switch')}
              >
                {THEME_CARDS.map((tc) => (
                  <button
                    key={tc.key}
                    type="button"
                    className={`theme-card ${theme === tc.key ? 'active' : ''}`}
                    onClick={() => handleThemeSelect(tc.key)}
                    role="menuitemradio"
                    aria-checked={theme === tc.key}
                  >
                    <div
                      className="theme-card-preview"
                      style={{
                        background: tc.colors.bg,
                        border: `1px solid ${tc.colors.border}`,
                      }}
                    >
                      <div
                        className="theme-card-header"
                        style={{
                          background: tc.colors.card,
                          borderBottom: `1px solid ${tc.colors.border}`,
                        }}
                      />
                      <div className="theme-card-body">
                        <div
                          className="theme-card-sidebar"
                          style={{
                            background: tc.colors.card,
                            borderRight: `1px solid ${tc.colors.border}`,
                          }}
                        />
                        <div className="theme-card-content" style={{ background: tc.colors.bg }}>
                          <div
                            className="theme-card-line"
                            style={{ background: tc.colors.textMuted }}
                          />
                          <div
                            className="theme-card-line short"
                            style={{ background: tc.colors.textMuted }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="theme-card-label">{t(tc.labelKey)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={logout} title={t('header.logout')}>
            {headerIcons.logout}
          </Button>
        </div>
      </header>

      <div className="main-body">
        <button
          type="button"
          className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common.close')}
          aria-hidden={!sidebarOpen}
          tabIndex={sidebarOpen ? 0 : -1}
        />

        <aside
          className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
        >
          <div className="sidebar-brand" title="CPAMC">
            <span className="sidebar-brand-logo-wrap" aria-hidden="true">
              <img src={logoUrl} alt="" className="sidebar-brand-logo" />
            </span>
            {showSidebarLabels && <span className="sidebar-brand-title">CPAMC</span>}
          </div>

          <div className="nav-section">
            {navGroups.map((group, index) => (
              <div className="nav-group" key={group.id}>
                {showSidebarLabels ? (
                  <div className="nav-group-label">{t(group.labelKey)}</div>
                ) : (
                  index > 0 && <div className="nav-group-divider" aria-hidden="true" />
                )}
                {group.items.map((item) => renderNavItem(item))}
              </div>
            ))}
          </div>
        </aside>

        {!showSidebarLabels && railTooltip && (
          <div
            ref={railTooltipRef}
            id={NAV_TOOLTIP_ID}
            className="nav-tooltip"
            role="tooltip"
            style={{ top: railTooltip.top }}
          >
            <span className="nav-tooltip-label" aria-hidden="true">
              {railTooltip.label}
            </span>
            {railTooltip.meta ? <span className="nav-tooltip-meta">{railTooltip.meta}</span> : null}
          </div>
        )}

        <div
          className={`content${isLogsPage ? ' content-logs' : ''}${
            isPluginResourcePage ? ' content-plugin-resource' : ''
          }`}
          ref={contentRef}
        >
          <main
            className={`main-content${isLogsPage ? ' main-content-logs' : ''}${
              isPluginResourcePage ? ' main-content-plugin-resource' : ''
            }`}
          >
            <PageTransition
              render={(location) => <MainRoutes location={location} />}
              getRouteOrder={getRouteOrder}
              getTransitionVariant={getTransitionVariant}
              scrollContainerRef={contentRef}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
