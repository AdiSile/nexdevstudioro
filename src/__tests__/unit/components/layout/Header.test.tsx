import React from "react";
import { render, screen, act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/layout/Header";
import type {
  NavItem,
  MegaMenuConfig,
  NotificationItem,
  UserMenuConfig,
} from "@/components/layout/Header";
import {
  LayoutDashboard,
  Settings,
  FileText,
  Users,
  ShoppingCart,
  Package,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Acasă", href: "/" },
  {
    id: "services",
    label: "Servicii",
    children: [
      { id: "web", label: "Web Development", href: "/servicii/web" },
      { id: "mobile", label: "Mobile Apps", href: "/servicii/mobile" },
    ],
  },
  { id: "portfolio", label: "Portofoliu", href: "/portofoliu" },
  { id: "blog", label: "Blog", href: "/blog" },
  { id: "contact", label: "Contact", href: "/contact" },
];

const DEFAULT_MEGA_MENUS: MegaMenuConfig[] = [
  {
    triggerId: "services",
    groups: [
      {
        label: "Dezvoltare",
        icon: <Zap data-testid="mega-icon-dev" className="h-4 w-4" />,
        items: [
          {
            id: "web-dev",
            label: "Web Development",
            description: "Aplicații web moderne",
            icon: <LayoutDashboard className="h-4 w-4" />,
          },
          {
            id: "mobile-dev",
            label: "Mobile Apps",
            description: "iOS și Android",
            icon: <Package className="h-4 w-4" />,
          },
        ],
      },
      {
        label: "Design",
        items: [
          { id: "ui-ux", label: "UI/UX Design", description: "Interfețe frumoase" },
          { id: "branding", label: "Branding", description: "Identitate vizuală" },
        ],
      },
    ],
    featured: {
      title: "Pachet complet",
      description: "Dezvoltare + Design + Mentenanță",
      cta: { label: "Află mai multe", href: "/servicii/pachet" },
    },
  },
];

const DEFAULT_USER_CONFIG: UserMenuConfig = {
  displayName: "Maria Popescu",
  email: "maria@example.com",
  initials: "MP",
};

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Proiect nou asignat",
    description: "Ai fost asignat la proiectul 'Redesign Platformă'",
    timestamp: new Date(Date.now() - 5 * 60_000),
    read: false,
    type: "info",
  },
  {
    id: "n2",
    title: "Factură emisă",
    description: "Factura #INV-2024-0341 a fost emisă",
    timestamp: new Date(Date.now() - 60 * 60_000),
    read: false,
    type: "success",
  },
  {
    id: "n3",
    title: "Termen limită aproape",
    description: "Task-ul 'Review final' are termenul mâine",
    timestamp: new Date(Date.now() - 2 * 60 * 60_000),
    read: true,
    type: "warning",
  },
];

const setup = (overrides: Partial<Parameters<typeof Header>[0]> = {}) => {
  const user = userEvent.setup();
  const onNavItemClick = jest.fn();
  const onSearch = jest.fn();
  const onNotificationClick = jest.fn();
  const onNotificationsMarkAllRead = jest.fn();
  const onUserMenuItemClick = jest.fn();
  const onLogout = jest.fn();
  const onThemeToggle = jest.fn();
  const onSearchSuggestionSelect = jest.fn();
  const onNotificationBellClick = jest.fn();

  const utils = render(
    <Header
      navItems={DEFAULT_NAV_ITEMS}
      megaMenus={DEFAULT_MEGA_MENUS}
      showSearch={true}
      showNotifications={true}
      showUserMenu={true}
      showThemeToggle={true}
      userMenuConfig={DEFAULT_USER_CONFIG}
      notifications={DEFAULT_NOTIFICATIONS}
      onNavItemClick={onNavItemClick}
      onSearch={onSearch}
      onNotificationClick={onNotificationClick}
      onNotificationsMarkAllRead={onNotificationsMarkAllRead}
      onUserMenuItemClick={onUserMenuItemClick}
      onLogout={onLogout}
      onThemeToggle={onThemeToggle}
      onSearchSuggestionSelect={onSearchSuggestionSelect}
      onNotificationBellClick={onNotificationBellClick}
      mobileBreakpoint={1024}
      {...overrides}
    />,
  );

  return {
    user,
    onNavItemClick,
    onSearch,
    onNotificationClick,
    onNotificationsMarkAllRead,
    onUserMenuItemClick,
    onLogout,
    onThemeToggle,
    onSearchSuggestionSelect,
    onNotificationBellClick,
    ...utils,
  };
};

// ═══════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════

describe("Header rendering", () => {
  it("renders the header element", () => {
    setup();
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders the default logo text when no custom logo provided", () => {
    setup();
    expect(screen.getByText("Nexus")).toBeInTheDocument();
  });

  it("renders a custom logo when provided", () => {
    setup({
      logo: <span data-testid="custom-logo">MyBrand</span>,
    });
    expect(screen.getByTestId("custom-logo")).toBeInTheDocument();
    expect(screen.getByText("MyBrand")).toBeInTheDocument();
    expect(screen.queryByText("Nexus")).not.toBeInTheDocument();
  });

  it("renders navigation items", () => {
    setup();
    expect(screen.getByText("Acasă")).toBeInTheDocument();
    expect(screen.getByText("Servicii")).toBeInTheDocument();
    expect(screen.getByText("Portofoliu")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    setup();
    const searchInput = screen.getByRole("combobox");
    expect(searchInput).toBeInTheDocument();
  });

  it("renders the theme toggle button", () => {
    setup();
    const themeBtn = screen.getByLabelText("Comută la tema întunecată");
    expect(themeBtn).toBeInTheDocument();
  });

  it("renders the notifications bell", () => {
    setup();
    const notifBtn = screen.getByLabelText("Notificări");
    expect(notifBtn).toBeInTheDocument();
  });

  it("renders the user menu trigger with display name", () => {
    setup();
    expect(screen.getByText("Maria Popescu")).toBeInTheDocument();
  });

  it("renders user avatar initials", () => {
    setup();
    expect(screen.getByText("MP")).toBeInTheDocument();
  });

  it("renders the mobile menu toggle button", () => {
    setup();
    const toggle = screen.getByLabelText("Deschide meniul");
    expect(toggle).toBeInTheDocument();
  });

  it("does not render mega menu when closed", () => {
    setup();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders unread notification count badge", () => {
    setup();
    // 2 unread out of 3
    const badge = screen.getByText("2");
    // The badge is inside the notifications trigger; we need to verify it's the count badge
    const notifBtn = screen.getByLabelText("Notificări");
    const badgeEl = within(notifBtn).getByText("2");
    expect(badgeEl).toBeInTheDocument();
  });

  it("does not render notification count when zero unread", () => {
    setup({
      notifications: [
        { ...DEFAULT_NOTIFICATIONS[0], read: true },
        { ...DEFAULT_NOTIFICATIONS[1], read: true },
        { ...DEFAULT_NOTIFICATIONS[2], read: true },
      ],
    });
    const notifBtn = screen.getByLabelText("Notificări");
    // Badge should not show "0"
    expect(within(notifBtn).queryByText("0")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variants
// ═══════════════════════════════════════════════════════════════════════

describe("Header variants", () => {
  it("applies default variant styles", () => {
    setup({ variant: "default" });
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "default");
  });

  it("applies transparent variant styles", () => {
    setup({ variant: "transparent" });
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "transparent");
  });

  it("applies colored variant styles", () => {
    setup({ variant: "colored" });
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "colored");
  });

  it("default variant is 'default'", () => {
    const { container } = render(<Header />);
    const header = container.querySelector("[data-header]");
    expect(header).toHaveAttribute("data-variant", "default");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════════════════

describe("Header navigation", () => {
  it("calls onNavItemClick when a nav item is clicked", async () => {
    const { user, onNavItemClick } = setup();
    const acasaBtn = screen.getByText("Acasă");
    await user.click(acasaBtn);
    expect(onNavItemClick).toHaveBeenCalledTimes(1);
    expect(onNavItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "home", label: "Acasă" }),
      expect.any(Object),
    );
  });

  it("toggles mega menu when a nav item with mega menu is clicked", async () => {
    const { user } = setup();
    const serviciiBtn = screen.getByText("Servicii");
    await user.click(serviciiBtn);

    await waitFor(() => {
      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
    });
  });

  it("closes mega menu on second click", async () => {
    const { user } = setup();
    const serviciiBtn = screen.getByText("Servicii");
    await user.click(serviciiBtn);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    await user.click(serviciiBtn);

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("marks active nav item with aria-current", () => {
    setup({ activeNavId: "home" });
    const acasaBtn = screen.getByText("Acasă").closest("button");
    expect(acasaBtn).toHaveAttribute("aria-current", "page");
  });

  it("inactive nav items do not have aria-current", () => {
    setup({ activeNavId: "home" });
    const blogBtn = screen.getByText("Blog").closest("button");
    expect(blogBtn).not.toHaveAttribute("aria-current");
  });

  it("nav items with children have aria-haspopup", () => {
    setup();
    const serviciiBtn = screen.getByText("Servicii").closest("button");
    expect(serviciiBtn).toHaveAttribute("aria-haspopup", "menu");
  });

  it("nav items without children do not have aria-haspopup", () => {
    setup();
    const acasaBtn = screen.getByText("Acasă").closest("button");
    expect(acasaBtn).not.toHaveAttribute("aria-haspopup");
  });

  it("disabled nav items have disabled attribute", () => {
    setup({
      navItems: [
        { id: "disabled", label: "Dezactivat", disabled: true },
      ],
    });
    const btn = screen.getByText("Dezactivat").closest("button");
    expect(btn).toBeDisabled();
  });

  it("renders badge on nav items", () => {
    setup({
      navItems: [
        { id: "new", label: "Nou", badge: "Nou" },
      ],
    });
    expect(screen.getByText("Nou")).toBeInTheDocument();
  });

  it("nav items with mega menu show chevron icon", () => {
    setup();
    const serviciiBtn = screen.getByText("Servicii").closest("button");
    const svg = serviciiBtn?.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Mega Menu
// ═══════════════════════════════════════════════════════════════════════

describe("Header mega menu", () => {
  it("renders mega menu groups when open", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByText("Dezvoltare")).toBeInTheDocument();
      expect(screen.getByText("Design")).toBeInTheDocument();
    });
  });

  it("renders mega menu items with descriptions", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByText("Web Development")).toBeInTheDocument();
      expect(screen.getByText("Aplicații web moderne")).toBeInTheDocument();
      expect(screen.getByText("Mobile Apps")).toBeInTheDocument();
      expect(screen.getByText("iOS și Android")).toBeInTheDocument();
    });
  });

  it("renders featured card in mega menu", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByText("Pachet complet")).toBeInTheDocument();
      expect(
        screen.getByText("Dezvoltare + Design + Mentenanță"),
      ).toBeInTheDocument();
      expect(screen.getByText("Află mai multe")).toBeInTheDocument();
    });
  });

  it("renders group icons in mega menu", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByTestId("mega-icon-dev")).toBeInTheDocument();
    });
  });

  it("closes mega menu on Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes mega menu when clicking another nav item", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Blog"));

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("disabled mega menu items are not clickable", async () => {
    const megaMenusWithDisabled: MegaMenuConfig[] = [
      {
        triggerId: "services",
        groups: [
          {
            label: "Test",
            items: [
              {
                id: "disabled-item",
                label: "Disabled Link",
                disabled: true,
              },
            ],
          },
        ],
      },
    ];

    setup({
      megaMenus: megaMenusWithDisabled,
    });

    const { user } = userEvent.setup();
    await user.click(screen.getByText("Servicii"));

    await waitFor(() => {
      const link = screen.getByText("Disabled Link").closest("a");
      expect(link).toHaveClass("opacity-50");
      expect(link).toHaveClass("pointer-events-none");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════════════

describe("Header search", () => {
  it("renders search input with placeholder", () => {
    setup({ searchPlaceholder: "Caută produse..." });
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Caută produse...");
  });

  it("renders default search placeholder", () => {
    setup();
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Căutare...");
  });

  it("can hide search bar", () => {
    setup({ showSearch: false });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("calls onSearch when typing", async () => {
    const { user, onSearch } = setup();
    const input = screen.getByRole("combobox");
    await user.type(input, "test query");

    await waitFor(
      () => {
        expect(onSearch).toHaveBeenCalledWith("test query");
      },
      { timeout: 1000 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════

describe("Header notifications", () => {
  const openNotifications = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);
    await waitFor(() => {
      expect(screen.getByText("Notificări")).toBeInTheDocument();
    });
  };

  it("opens notifications dropdown on bell click", async () => {
    const { user } = setup();
    await openNotifications(user);
    // Dropdown should show notification items
    expect(
      screen.getByText("Proiect nou asignat"),
    ).toBeInTheDocument();
  });

  it("calls onNotificationBellClick when bell is clicked", async () => {
    const { user, onNotificationBellClick } = setup();
    await openNotifications(user);
    expect(onNotificationBellClick).toHaveBeenCalledTimes(1);
  });

  it("calls onNotificationClick when a notification is clicked", async () => {
    const { user, onNotificationClick } = setup();
    await openNotifications(user);

    const notif = screen.getByText("Proiect nou asignat");
    await user.click(notif);

    expect(onNotificationClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1" }),
    );
  });

  it("shows 'Mark all as read' when there are unread notifications", async () => {
    const { user } = setup();
    await openNotifications(user);

    expect(
      screen.getByText("Marchează tot ca citit"),
    ).toBeInTheDocument();
  });

  it("calls onNotificationsMarkAllRead", async () => {
    const { user, onNotificationsMarkAllRead } = setup();
    await openNotifications(user);

    const markAllBtn = screen.getByText("Marchează tot ca citit");
    await user.click(markAllBtn);

    expect(onNotificationsMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("does not show 'Mark all as read' when all notifications are read", async () => {
    setup({
      notifications: DEFAULT_NOTIFICATIONS.map((n) => ({
        ...n,
        read: true,
      })),
    });
    const { user } = userEvent.setup();
    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText("Notificări")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Marchează tot ca citit"),
    ).not.toBeInTheDocument();
  });

  it("shows empty state when there are no notifications", async () => {
    setup({ notifications: [] });
    const { user } = userEvent.setup();
    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText("Nicio notificare")).toBeInTheDocument();
    });
  });

  it("shows notification descriptions", async () => {
    const { user } = setup();
    await openNotifications(user);

    expect(
      screen.getByText("Ai fost asignat la proiectul 'Redesign Platformă'"),
    ).toBeInTheDocument();
  });

  it("shows relative timestamps", async () => {
    const { user } = setup();
    await openNotifications(user);

    // The first notification is 5 min ago -> "5m"
    expect(screen.getByText("5m")).toBeInTheDocument();
  });

  it("shows 'Vezi toate notificările' link", async () => {
    const { user } = setup();
    await openNotifications(user);

    expect(
      screen.getByText("Vezi toate notificările"),
    ).toBeInTheDocument();
  });

  it("can hide notifications bell", () => {
    setup({ showNotifications: false });
    expect(screen.queryByLabelText("Notificări")).not.toBeInTheDocument();
  });

  it("calls notification onClick handler", async () => {
    const notifOnClick = jest.fn();
    const notificationsWithClick: NotificationItem[] = [
      {
        id: "clickable",
        title: "Click me",
        timestamp: new Date(),
        read: false,
        onClick: notifOnClick,
      },
    ];

    const { user } = setup({ notifications: notificationsWithClick });
    await openNotifications(user);

    await user.click(screen.getByText("Click me"));
    expect(notifOnClick).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// User Menu
// ═══════════════════════════════════════════════════════════════════════

describe("Header user menu", () => {
  const openUserMenu = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    const userBtn = screen.getByText("Maria Popescu").closest("button")!;
    await user.click(userBtn);
    await waitFor(() => {
      expect(screen.getByText("Profil")).toBeInTheDocument();
    });
  };

  it("opens user menu on trigger click", async () => {
    const { user } = setup();
    await openUserMenu(user);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows user email in menu header", async () => {
    const { user } = setup();
    await openUserMenu(user);
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("calls onLogout when Deconectare is clicked", async () => {
    const { user, onLogout } = setup();
    await openUserMenu(user);

    const logoutBtn = screen.getByText("Deconectare");
    await user.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders custom user menu items", async () => {
    const customItems: NavItem[] = [
      { id: "billing", label: "Facturare", icon: <FileText data-testid="billing-icon" /> },
      { id: "team", label: "Echipa mea", icon: <Users data-testid="team-icon" /> },
    ];

    setup({
      userMenuConfig: {
        ...DEFAULT_USER_CONFIG,
        items: customItems,
      },
    });

    const { user } = userEvent.setup();
    const userBtn = screen.getByText("Maria Popescu").closest("button")!;
    await user.click(userBtn);

    await waitFor(() => {
      expect(screen.getByText("Facturare")).toBeInTheDocument();
      expect(screen.getByText("Echipa mea")).toBeInTheDocument();
    });
  });

  it("calls onUserMenuItemClick for custom items", async () => {
    const customItems: NavItem[] = [
      { id: "billing", label: "Facturare" },
    ];

    const { onUserMenuItemClick } = setup({
      userMenuConfig: {
        ...DEFAULT_USER_CONFIG,
        items: customItems,
      },
    });

    const { user } = userEvent.setup();
    const userBtn = screen.getByText("Maria Popescu").closest("button")!;
    await user.click(userBtn);

    await waitFor(() => {
      expect(screen.getByText("Facturare")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Facturare"));

    expect(onUserMenuItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "billing" }),
      expect.any(Object),
    );
  });

  it("renders footer items after separator", async () => {
    setup({
      userMenuConfig: {
        ...DEFAULT_USER_CONFIG,
        footerItems: [
          { id: "api", label: "API Keys", icon: <Settings data-testid="api-icon" /> },
        ],
      },
    });

    const { user } = userEvent.setup();
    const userBtn = screen.getByText("Maria Popescu").closest("button")!;
    await user.click(userBtn);

    await waitFor(() => {
      expect(screen.getByText("API Keys")).toBeInTheDocument();
    });
  });

  it("renders avatar image when avatarUrl provided", () => {
    setup({
      userMenuConfig: {
        ...DEFAULT_USER_CONFIG,
        avatarUrl: "https://example.com/avatar.jpg",
      },
    });

    const img = screen.getByAlt("Maria Popescu");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("can hide user menu", () => {
    setup({ showUserMenu: false });
    expect(screen.queryByText("Maria Popescu")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Theme Toggle
// ═══════════════════════════════════════════════════════════════════════

describe("Header theme toggle", () => {
  it("calls onThemeToggle when theme button is clicked", async () => {
    const { user, onThemeToggle } = setup();
    const btn = screen.getByLabelText("Comută la tema întunecată");
    await user.click(btn);
    expect(onThemeToggle).toHaveBeenCalledTimes(1);
  });

  it("shows sun icon when dark theme is active", () => {
    setup({ theme: "dark" });
    const btn = screen.getByLabelText("Comută la tema luminoasă");
    expect(btn).toBeInTheDocument();
  });

  it("shows moon icon when light theme is active", () => {
    setup({ theme: "light" });
    const btn = screen.getByLabelText("Comută la tema întunecată");
    expect(btn).toBeInTheDocument();
  });

  it("can hide theme toggle", () => {
    setup({ showThemeToggle: false });
    expect(
      screen.queryByLabelText("Comută la tema întunecată"),
    ).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Mobile
// ═══════════════════════════════════════════════════════════════════════

describe("Header mobile", () => {
  // Mock window.matchMedia for mobile
  const setMobile = () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  };

  const setDesktop = () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  };

  it("toggles mobile menu on hamburger click", async () => {
    setMobile();
    const { user } = setup();

    const toggle = screen.getByLabelText("Deschide meniul");
    await user.click(toggle);

    // Drawer should be visible
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("closes mobile menu on X click", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const closeBtn = within(screen.getByRole("dialog")).getByLabelText(
      "Închide meniul",
    );
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes mobile menu on backdrop click", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click the backdrop (aria-hidden overlay)
    const backdrop = document.querySelector(".z-drawer.bg-surface-overlay");
    if (backdrop) {
      await user.click(backdrop);
    }

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows navigation items in mobile menu", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      const drawer = screen.getByRole("dialog");
      expect(within(drawer).getByText("Acasă")).toBeInTheDocument();
      expect(within(drawer).getByText("Servicii")).toBeInTheDocument();
      expect(within(drawer).getByText("Blog")).toBeInTheDocument();
    });
  });

  it("expands mega menu items in mobile view", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const drawer = screen.getByRole("dialog");
    const serviciiLink = within(drawer).getByText("Servicii");
    await user.click(serviciiLink);

    await waitFor(() => {
      expect(within(drawer).getByText("Dezvoltare")).toBeInTheDocument();
      expect(within(drawer).getByText("Design")).toBeInTheDocument();
    });
  });

  it("shows search in mobile menu", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      const drawer = screen.getByRole("dialog");
      const searchInputs = within(drawer).getAllByRole("combobox");
      expect(searchInputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders custom mobile menu content", async () => {
    setMobile();
    const { user } = setup({
      mobileMenuContent: (
        <div data-testid="custom-mobile">Custom Mobile Content</div>
      ),
    });

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      expect(screen.getByTestId("custom-mobile")).toBeInTheDocument();
    });
  });

  it("shows mobile toggle with proper aria-expanded", async () => {
    setMobile();
    const { user } = setup();

    const toggle = screen.getByLabelText("Deschide meniul");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("shows X icon when mobile menu is open", async () => {
    setMobile();
    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      expect(screen.getByLabelText("Închide meniul")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sticky behaviour
// ═══════════════════════════════════════════════════════════════════════

describe("Header sticky", () => {
  it("is sticky by default", () => {
    setup();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky");
    expect(header).toHaveClass("top-0");
  });

  it("can disable sticky", () => {
    setup({ sticky: false });
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("sticky");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Logo
// ═══════════════════════════════════════════════════════════════════════

describe("Header logo", () => {
  it("logo links to '/' by default", () => {
    setup();
    const logoLink = screen.getByLabelText("Acasă");
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("logo links to custom href", () => {
    setup({ logoHref: "/dashboard" });
    const logoLink = screen.getByLabelText("Acasă");
    expect(logoLink).toHaveAttribute("href", "/dashboard");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════

describe("Header edge cases", () => {
  it("renders without any optional props", () => {
    const { container } = render(<Header />);
    const header = container.querySelector("[data-header]");
    expect(header).toBeInTheDocument();
  });

  it("renders with empty nav items", () => {
    setup({ navItems: [] });
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders with no mega menus", () => {
    setup({ megaMenus: [] });
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders with large number of nav items", () => {
    const manyItems: NavItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i}`,
      label: `Item ${i}`,
    }));

    setup({ navItems: manyItems });
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 19")).toBeInTheDocument();
  });

  it("renders with all features disabled", () => {
    setup({
      showSearch: false,
      showNotifications: false,
      showUserMenu: false,
      showThemeToggle: false,
      navItems: [],
    });

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notificări")).not.toBeInTheDocument();
  });

  it("unreadCount prop overrides automatic count", () => {
    setup({ unreadCount: 5 });
    const notifBtn = screen.getByLabelText("Notificări");
    expect(within(notifBtn).getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ for unread counts above 99", () => {
    setup({ unreadCount: 150 });
    const notifBtn = screen.getByLabelText("Notificări");
    expect(within(notifBtn).getByText("99+")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Accessibility
// ═══════════════════════════════════════════════════════════════════════

describe("Header accessibility", () => {
  it("header has role banner", () => {
    setup();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("desktop nav has aria-label", () => {
    // Need to use container query because the nav is hidden on mobile
    // The nav is rendered with lg:flex, so it's in the DOM
    const { container } = setup();
    const nav = container.querySelector('nav[aria-label="Navigare principală"]');
    expect(nav).toBeInTheDocument();
  });

  it("search input has role combobox", () => {
    setup();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("theme toggle has descriptive aria-label", () => {
    setup({ theme: "light" });
    expect(
      screen.getByLabelText("Comută la tema întunecată"),
    ).toBeInTheDocument();
  });

  it("mobile drawer has dialog role", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { user } = setup();

    await user.click(screen.getByLabelText("Deschide meniul"));

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Meniu mobil");
    });
  });

  it("notification items are buttons for keyboard accessibility", async () => {
    const { user } = setup();
    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      const notifItem = screen.getByText("Proiect nou asignat").closest("button");
      expect(notifItem).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Format Timestamp
// ═══════════════════════════════════════════════════════════════════════

describe("Header notification timestamps", () => {
  it("shows 'Acum' for timestamps less than 1 minute ago", async () => {
    const { user } = setup({
      notifications: [
        {
          id: "fresh",
          title: "Recent notification",
          timestamp: new Date(),
          read: false,
        },
      ],
    });

    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText("Acum")).toBeInTheDocument();
    });
  });

  it("shows hours for older notifications", async () => {
    const { user } = setup({
      notifications: [
        {
          id: "old",
          title: "Old notification",
          timestamp: new Date(Date.now() - 3 * 60 * 60_000),
          read: false,
        },
      ],
    });

    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText("3h")).toBeInTheDocument();
    });
  });

  it("shows days for notifications older than 24h", async () => {
    const { user } = setup({
      notifications: [
        {
          id: "days-old",
          title: "Days old notification",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60_000),
          read: false,
        },
      ],
    });

    const notifBtn = screen.getByLabelText("Notificări");
    await user.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText("3z")).toBeInTheDocument();
    });
  });
});
