import { AuthModal } from "~/components/auth-modal"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList
} from "~/components/ui/navigation-menu"
import { Logo } from "./logo"

/** Rendered by the `(public)` route group, so no session check decides it. */
export function PublicNavbar() {
  return (
    <div className="fixed w-full bg-background px-4 py-2 shadow-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Logo />
        <NavigationMenu className="w-full justify-between">
          <NavigationMenuList>
            <NavigationMenuItem asChild>
              <AuthModal label="Login" initialModal="login" />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  )
}
