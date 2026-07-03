import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Avatar,
  AvatarGroup,
  avatarVariants,
  indicatorVariants,
  getInitials,
  type AvatarProps,
  type AvatarGroupProps,
} from "@/components/ui/Avatar";

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: AvatarProps = {}) => {
  const user = userEvent.setup();
  const utils = render(<Avatar {...props} />);
  return { user, ...utils };
};

const setupGroup = (props: AvatarGroupProps = {}) => {
  const user = userEvent.setup();
  const utils = render(<AvatarGroup {...props} />);
  return { user, ...utils };
};

// Mock image load/error for Radix Avatar
const originalImage = global.Image;
beforeEach(() => {
  (global as unknown as { Image: typeof Image }).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src: string = "";
    constructor() {
      setTimeout(() => {
        if (this.onerror) this.onerror();
      }, 0);
    }
  } as unknown as typeof Image;
});

afterEach(() => {
  (global as unknown as { Image: typeof Image }).Image = originalImage;
});

// ─── getInitials utility ────────────────────────────────────────────
describe("getInitials", () => {
  it("returns empty string for empty name", () => {
    expect(getInitials("")).toBe("");
  });

  it("returns empty string for undefined name", () => {
    expect(getInitials(undefined)).toBe("");
  });

  it("returns initials for single word", () => {
    expect(getInitials("John")).toBe("J");
  });

  it("returns initials for two words", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns initials for three words (max 2 by default)", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("respects maxInitials parameter", () => {
    expect(getInitials("John Michael Doe", 3)).toBe("JMD");
  });

  it("returns initials for hyphenated name", () => {
    expect(getInitials("Jean-Luc Picard")).toBe("JP");
  });

  it("handles accented characters", () => {
    expect(getInitials("José Álvarez")).toBe("JÁ");
  });

  it("handles Romanian characters", () => {
    expect(getInitials("Ștefan Popescu")).toBe("ȘP");
  });

  it("trims whitespace", () => {
    expect(getInitials("  Ana   Maria  ")).toBe("AM");
  });

  it("skips non-letter tokens", () => {
    expect(getInitials("User 123 !!!")).toBe("U");
  });

  it("returns empty string for names with only symbols", () => {
    expect(getInitials("!!! @@@ ###")).toBe("");
  });
});

// ─── Rendering ──────────────────────────────────────────────────────
describe("Avatar rendering", () => {
  it("renders with default props", () => {
    setup();
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toBeInTheDocument();
  });

  it("renders with name and shows fallback initials", () => {
    setup({ name: "John Doe" });
    const fallback = document.querySelector('[data-slot="avatar"]');
    expect(fallback).toBeInTheDocument();
    expect(fallback?.textContent).toContain("JD");
  });

  it("renders custom fallback when provided", () => {
    setup({ fallback: <span data-testid="custom-fb">C</span> });
    expect(screen.getByTestId("custom-fb")).toBeInTheDocument();
  });

  it("shows '?' when no name and no custom fallback", () => {
    setup();
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("?");
  });

  it("renders image when src is provided", () => {
    setup({ src: "https://example.com/avatar.jpg", alt: "User", name: "JD" });
    const img = document.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("uses name as alt text when alt not provided", () => {
    setup({ src: "https://example.com/avatar.jpg", name: "John Doe" });
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("alt", "John Doe");
  });

  it("uses alt text when provided", () => {
    setup({
      src: "https://example.com/avatar.jpg",
      alt: "Custom Alt",
      name: "John",
    });
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("alt", "Custom Alt");
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Avatar ref={ref} name="Ref User" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current?.querySelector('[data-slot="avatar"]')).toBe(ref.current);
  });

  it("applies additional className", () => {
    setup({ name: "Class", className: "my-custom-avatar" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("my-custom-avatar");
  });

  it("passes additional HTML attributes", () => {
    setup({ name: "Attr", "data-testid": "avatar-test", id: "av-1" });
    const avatar = screen.getByTestId("avatar-test");
    expect(avatar).toHaveAttribute("id", "av-1");
  });

  it("renders with empty name but src present", () => {
    setup({ src: "https://example.com/pic.jpg" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toBeInTheDocument();
    expect(avatar?.textContent).toContain("?");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("Avatar sizes", () => {
  it("renders xs size", () => {
    setup({ name: "XS", size: "xs" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-6");
    expect(avatar).toHaveClass("w-6");
  });

  it("renders sm size", () => {
    setup({ name: "SM", size: "sm" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-8");
    expect(avatar).toHaveClass("w-8");
  });

  it("renders md size (default)", () => {
    setup({ name: "MD" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-10");
    expect(avatar).toHaveClass("w-10");
  });

  it("renders lg size", () => {
    setup({ name: "LG", size: "lg" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-12");
    expect(avatar).toHaveClass("w-12");
  });

  it("renders xl size", () => {
    setup({ name: "XL", size: "xl" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-14");
    expect(avatar).toHaveClass("w-14");
  });
});

// ─── Bordered ───────────────────────────────────────────────────────
describe("Avatar bordered", () => {
  it("has ring by default (bordered=true)", () => {
    setup({ name: "Border" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.className).toContain("ring-");
  });

  it("has ring when bordered is true", () => {
    setup({ name: "Border", bordered: true });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.className).toContain("ring-");
  });

  it("has no ring when bordered is false", () => {
    setup({ name: "NoBorder", bordered: false });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toBeInTheDocument();
    // Bordered false: no ring classes should be present
    expect(avatar?.className).not.toContain("ring-");
  });
});

// ─── Status Indicator ───────────────────────────────────────────────
describe("Avatar status indicator", () => {
  it("renders online status indicator", () => {
    setup({ name: "Online", status: "online" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-success-500");
    expect(indicator).toHaveAttribute("aria-label", "online");
  });

  it("renders offline status indicator", () => {
    setup({ name: "Offline", status: "offline" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("bg-neutral-400");
  });

  it("renders busy status indicator", () => {
    setup({ name: "Busy", status: "busy" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("bg-danger-500");
  });

  it("renders away status indicator", () => {
    setup({ name: "Away", status: "away" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("bg-warning-500");
  });

  it("does not render indicator when status is none (default)", () => {
    setup({ name: "None" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).not.toBeInTheDocument();
  });

  it("status indicator has role='status'", () => {
    setup({ name: "Role", status: "online" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveAttribute("role", "status");
  });

  it("status indicator size matches avatar size (sm)", () => {
    setup({ name: "Sm Status", status: "online", size: "sm" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("h-2");
    expect(indicator).toHaveClass("w-2");
  });

  it("status indicator size matches avatar size (xl)", () => {
    setup({ name: "Xl Status", status: "busy", size: "xl" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("h-3.5");
    expect(indicator).toHaveClass("w-3.5");
  });

  it("renders custom status indicator", () => {
    setup({
      name: "Custom Status",
      statusIndicator: <span data-testid="custom-status">⚡</span>,
    });
    expect(screen.getByTestId("custom-status")).toBeInTheDocument();
    const defaultIndicator = document.querySelector('[data-slot="avatar-status"]');
    expect(defaultIndicator).not.toBeInTheDocument();
  });

  it("custom status indicator overrides default status", () => {
    setup({
      name: "Override",
      status: "online",
      statusIndicator: <span data-testid="override-status">★</span>,
    });
    expect(screen.getByTestId("override-status")).toBeInTheDocument();
    const defaultIndicator = document.querySelector('[data-slot="avatar-status"]');
    expect(defaultIndicator).not.toBeInTheDocument();
  });
});

// ─── onLoadingError ─────────────────────────────────────────────────
describe("Avatar onLoadingError", () => {
  it("calls onLoadingError when image fails", async () => {
    const onError = jest.fn();
    setup({
      src: "invalid://image.jpg",
      name: "Error",
      onLoadingError: onError,
    });

    // Radix Avatar triggers onLoadingStatusChange when the image errors
    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  });

  it("does not throw when onLoadingError is not provided", () => {
    expect(() => {
      setup({ src: "invalid://image.jpg", name: "NoError" });
    }).not.toThrow();
  });
});

// ─── Compound scenarios ─────────────────────────────────────────────
describe("Avatar compound scenarios", () => {
  it("renders lg avatar with image, bordered, and busy status", () => {
    setup({
      src: "https://example.com/avatar.jpg",
      name: "Busy User",
      size: "lg",
      bordered: true,
      status: "busy",
    });

    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-12");
    expect(avatar).toHaveClass("w-12");

    const img = document.querySelector("img");
    expect(img).toBeInTheDocument();

    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("bg-danger-500");
    expect(indicator).toHaveClass("h-3");
    expect(indicator).toHaveClass("w-3");
  });

  it("renders xs avatar with initials only and away status", () => {
    setup({
      name: "Ana Maria",
      size: "xs",
      status: "away",
      bordered: false,
    });

    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("h-6");
    expect(avatar).toHaveClass("w-6");

    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveClass("bg-warning-500");
    expect(indicator).toHaveClass("h-1.5");
    expect(indicator).toHaveClass("w-1.5");
  });

  it("renders with custom fallback and no status", () => {
    setup({
      fallback: <span data-testid="logo">🏢</span>,
      size: "xl",
    });

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).not.toBeInTheDocument();
  });
});

// ─── AvatarGroup ────────────────────────────────────────────────────
describe("AvatarGroup rendering", () => {
  it("renders a group of avatars", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="User One" />,
        <Avatar key="2" name="User Two" />,
        <Avatar key="3" name="User Three" />,
      ],
    });

    const group = document.querySelector('[data-slot="avatar-group"]');
    expect(group).toBeInTheDocument();
    const avatars = group!.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(3);
  });

  it("renders empty group without errors", () => {
    setupGroup({ children: [] });
    const group = document.querySelector('[data-slot="avatar-group"]');
    expect(group).toBeInTheDocument();
  });

  it("applies group role and aria-label", () => {
    setupGroup({
      children: [<Avatar key="1" name="User" />],
    });
    const group = document.querySelector('[data-slot="avatar-group"]');
    expect(group).toHaveAttribute("role", "group");
    expect(group).toHaveAttribute("aria-label", "Avatar group");
  });

  it("forwards ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <AvatarGroup ref={ref}>
        <Avatar name="User" />
      </AvatarGroup>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.querySelector('[data-slot="avatar"]')).toBeTruthy();
  });

  it("applies additional className to group", () => {
    setupGroup({
      children: [<Avatar key="1" name="User" />],
      className: "group-custom",
    });
    const group = document.querySelector('[data-slot="avatar-group"]');
    expect(group).toHaveClass("group-custom");
  });
});

// ─── AvatarGroup max and overflow ───────────────────────────────────
describe("AvatarGroup max and overflow", () => {
  it("shows all avatars when count <= max", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="Uno" />,
        <Avatar key="2" name="Dos" />,
      ],
      max: 3,
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(2);

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).not.toBeInTheDocument();
  });

  it("shows overflow indicator when count > max", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="Uno" />,
        <Avatar key="2" name="Dos" />,
        <Avatar key="3" name="Tres" />,
        <Avatar key="4" name="Cuatro" />,
        <Avatar key="5" name="Cinco" />,
      ],
      max: 3,
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(3);

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toBeInTheDocument();
    expect(overflow?.textContent).toBe("+2");
  });

  it("overflow indicator has aria-label", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
      ],
      max: 2,
    });

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toHaveAttribute("aria-label", "1 more");
  });

  it("shows all avatars when max is not set", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
        <Avatar key="4" name="D" />,
        <Avatar key="5" name="E" />,
        <Avatar key="6" name="F" />,
      ],
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(6);

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).not.toBeInTheDocument();
  });

  it("handles max=0 (shows only overflow)", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
      ],
      max: 0,
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(0);

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toBeInTheDocument();
    expect(overflow?.textContent).toBe("+2");
  });

  it("handles single child with max=1 (no overflow)", () => {
    setupGroup({
      children: [<Avatar key="1" name="Only" />],
      max: 1,
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(1);

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).not.toBeInTheDocument();
  });
});

// ─── AvatarGroup size prop ──────────────────────────────────────────
describe("AvatarGroup size prop", () => {
  it("overrides child avatar sizes", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" size="xs" />,
        <Avatar key="2" name="B" size="sm" />,
      ],
      size: "lg",
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    avatars.forEach((av) => {
      expect(av).toHaveClass("h-12");
      expect(av).toHaveClass("w-12");
    });
  });

  it("overflow indicator matches group size", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
        <Avatar key="4" name="D" />,
      ],
      max: 2,
      size: "xl",
    });

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toHaveClass("h-14");
    expect(overflow).toHaveClass("w-14");
  });
});

// ─── AvatarGroup overlap ────────────────────────────────────────────
describe("AvatarGroup overlap", () => {
  it("applies negative margin to non-first avatars", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="First" />,
        <Avatar key="2" name="Second" />,
        <Avatar key="3" name="Third" />,
      ],
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    // First should NOT have negative margin
    expect(avatars[0].className).not.toContain("-ml-");
    // Second and third SHOULD
    expect(avatars[1].className).toContain("-ml-");
    expect(avatars[2].className).toContain("-ml-");
  });

  it("uses custom overlap when provided", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
      ],
      overlap: "-ml-4",
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars[1].className).toContain("-ml-4");
  });

  it("xs size uses tighter overlap", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
      ],
      size: "xs",
    });

    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars[1].className).toContain("-ml-1");
  });
});

// ─── AvatarGroup overflow indicator styling ─────────────────────────
describe("AvatarGroup overflow indicator styling", () => {
  it("has correct background for visibility", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
      ],
      max: 2,
    });

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toHaveClass("bg-neutral-300");
    expect(overflow).toHaveClass("text-neutral-700");
    expect(overflow).toHaveClass("rounded-full");
  });

  it("has font-medium", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
      ],
      max: 2,
    });

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow).toHaveClass("font-medium");
  });

  it("overflow has ring like normal avatars", () => {
    setupGroup({
      children: [
        <Avatar key="1" name="A" />,
        <Avatar key="2" name="B" />,
        <Avatar key="3" name="C" />,
      ],
      max: 2,
    });

    const overflow = document.querySelector('[data-slot="avatar-group-overflow"]');
    expect(overflow?.className).toContain("ring-");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Avatar edge cases", () => {
  it("handles very long name", () => {
    setup({ name: "Adrianus Johannes Van Der Merwe Smith" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("AJ");
  });

  it("handles single character name", () => {
    setup({ name: "A" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("A");
  });

  it("handles name with only whitespace", () => {
    setup({ name: "   " });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("?");
  });

  it("handles undefined name gracefully", () => {
    setup({ name: undefined });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("?");
  });

  it("renders with special Unicode characters in name", () => {
    setup({ name: "李 小龙" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("李小");
  });

  it("renders with emoji as custom fallback", () => {
    setup({ fallback: "😎" });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toContain("😎");
  });
});

// ─── avatarVariants export ──────────────────────────────────────────
describe("avatarVariants", () => {
  it("returns default classes", () => {
    const result = avatarVariants({});
    expect(result).toContain("rounded-full");
    expect(result).toContain("inline-flex");
    expect(result).toContain("h-10");
    expect(result).toContain("w-10");
    expect(result).toContain("ring-");
    expect(result).toContain("ring-surface");
  });

  it("returns classes for xs size", () => {
    const result = avatarVariants({ size: "xs" });
    expect(result).toContain("h-6");
    expect(result).toContain("w-6");
  });

  it("returns classes for xl size", () => {
    const result = avatarVariants({ size: "xl" });
    expect(result).toContain("h-14");
    expect(result).toContain("w-14");
  });

  it("returns bordered classes", () => {
    const result = avatarVariants({ size: "md", bordered: true });
    expect(result).toContain("ring-[3px]");
  });

  it("returns non-bordered classes", () => {
    const result = avatarVariants({ size: "sm", bordered: false });
    expect(result).toContain("h-8");
  });
});

// ─── indicatorVariants export ───────────────────────────────────────
describe("indicatorVariants", () => {
  it("returns classes for online md indicator", () => {
    const result = indicatorVariants({ status: "online", size: "md" });
    expect(result).toContain("bg-success-500");
    expect(result).toContain("h-2.5");
    expect(result).toContain("w-2.5");
    expect(result).toContain("rounded-full");
  });

  it("returns classes for offline sm indicator", () => {
    const result = indicatorVariants({ status: "offline", size: "sm" });
    expect(result).toContain("bg-neutral-400");
    expect(result).toContain("h-2");
    expect(result).toContain("w-2");
  });

  it("returns classes for busy xl indicator", () => {
    const result = indicatorVariants({ status: "busy", size: "xl" });
    expect(result).toContain("bg-danger-500");
    expect(result).toContain("h-3.5");
    expect(result).toContain("w-3.5");
  });

  it("returns classes for away xs indicator", () => {
    const result = indicatorVariants({ status: "away", size: "xs" });
    expect(result).toContain("bg-warning-500");
    expect(result).toContain("h-1.5");
    expect(result).toContain("w-1.5");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("Avatar accessibility", () => {
  it("fallback text is aria-hidden", () => {
    setup({ name: "Hidden" });
    const fallbackSpan = document.querySelector('[aria-hidden="true"]');
    expect(fallbackSpan).toBeInTheDocument();
  });

  it("status indicator has aria-label matching status", () => {
    setup({ name: "Status Label", status: "away" });
    const indicator = document.querySelector('[data-slot="avatar-status"]');
    expect(indicator).toHaveAttribute("aria-label", "away");
  });

  it("avatar image has alt attribute", () => {
    setup({
      src: "https://example.com/av.jpg",
      name: "Alt User",
      alt: "Explicit Alt",
    });
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("alt", "Explicit Alt");
  });

  it("avatar group has role='group'", () => {
    setupGroup({
      children: [<Avatar key="1" name="A" />],
    });
    const group = document.querySelector('[data-slot="avatar-group"]');
    expect(group).toHaveAttribute("role", "group");
  });
});

// ─── Namespaced export ──────────────────────────────────────────────
describe("Avatar exports", () => {
  it("Avatar is exported as named and default", () => {
    expect(Avatar).toBeDefined();
    expect(Avatar.displayName).toBe("Avatar");
  });

  it("AvatarGroup is exported as named", () => {
    expect(AvatarGroup).toBeDefined();
    expect(AvatarGroup.displayName).toBe("AvatarGroup");
  });

  it("avatarVariants is exported", () => {
    expect(avatarVariants).toBeDefined();
    expect(typeof avatarVariants).toBe("function");
  });

  it("indicatorVariants is exported", () => {
    expect(indicatorVariants).toBeDefined();
    expect(typeof indicatorVariants).toBe("function");
  });

  it("getInitials is exported", () => {
    expect(getInitials).toBeDefined();
    expect(typeof getInitials).toBe("function");
  });
});
