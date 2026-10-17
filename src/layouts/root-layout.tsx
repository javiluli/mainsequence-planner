import { PRIMARY_NAVIGATION, ROUTE } from '@/router/routes'
import { RouteSeo } from '@/router/route-seo'
import { Flex, Typography } from '@/shared/ui'
import { Button, Navbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { GithubButton } from './components/github-button'

/** Composes navigation and route content; NavLink remains the owner of the active destination. */
const RootLayout = () => {
  const { pathname } = useLocation()
  const currentSection = PRIMARY_NAVIGATION.find((item) => item.path === pathname)?.label ?? 'Planner'
  return (
    <>
      <RouteSeo />
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-50 rounded-sm bg-content1 px-3 py-2 text-sm text-foreground focus:not-sr-only focus-visible:ring-2 focus-visible:ring-focus"
      >
        Skip to main content
      </a>
      <Flex direction="col" align="stretch" className="h-dvh min-h-0 gap-0 overflow-hidden">
        <Navbar
          className="shrink-0 border-b border-divider/80 bg-content1"
          classNames={{ wrapper: 'min-w-0 gap-2 px-3 sm:px-4 lg:px-6' }}
          maxWidth="full"
        >
          <NavbarBrand className="hidden space-x-2 lg:flex">
            <Typography variant="h2" as="span" className="text-base font-semibold tracking-[0.08em] uppercase">
              Main Sequence <span className="text-primary">/</span> {currentSection}
            </Typography>
          </NavbarBrand>

          <nav aria-label="Primary navigation" className="min-w-0 flex-1 overflow-hidden lg:flex-[3]">
            <ul className="m-0 flex h-full w-full min-w-0 list-none items-center justify-center gap-1 p-0">
              {PRIMARY_NAVIGATION.map((item) => (
                <li key={item.path} className="shrink-0">
                  <Button
                    as={NavLink}
                    role="link"
                    to={item.path}
                    end={item.path === ROUTE.HOME}
                    aria-label={item.label}
                    size="sm"
                    color={pathname === item.path ? 'primary' : 'default'}
                    variant={pathname === item.path ? 'flat' : 'light'}
                    className="min-w-0 px-2.5"
                  >
                    <item.icon size={17} aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>

          <NavbarContent justify="end" className="hidden lg:flex">
            <NavbarItem>
              <GithubButton />
            </NavbarItem>
          </NavbarContent>
        </Navbar>

        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </Flex>
    </>
  )
}

export default RootLayout
