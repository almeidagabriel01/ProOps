"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Crown, ChevronRight } from "lucide-react";
import { MenuItem, getVisibleChildren } from "./config";
import { usePermissions } from "@/providers/permissions-provider";

interface MenuItemLinkProps {
  item: MenuItem;
  isActive: boolean;
  isExpanded: boolean;
}

export function MenuItemLink({
  item,
  isActive,
  isExpanded,
}: MenuItemLinkProps) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
        isExpanded ? "gap-3" : "gap-0 justify-center px-0",
        isActive
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <item.icon
        className={cn(
          "w-5 h-5 shrink-0 transition-transform duration-200",
          !isActive && "group-hover:scale-110",
        )}
      />
      {isExpanded && (
        <>
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              isExpanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2 w-0",
              !isActive && "group-hover:translate-x-1",
            )}
          >
            {item.label}
          </span>
          {isActive && (
            <div
              className={cn(
                "ml-auto h-2 w-2 rounded-full bg-primary transition-all duration-300",
                isExpanded ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </>
      )}
    </Link>
  );
}

interface RestrictedMenuItemProps {
  item: MenuItem;
  isExpanded: boolean;
  premiumColor: string;
  onUpgrade: () => void;
}

export function RestrictedMenuItem({
  item,
  isExpanded,
  premiumColor,
  onUpgrade,
}: RestrictedMenuItemProps) {
  return (
    <button
      onClick={onUpgrade}
      className={cn(
        "group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full hover:bg-primary/10 cursor-pointer",
        isExpanded ? "gap-3" : "gap-0 justify-center px-0",
      )}
      style={{ color: premiumColor }}
    >
      <div className="relative shrink-0">
        <item.icon className="w-5 h-5" />
        <Crown
          className={cn(
            "absolute -top-1.5 -right-1.5 w-3 h-3 transition-all duration-300",
            isExpanded ? "opacity-0 scale-75" : "opacity-100 scale-100",
          )}
          style={{ color: premiumColor }}
        />
      </div>
      {isExpanded && (
        <>
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300 flex-1 text-left",
              isExpanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2 w-0",
            )}
          >
            {item.label}
          </span>
          <Crown
            className={cn(
              "w-4 h-4 shrink-0 transition-all duration-300",
              isExpanded ? "opacity-100" : "opacity-0",
            )}
            style={{ color: premiumColor }}
          />
        </>
      )}
    </button>
  );
}

interface SubmenuItemProps {
  item: MenuItem;
  isExpanded: boolean;
  isSubmenuOpen: boolean;
  isParentActive: boolean;
  onToggle: () => void;
  pathname: string;
}

export function SubmenuItem({
  item,
  isExpanded,
  isSubmenuOpen,
  isParentActive,
  onToggle,
  pathname,
}: SubmenuItemProps) {
  const { isMaster } = usePermissions();
  const visibleChildren = getVisibleChildren(item, isMaster);

  return (
    <div>
      {/* Parent menu item */}
      <button
        onClick={onToggle}
        className={cn(
          "group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full cursor-pointer",
          isExpanded ? "gap-3" : "gap-0 justify-center px-0",
          isParentActive
            ? "text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon
          className={cn(
            "w-5 h-5 shrink-0 transition-transform duration-200",
            !isParentActive && "group-hover:scale-110",
          )}
        />
        {isExpanded && (
          <>
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                isExpanded
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 w-0",
              )}
            >
              {item.label}
            </span>
            <ChevronRight
              className={cn(
                "w-4 h-4 shrink-0 transition-all duration-300",
                isExpanded ? "opacity-100" : "opacity-0",
                isSubmenuOpen && "rotate-90",
              )}
            />
          </>
        )}
      </button>

      {/* Submenu items */}
      {isSubmenuOpen && isExpanded && (
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-border/50 pl-3">
          {visibleChildren.map((child) => {
            const isChildActive =
              pathname === child.href || pathname.startsWith(child.href + "/");

            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                  isChildActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <child.icon className="w-4 h-4 shrink-0" />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
