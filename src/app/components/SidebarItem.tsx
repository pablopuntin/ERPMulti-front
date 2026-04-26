
//refactor
"use client";

import Link from "next/link";

export function SidebarItem({
  icon: Icon,
  label,
  open,
  href,
}: {
  icon: React.ElementType;
  label: string;
  open: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-hover transition-colors text-text"
    >
      <Icon className="w-5 h-5 text-icon" />

      {open && (
        <span className="transition-opacity duration-200 opacity-100">{label}</span>
      )}
    </Link>
  );
}
