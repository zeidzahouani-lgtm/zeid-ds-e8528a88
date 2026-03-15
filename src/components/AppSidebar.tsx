import { Tv, Image, ListMusic, Clock, LayoutDashboard, LogOut, User, LayoutGrid, Users, Building2, Settings, Palette, Key, Sparkles, Mail, AtSign } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import { EstablishmentSwitcher } from "@/components/EstablishmentSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MonitorPlay } from "lucide-react";

const mainItems = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Écrans", url: "/displays", icon: Tv },
  { title: "Bibliothèque", url: "/library", icon: Image },
  { title: "Layouts", url: "/layouts", icon: LayoutGrid },
  { title: "Playlists", url: "/playlists", icon: ListMusic },
  { title: "Programmation", url: "/schedules", icon: Clock },
  { title: "Config. Écrans", url: "/setup", icon: Settings },
  { title: "Assistant IA", url: "/ai-assistant", icon: Sparkles },
  { title: "Flux Automatique", url: "/auto-flow", icon: Mail },
];

const establishmentAdminItems = [
  { title: "Utilisateurs", url: "/admin/users", icon: Users },
  { title: "Personnalisation", url: "/admin/customization", icon: Palette },
  { title: "Email", url: "/admin/email", icon: AtSign },
  { title: "Config. Établissement", url: "/admin/establishment-settings", icon: Settings },
];

const globalAdminItems = [
  { title: "Établissements", url: "/admin/establishments", icon: Building2 },
  { title: "Licences", url: "/admin/licenses", icon: Key },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { isGlobalAdmin, isEstablishmentAdmin, currentEstablishmentId, memberships } = useEstablishmentContext();
  const { getSetting } = useEstablishmentSettings(currentEstablishmentId);

  const showAdminSection = isGlobalAdmin || isEstablishmentAdmin;

  // Establishment branding for sidebar
  const estLogoUrl = !isGlobalAdmin && currentEstablishmentId ? getSetting("brand_logo_url") : null;
  const estName = !isGlobalAdmin && currentEstablishmentId ? getSetting("brand_name") : null;
  // Fallback to establishment table logo
  const currentEst = memberships.find(m => m.establishment_id === currentEstablishmentId);
  const displayLogo = estLogoUrl || (!isGlobalAdmin && currentEst?.establishment ? (currentEst.establishment as any).logo_url : null) || settings.logo_url;
  const displayName = estName || settings.app_name;

  const showAdminSection = isGlobalAdmin || isEstablishmentAdmin;

  return (
    <Sidebar collapsible="icon" className="glass-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={settings.app_name} className="h-9 w-9 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 shadow-neon-cyan">
              <MonitorPlay className="h-5 w-5 text-primary icon-neon" />
            </div>
          )}
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold tracking-widest neon-glow-cyan normal-case">{settings.app_name}</h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{settings.app_tagline}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {!collapsed && <EstablishmentSwitcher />}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/60 uppercase tracking-widest text-[10px]">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-primary/5 transition-all duration-200 group" activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                      <item.icon className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
                      {!collapsed && <span className="normal-case tracking-normal">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminSection && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/60 uppercase tracking-widest text-[10px]">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Establishment admin items: visible to establishment admins & global admins */}
                {(isEstablishmentAdmin || isGlobalAdmin) && establishmentAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url} end className="hover:bg-accent/5 transition-all duration-200 group" activeClassName="bg-accent/10 text-accent font-medium border-l-2 border-accent">
                        <item.icon className="mr-2 h-4 w-4 group-hover:text-accent transition-colors" />
                        {!collapsed && <span className="normal-case tracking-normal">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {/* Global admin only items */}
                {isGlobalAdmin && globalAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url} end className="hover:bg-accent/5 transition-all duration-200 group" activeClassName="bg-accent/10 text-accent font-medium border-l-2 border-accent">
                        <item.icon className="mr-2 h-4 w-4 group-hover:text-accent transition-colors" />
                        {!collapsed && <span className="normal-case tracking-normal">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground truncate mb-2">
            <User className="h-3.5 w-3.5 shrink-0 text-primary/50" />
            <span className="truncate">{user.email}</span>
          </div>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" />
          {!collapsed && "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
