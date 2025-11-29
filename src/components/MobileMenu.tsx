import { type ComponentType, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { NotificationsBell } from "@/components/NotificationsBell";
import LogoMark from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import {
  Home,
  Layers,
  Search as SearchIcon,
  PlusCircle,
  User,
  LogOut,
  FileWarning,
  ClipboardList,
  X,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProfilePath } from "@/lib/profile";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  onSignOut?: () => void;
  user?: {
    id: string;
    username?: string | null;
  } | null;
  isAdmin?: boolean;
  onNavigate?: () => void;
  onSignIn?: () => void;
}

interface MenuItem {
  label: string;
  to?: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  variant?: "default" | "destructive";
  testId?: string;
}

export const MOBILE_MENU_ID = "navigation-drawer";

const menuItemClasses =
  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium min-h-[44px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const MobileMenu = ({ open, onClose, user, onSignOut, onSignIn, onNavigate, isAdmin }: MobileMenuProps) => {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;

    if (open) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      body.style.overflow = "";
      body.style.paddingRight = "";
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  if (!open) return null;

  const handleNavigate = (callback?: () => void) => () => {
    callback?.();
    onNavigate?.();
    onClose();
  };

  const renderMenuItems = (items: MenuItem[], options?: { heading?: string; accent?: "default" | "destructive" }) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        {options?.heading ? (
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {options.heading}
          </p>
        ) : null}
        <div className="rounded-xl border border-border/70 bg-white/95 shadow-md">
          <div className="flex flex-col gap-1 p-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isDestructive =
                item.variant === "destructive" || options?.accent === "destructive";

              const sharedClasses = cn(
                menuItemClasses,
                "text-left text-foreground hover:bg-primary/5 active:bg-primary/10",
                isDestructive && "text-destructive hover:bg-destructive/10 active:bg-destructive/20"
              );

              if (item.to) {
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={handleNavigate(item.onClick)}
                    className={sharedClasses}
                    data-testid={item.testId}
                  >
                    <Icon className={cn("h-5 w-5 text-primary", isDestructive && "text-destructive")} />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={handleNavigate(item.onClick)}
                  className={sharedClasses}
                  data-testid={item.testId}
                >
                  <Icon className={cn("h-5 w-5 text-primary", isDestructive && "text-destructive")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const primaryItems: MenuItem[] = [
    { label: "Feed", to: "/feed", icon: Home },
    { label: "Venues", to: "/venues", icon: MapPin },
    { label: "Sessions", to: "/sessions", icon: Layers },
    { label: "Search", to: "/search", icon: SearchIcon },
  ];

  const accountItems: MenuItem[] = user
    ? [
        { label: "Profile", to: getProfilePath({ username: user.username, id: user.id }), icon: User },
        { label: "Sign Out", icon: LogOut, onClick: onSignOut, variant: "destructive" },
      ]
    : [];

  const adminItems: MenuItem[] = isAdmin
    ? [
        {
          label: "Reports",
          to: "/admin/reports",
          icon: FileWarning,
        },
        {
          label: "Audit Log",
          to: "/admin/audit-log",
          icon: ClipboardList,
        },
      ]
    : [];

  return createPortal(
    <div id={MOBILE_MENU_ID} className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 z-[55] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-[60] ml-auto flex h-full w-full max-w-sm flex-col overflow-y-auto bg-card px-5 pb-6 shadow-2xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12 shrink-0 rounded-full bg-primary/5 p-2" />
            <div className="leading-tight">
              <p className="text-lg font-semibold text-foreground">ReelyRated</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Freshwater Social</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="-mr-1">
                <NotificationsBell />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              asChild
            >
              <Link to="/search" onClick={handleNavigate()} aria-label="Open search">
                <SearchIcon className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={onClose}
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {renderMenuItems(primaryItems, { heading: "Primary" })}

          {user ? (
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Create
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-md">
                <Button
                  variant="ocean"
                  className="w-full justify-center gap-2 rounded-full py-3 text-base font-semibold"
                  asChild
                >
                  <Link to="/add-catch" onClick={handleNavigate()}>
                    <PlusCircle className="h-5 w-5" />
                    Add Catch
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-md">
                <Button
                  variant="ocean"
                  className="w-full justify-center gap-2 rounded-full py-3 text-base font-semibold"
                  asChild
                >
                  <Link to="/auth" onClick={handleNavigate(onSignIn)}>
                    Sign In
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {user ? renderMenuItems(accountItems, { heading: "Account" }) : null}

          {renderMenuItems(adminItems, { heading: "Admin" })}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MobileMenu;
