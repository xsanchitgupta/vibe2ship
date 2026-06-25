'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home,
  Camera,
  LayoutDashboard,
  Map,
  Trophy,
  ShieldCheck,
  Building2,
  LogIn,
  type LucideIcon,
} from 'lucide-react';
import { useSession } from '@/lib/useSession';
import NotificationBell from './NotificationBell';

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/report', label: 'Report', icon: Camera },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
];

function ActiveBg() {
  return (
    <motion.span
      layoutId="nav-active"
      className="nav-active-bg"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    />
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { profile } = useSession();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const links = [...LINKS];
  if (profile?.role === 'authority') {
    links.push({ href: '/authority', label: 'Authority', icon: Building2 });
  }

  return (
    <nav className="navbar">
      <motion.div
        className="navpill"
        initial={{ y: -22, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      >
        <Link href="/" className="navpill-logo">
          <motion.span className="logo-badge" whileHover={{ rotate: -8, scale: 1.08 }} whileTap={{ scale: 0.94 }}>
            <ShieldCheck size={18} />
          </motion.span>
          <span className="hide-sm">
            Community<span className="text-gradient">Hero</span>
          </span>
        </Link>

        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={`navpill-link ${active ? 'active' : ''}`} aria-label={label}>
              {active && <ActiveBg />}
              <span className="ico"><Icon size={17} /></span>
              <span className="label">{label}</span>
            </Link>
          );
        })}

        <NotificationBell />

        {profile ? (
          <Link href="/profile" className={`navpill-link ${isActive('/profile') ? 'active' : ''}`} title={profile.name} aria-label="Profile">
            {isActive('/profile') && <ActiveBg />}
            <span className="ico" style={{ fontSize: 17, lineHeight: 1 }}>{profile.avatar}</span>
            <span className="label">{profile.name.split(' ')[0]}</span>
          </Link>
        ) : (
          <Link href="/login" className={`navpill-link ${isActive('/login') ? 'active' : ''}`} aria-label="Sign in">
            {isActive('/login') && <ActiveBg />}
            <span className="ico"><LogIn size={17} /></span>
            <span className="label">Sign in</span>
          </Link>
        )}
      </motion.div>
    </nav>
  );
}
