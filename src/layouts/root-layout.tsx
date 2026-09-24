import { PRIMARY_NAVIGATION, ROUTE } from '@/router/routes'
import { Flex, Typography } from '@/shared/ui'
import { cn, Navbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/react'
import { NavLink, Outlet } from 'react-router-dom'
import { GithubButton } from './components/github-button'

const RootLayout = () => {
  return (
    <>
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
              Main Sequence <span className="text-primary">/</span> Planner
            </Typography>
          </NavbarBrand>

          <nav aria-label="Primary navigation" className="min-w-0 flex-1 overflow-hidden lg:flex-[3]">
            <ul className="m-0 flex h-full w-full min-w-0 list-none items-center justify-center gap-1 p-0">
              {PRIMARY_NAVIGATION.map((item) => (
                <li key={item.path} className="shrink-0">
                  <NavLink
                    to={item.path}
                    end={item.path === ROUTE.HOME}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex items-center gap-1.5 rounded-sm border-b-2 border-transparent px-2.5 py-2 text-foreground/75 outline-none transition-colors',
                        'hover:bg-default/35 hover:text-foreground',
                        'focus-visible:ring-2 focus-visible:ring-focus',
                        isActive && 'border-primary bg-default/60 text-foreground',
                      )
                    }
                  >
                    <item.icon size={17} aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
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
