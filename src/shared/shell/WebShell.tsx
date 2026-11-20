/**
 * Frame for the three web apps (design-system.md §5): 56 px header, 240 px sidebar
 * collapsible to 64 px, content area. Customer Portal and Partner Portal use a
 * white sidebar; the ERP uses charcoal (§2).
 */
import { Bell, ChevronDown, CircleHelp, LogOut, PanelLeftClose, PanelLeftOpen, Repeat, Search, SlidersHorizontal, SquareArrowOutUpRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { appByKey } from '@shared/apps'
import type { NavGroup, NavItem } from '@shared/nav'
import { useSession } from '@shared/store/session'
import type { AppKey } from '@shared/types'
import { Button } from '@shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/ui/dropdown-menu'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'

const COLLAPSE_KEY = 'logisco-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

interface WebShellProps<Ctx> {
  app: AppKey
  nav: NavGroup<Ctx>[]
  /** Company / partner / department line next to the logo */
  orgName: string
  /** Badge after the org name, e.g. partner type and tier */
  orgBadge?: React.ReactNode
  user: { name: string; roleLabel: string }
  /** Extra header actions (e.g. "Book shipment") */
  headerActions?: React.ReactNode
  /** Help screen path under the app root */
  helpPath?: string
  searchPlaceholderKey: string
  /** Header search. Without it, search shows a "coming later" message. */
  onSearch?: (query: string) => void
  dark?: boolean
  /** Unread notifications for the bell; the bell opens <app>/notifications */
  unread?: number
  /** Profile menu → Preferences (CP-34, PP-36) */
  preferencesPath?: string
  /** Floating AI assistant (CP-35, PP-37, ERP-02) */
  assistant?: React.ReactNode
}

export function WebShell<Ctx>({ app, nav, orgName, orgBadge, user, headerActions, helpPath = 'help', searchPlaceholderKey, onSearch, dark, unread = 0, preferencesPath, assistant }: WebShellProps<Ctx>) {
  const { t } = useTranslation()
  const meta = appByKey(app)
  const navigate = useNavigate()
  const logout = useSession((s) => s.logout)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  // The content pane (not the window) scrolls, so reset it on every page change
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* storage blocked: keep the in-memory state */
      }
      return !c
    })
  }

  return (
    <div data-app={meta.id} className="flex h-dvh flex-col bg-gray-50">
      {/* ── Header ───────────────────────────────── */}
      <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Link to={meta.path} className="flex shrink-0 items-center gap-3">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-8 w-auto" />
        </Link>
        <span className="hidden h-6 w-px bg-gray-100 sm:block" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-heading font-semibold">{orgName}</span>
          {orgBadge}
        </div>

        <form
          className="mx-4 hidden max-w-md flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault()
            const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
            if (onSearch && q) onSearch(q)
            else if (!onSearch) toast.info(t('search.comingSoon'))
          }}
        >
          <label className="relative block">
            <span className="sr-only">{t('search.label')}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder={t(searchPlaceholderKey)}
              className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-body outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1">
          {headerActions}
          <LanguageToggle />
          <Button variant="ghost" size="icon" className="relative" aria-label={unread ? t('header.notificationsUnread', { count: unread }) : t('header.notifications')} onClick={() => navigate(`${meta.path}/notifications`)}>
            <Bell />
            {unread > 0 && (
              <span className="tabular absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-semibold text-white" aria-hidden>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('header.help')} onClick={() => navigate(`${meta.path}/${helpPath}`)}>
            <CircleHelp />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground">
                  {initials(user.name)}
                </span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-caption font-semibold">{user.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{user.roleLabel}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block">{user.name}</span>
                <span className="block text-caption font-normal text-muted-foreground">{user.roleLabel}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {preferencesPath && (
                <DropdownMenuItem onSelect={() => navigate(`${meta.path}/${preferencesPath}`)}>
                  <SlidersHorizontal /> {t('header.preferences')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate(`/launch/${meta.id}`)}>
                <Repeat /> {t('header.switchPersona')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/')}>
                <SquareArrowOutUpRight /> {t('header.launcher')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  logout(app)
                  navigate(`/launch/${meta.id}`)
                }}
              >
                <LogOut /> {t('header.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar ──────────────────────────────── */}
        <aside
          className={cn(
            'flex shrink-0 flex-col border-r transition-[width] duration-200',
            collapsed ? 'w-16' : 'w-60',
            dark ? 'border-charcoal bg-charcoal text-gray-100' : 'bg-background',
          )}
        >
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={t('nav.label')}>
            {nav.map((group, gi) => (
              <div key={group.labelKey ?? gi} className="mb-3">
                {group.labelKey && !collapsed && (
                  <div className={cn('px-3 pb-1 text-[11px] font-semibold tracking-wide uppercase', dark ? 'text-gray-500' : 'text-muted-foreground')}>
                    {t(group.labelKey)}
                  </div>
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <SidebarItem key={item.path + item.labelKey} item={item} base={meta.path} collapsed={collapsed} dark={dark} />
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            className={cn('flex h-10 items-center gap-2 border-t px-5 text-caption', dark ? 'border-gray-700 text-gray-500 hover:text-gray-100' : 'text-muted-foreground hover:text-foreground')}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && t('nav.collapse')}
          </button>
        </aside>

        {/* ── Content ──────────────────────────────── */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
      {assistant}
    </div>
  )
}

function SidebarItem<Ctx>({ item, base, collapsed, dark }: { item: NavItem<Ctx>; base: string; collapsed: boolean; dark?: boolean }) {
  const { t } = useTranslation()
  const location = useLocation()
  const to = (p: string) => (p ? `${base}/${p}` : base)
  const childActive = item.children?.some((c) => location.pathname === to(c.path) || location.pathname.startsWith(`${to(c.path)}/`))
  const [open, setOpen] = useState(!!childActive)
  const Icon = item.icon
  const label = t(item.labelKey)

  const linkClass = (active: boolean) =>
    cn(
      'flex h-9 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : dark
          ? 'text-gray-100/80 hover:bg-white/10 hover:text-white'
          : 'text-gray-700 hover:bg-accent hover:text-foreground',
    )

  const withTooltip = (node: React.ReactElement) =>
    collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      node
    )

  if (!item.children) {
    return (
      <li>
        {withTooltip(
          <NavLink to={to(item.path)} end className={({ isActive }) => linkClass(isActive)}>
            {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>,
        )}
      </li>
    )
  }

  // Group with sub-items. Collapsed: the icon opens the first sub-item.
  if (collapsed) {
    return <li>{withTooltip(<NavLink to={to(item.children[0].path)} className={() => linkClass(!!childActive)}>{Icon && <Icon className="size-4 shrink-0" aria-hidden />}</NavLink>)}</li>
  }
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open || childActive} className={cn(linkClass(false), 'w-full', childActive && (dark ? 'text-white' : 'text-foreground'))}>
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown className={cn('size-4 transition-transform', (open || childActive) && 'rotate-180')} aria-hidden />
      </button>
      {(open || childActive) && (
        <ul className={cn('mt-0.5 ml-5 flex flex-col gap-0.5 border-l pl-2', dark ? 'border-gray-700' : 'border-gray-100')}>
          {item.children.map((c) => (
            <li key={c.path}>
              <NavLink to={to(c.path)} end className={({ isActive }) => cn(linkClass(isActive), 'h-8 text-table')}>
                <span className="truncate">{t(c.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
