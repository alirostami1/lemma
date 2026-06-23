import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@lemma/ui/components/avatar";
import { Button } from "@lemma/ui/components/button";
import { ButtonGroup } from "@lemma/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@lemma/ui/components/navigation-menu";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { LogIn, Menu, UserRoundPlus } from "lucide-react";
import { createKeycloakUtils } from "oidc-spa/keycloak";
import { primaryNavigation } from "#/features/navigation/app-navigation";
import { OidcInitializationGate, useOidc } from "#/lib/oidc";

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b px-5">
      <SiteNavigation />
      <OidcInitializationGate fallback={<AccountNavigationFallback />}>
        <AccountNavigation />
      </OidcInitializationGate>
    </header>
  );
}

export function SiteNavigation() {
  return (
    <>
      <NavigationMenu className="hidden md:flex">
        <NavigationMenuList className="gap-1">
          {primaryNavigation.map((link) => (
            <NavigationMenuItem key={link.to}>
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link to={link.to}>{link.label}</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open navigation menu"
            className="md:hidden"
            size="icon"
            variant="ghost"
          >
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuGroup>
            {primaryNavigation.map((link) => (
              <DropdownMenuItem asChild key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AccountNavigationFallback() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-50" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

export function AccountNavigation() {
  const oidc = useOidc();
  const keycloakUtils = createKeycloakUtils({ issuerUri: oidc.issuerUri });

  if (!oidc.isUserLoggedIn) {
    return (
      <ButtonGroup>
        <Button
          className="cursor-pointer align-middle"
          onClick={() =>
            oidc.login({
              doesCurrentHrefRequiresAuth: false,
              transformUrlBeforeRedirect:
                keycloakUtils.transformUrlBeforeRedirectForRegister,
            })
          }
          variant="outline"
        >
          <UserRoundPlus />
          Register
        </Button>
        <Button
          className="cursor-pointer align-middle"
          onClick={() => oidc.login()}
          variant="default"
        >
          <LogIn />
          Login
        </Button>
      </ButtonGroup>
    );
  }

  const accountUrl = keycloakUtils.getAccountUrl({
    clientId: oidc.clientId,
    validRedirectUri: oidc.validRedirectUri,
  });
  const decodedIdToken = oidc.decodedIdToken;
  const avatarLabel = getAvatarFallbackLabel(decodedIdToken.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Open account menu"
          className="rounded-full"
          size="icon"
          variant="ghost"
        >
          <Avatar>
            {decodedIdToken.picture ? (
              <AvatarImage className="size-10" src={decodedIdToken.picture} />
            ) : null}
            <AvatarFallback>{avatarLabel}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={accountUrl}>Profile</a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              oidc.logout({ redirectTo: "home" });
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getAvatarFallbackLabel(name: string) {
  const parts = name
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
