import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────

/** Basic dropdown setup */
const setup = () => {
  const user = userEvent.setup();
  const onOpenChange = jest.fn();

  const utils = render(
    <Dropdown onOpenChange={onOpenChange}>
      <Dropdown.Trigger>Options</Dropdown.Trigger>
      <Dropdown.Menu aria-label="Test menu">
        <Dropdown.Item>Profile</Dropdown.Item>
        <Dropdown.Item>Settings</Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item disabled>Disabled Item</Dropdown.Item>
        <Dropdown.Item>Logout</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>,
  );

  const trigger = screen.getByRole("button", { name: "Options" });

  return { user, trigger, onOpenChange, ...utils };
};

/** Open the dropdown by clicking the trigger */
const openDropdown = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = screen.getByRole("button", { name: "Options" });
  await user.click(trigger);
  return screen.getByRole("menu");
};

// ─── Rendering ──────────────────────────────────────────────────────
describe("Dropdown rendering", () => {
  it("renders trigger button", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Options" }),
    ).toBeInTheDocument();
  });

  it("does not render menu when closed", () => {
    setup();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders menu when trigger is clicked", async () => {
    const { user } = setup();
    await openDropdown(user);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("renders menu items", async () => {
    const { user } = setup();
    await openDropdown(user);
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("renders disabled items", async () => {
    const { user } = setup();
    await openDropdown(user);
    const disabledItem = screen.getByText("Disabled Item");
    expect(disabledItem).toBeInTheDocument();
    expect(disabledItem.closest("button")).toBeDisabled();
  });

  it("renders separator", async () => {
    const { user } = setup();
    await openDropdown(user);
    const separators = screen.getAllByRole("separator");
    expect(separators.length).toBe(1);
  });

  it("applies aria attributes on trigger", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
  });

  it("updates aria-expanded when opened", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("applies menuitem role to items", async () => {
    const { user } = setup();
    await openDropdown(user);
    const items = screen.getAllByRole("menuitem");
    // Items: Profile, Settings, Disabled Item, Logout = 4 menuitems
    // (separator is not a menuitem)
    expect(items.length).toBe(4);
  });

  it("closes on Escape", async () => {
    const { user } = setup();
    await openDropdown(user);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes on outside click", async () => {
    const { user } = setup();
    await openDropdown(user);

    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});

// ─── Trigger interactions ───────────────────────────────────────────
describe("Dropdown trigger", () => {
  it("opens on click", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("toggles open/close on click", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens on ArrowDown key", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("opens on ArrowUp key", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("opens on Enter key", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("opens on Space key", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await user.keyboard(" ");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("calls onOpenChange when opened", async () => {
    const { user, onOpenChange } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("calls onOpenChange when closed", async () => {
    const { user, onOpenChange } = setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger); // open
    await user.click(trigger); // close
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders chevron by default", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Options" });
    const svg = trigger.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("hides chevron when showChevron is false", () => {
    render(
      <Dropdown>
        <Dropdown.Trigger showChevron={false}>No Chevron</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const trigger = screen.getByRole("button", { name: "No Chevron" });
    expect(trigger.querySelector("svg")).not.toBeInTheDocument();
  });
});

// ─── Keyboard Navigation ────────────────────────────────────────────
describe("Dropdown keyboard navigation", () => {
  const renderNavDropdown = () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu aria-label="Nav menu">
          <Dropdown.Item>First</Dropdown.Item>
          <Dropdown.Item>Second</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item>Third</Dropdown.Item>
          <Dropdown.Item disabled>Fourth Disabled</Dropdown.Item>
          <Dropdown.Item>Fifth</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    return user;
  };

  it("navigates down with ArrowDown", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);
    await user.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("data-highlighted");
  });

  it("navigates up with ArrowUp", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("data-highlighted");
  });

  it("wraps from last to first with ArrowDown", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);

    // Navigate to last item (Fifth is index 4)
    for (let i = 0; i < 5; i++) {
      await user.keyboard("{ArrowDown}");
    }
    // Wrap to first
    await user.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("data-highlighted");
  });

  it("wraps from first to last with ArrowUp", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);
    await user.keyboard("{ArrowUp}");
    const items = screen.getAllByRole("menuitem");
    const lastItem = items[items.length - 1];
    expect(lastItem).toHaveAttribute("data-highlighted");
  });

  it("jumps to first with Home", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);
    // Navigate down a bit
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    // Jump to first
    await user.keyboard("{Home}");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("data-highlighted");
  });

  it("jumps to last with End", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);
    await user.keyboard("{End}");
    const items = screen.getAllByRole("menuitem");
    const lastItem = items[items.length - 1];
    expect(lastItem).toHaveAttribute("data-highlighted");
  });

  it("activates item on Enter", async () => {
    const onClick = jest.fn();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item onClick={onClick}>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const user = userEvent.setup();
    await openDropdown(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates item on Space", async () => {
    const onClick = jest.fn();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item onClick={onClick}>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const user = userEvent.setup();
    await openDropdown(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("skips disabled items during navigation", async () => {
    const user = renderNavDropdown();
    await openDropdown(user);

    // Navigate: ArrowDown → First, Second, Third, then skips Fourth → Fifth
    await user.keyboard("{ArrowDown}"); // First
    await user.keyboard("{ArrowDown}"); // Second
    await user.keyboard("{ArrowDown}"); // Third
    await user.keyboard("{ArrowDown}"); // Should skip Fourth → Fifth

    const items = screen.getAllByRole("menuitem");
    // Fifth is index 4
    expect(items[4]).toHaveAttribute("data-highlighted");
  });
});

// ─── Type-ahead ─────────────────────────────────────────────────────
describe("Dropdown type-ahead", () => {
  it("jumps to item matching typed character", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Apple</Dropdown.Item>
          <Dropdown.Item>Banana</Dropdown.Item>
          <Dropdown.Item>Cherry</Dropdown.Item>
          <Dropdown.Item>Date</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    await user.keyboard("c");

    // "c" should match Cherry
    // With global counter, indices may differ. Let's find by text.
    await waitFor(() => {
      const cherry = screen.getByText("Cherry").closest("button");
      expect(cherry).toHaveAttribute("data-highlighted");
    });
  });

  it("matches multi-character type-ahead", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Apple</Dropdown.Item>
          <Dropdown.Item>Banana</Dropdown.Item>
          <Dropdown.Item>Cherry</Dropdown.Item>
          <Dropdown.Item>Date</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    await user.keyboard("d");
    await user.keyboard("a");

    await waitFor(() => {
      const date = screen.getByText("Date").closest("button");
      expect(date).toHaveAttribute("data-highlighted");
    });
  });
});

// ─── Items with icons and shortcuts ─────────────────────────────────
describe("Dropdown item features", () => {
  it("renders iconLeft", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item iconLeft={<User data-testid="user-icon" />}>
            Profile
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    expect(screen.getByTestId("user-icon")).toBeInTheDocument();
  });

  it("renders iconRight", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item
            iconRight={<Settings data-testid="settings-icon" />}
          >
            Settings
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
  });

  it("renders shortcut text", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item shortcut="⌘K">Search</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders items with inset", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item inset>Indented Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitem");
    expect(item).toHaveClass("pl-8");
  });
});

// ─── Checkbox Items ─────────────────────────────────────────────────
describe("Dropdown checkbox items", () => {
  it("renders unchecked checkbox item", async () => {
    const onCheckedChange = jest.fn();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem
            checked={false}
            onCheckedChange={onCheckedChange}
          >
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitemcheckbox");
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute("aria-checked", "false");
  });

  it("renders checked checkbox item", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem checked={true} onCheckedChange={jest.fn()}>
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitemcheckbox");
    expect(item).toHaveAttribute("aria-checked", "true");
  });

  it("calls onCheckedChange with toggled value on click", async () => {
    const onCheckedChange = jest.fn();
    const { user } = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem
            checked={false}
            onCheckedChange={onCheckedChange}
          >
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitemcheckbox");
    await user.click(item);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles from checked to unchecked", async () => {
    const onCheckedChange = jest.fn();
    const { user } = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem
            checked={true}
            onCheckedChange={onCheckedChange}
          >
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitemcheckbox");
    await user.click(item);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("does not close menu by default when checkbox is toggled", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem checked={false} onCheckedChange={jest.fn()}>
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const item = screen.getByRole("menuitemcheckbox");
    await user.click(item);
    // Menu should still be open
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes menu when closeOnSelect is true on checkbox", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem
            checked={false}
            onCheckedChange={jest.fn()}
            closeOnSelect
          >
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const item = screen.getByRole("menuitemcheckbox");
    await user.click(item);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("disabled checkbox item does not toggle", async () => {
    const onCheckedChange = jest.fn();
    const { user } = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.CheckboxItem
            checked={false}
            onCheckedChange={onCheckedChange}
            disabled
          >
            Dark Mode
          </Dropdown.CheckboxItem>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item = screen.getByRole("menuitemcheckbox");
    await user.click(item);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

// ─── Separators ─────────────────────────────────────────────────────
describe("Dropdown separators", () => {
  it("renders with role=separator", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>First</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item>Second</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("renders multiple separators", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>A</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item>B</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item>C</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const separators = screen.getAllByRole("separator");
    expect(separators.length).toBe(2);
  });

  it("separator has horizontal orientation", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>A</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item>B</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  });
});

// ─── Labels ─────────────────────────────────────────────────────────
describe("Dropdown labels", () => {
  it("renders a label", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Label>Actions</Dropdown.Label>
          <Dropdown.Item>Edit</Dropdown.Item>
          <Dropdown.Item>Delete</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("label has presentation role", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Label>Actions</Dropdown.Label>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const label = screen.getByText("Actions");
    expect(label).toHaveAttribute("role", "presentation");
  });
});

// ─── Submenus ───────────────────────────────────────────────────────
describe("Dropdown submenus", () => {
  const renderSubmenu = () => {
    const user = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Main Item</Dropdown.Item>
          <Dropdown.Submenu>
            <Dropdown.SubmenuTrigger>More</Dropdown.SubmenuTrigger>
            <Dropdown.SubmenuContent>
              <Dropdown.Item>Sub Item 1</Dropdown.Item>
              <Dropdown.Item>Sub Item 2</Dropdown.Item>
            </Dropdown.SubmenuContent>
          </Dropdown.Submenu>
        </Dropdown.Menu>
      </Dropdown>,
    );
    return user;
  };

  it("renders submenu trigger", async () => {
    renderSubmenu();
    const trigger = screen.getByText("More");
    expect(trigger).toBeInTheDocument();
    expect(trigger.closest("button")).toHaveAttribute("aria-haspopup", "menu");
  });

  it("does not show submenu content by default", () => {
    renderSubmenu();
    expect(screen.queryByText("Sub Item 1")).not.toBeInTheDocument();
  });

  it("opens submenu on ArrowRight when highlighted", async () => {
    const user = renderSubmenu();

    // Navigate to "More" (second menuitem)
    // First ArrowDown highlights first item, ArrowDown again goes to More
    // But actually, after opening with defaultOpen, the menu mounts. We need to focus and navigate.
    await user.keyboard("{ArrowDown}"); // Main Item
    await user.keyboard("{ArrowDown}"); // More
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getByText("Sub Item 1")).toBeInTheDocument();
    });
  });

  it("closes submenu on ArrowLeft", async () => {
    const user = renderSubmenu();

    // Open submenu via hover
    const subTrigger = screen.getByText("More").closest("button")!;
    await user.hover(subTrigger);

    await waitFor(() => {
      expect(screen.getByText("Sub Item 1")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowLeft}");

    await waitFor(() => {
      expect(screen.queryByText("Sub Item 1")).not.toBeInTheDocument();
    });
  });

  it("submenu trigger has chevron icon", () => {
    renderSubmenu();
    const trigger = screen.getByText("More").closest("button")!;
    const svgs = trigger.querySelectorAll("svg");
    // Should have at least the ChevronRight icon
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("submenus can be nested", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Submenu>
            <Dropdown.SubmenuTrigger>Level 1</Dropdown.SubmenuTrigger>
            <Dropdown.SubmenuContent>
              <Dropdown.Item>L1 Item</Dropdown.Item>
              <Dropdown.Submenu>
                <Dropdown.SubmenuTrigger>Level 2</Dropdown.SubmenuTrigger>
                <Dropdown.SubmenuContent>
                  <Dropdown.Item>L2 Item</Dropdown.Item>
                </Dropdown.SubmenuContent>
              </Dropdown.Submenu>
            </Dropdown.SubmenuContent>
          </Dropdown.Submenu>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const l1Trigger = screen.getByText("Level 1").closest("button")!;
    await user.hover(l1Trigger);

    await waitFor(() => {
      expect(screen.getByText("L1 Item")).toBeInTheDocument();
    });

    const l2Trigger = screen.getByText("Level 2").closest("button")!;
    await user.hover(l2Trigger);

    await waitFor(() => {
      expect(screen.getByText("L2 Item")).toBeInTheDocument();
    });
  });
});

// ─── Mouse interaction ──────────────────────────────────────────────
describe("Dropdown mouse interaction", () => {
  it("highlights item on hover", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item 1</Dropdown.Item>
          <Dropdown.Item>Item 2</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const item1 = screen.getByText("Item 1").closest("button")!;
    await user.hover(item1);

    expect(item1).toHaveAttribute("data-highlighted");
  });

  it("clicking an item closes the menu by default", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const item = screen.getByText("Action").closest("button")!;
    await user.click(item);

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("clicking an item with closeOnSelect=false keeps menu open", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item closeOnSelect={false}>Stay Open</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const item = screen.getByText("Stay Open").closest("button")!;
    await user.click(item);

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────
describe("Dropdown forwardRef", () => {
  it("forwards ref to Dropdown.Trigger button", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Dropdown>
        <Dropdown.Trigger ref={ref}>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toContain("Options");
  });

  it("forwards ref to Dropdown.Item button", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item ref={ref}>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toContain("Action");
  });

  it("forwards ref to Dropdown.Menu div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu ref={ref}>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("forwards ref to Dropdown.Separator div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>A</Dropdown.Item>
          <Dropdown.Separator ref={ref} />
          <Dropdown.Item>B</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

// ─── Controlled mode ────────────────────────────────────────────────
describe("Dropdown controlled mode", () => {
  it("respects controlled open prop", () => {
    render(
      <Dropdown open={true}>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("respects controlled open=false", () => {
    render(
      <Dropdown open={false}>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when trigger is clicked in controlled mode", async () => {
    const onOpenChange = jest.fn();
    const { user } = userEvent.setup();
    render(
      <Dropdown open={false} onOpenChange={onOpenChange}>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

// ─── Size variants ──────────────────────────────────────────────────
describe("Dropdown sizes", () => {
  it("renders sm size items", () => {
    render(
      <Dropdown defaultOpen size="sm">
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Small Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const item = screen.getByRole("menuitem");
    expect(item).toHaveClass("h-7");
    expect(item).toHaveClass("text-xs");
  });

  it("renders md size items by default", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Default Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const item = screen.getByRole("menuitem");
    expect(item).toHaveClass("h-9");
    expect(item).toHaveClass("text-sm");
  });

  it("renders lg size items", () => {
    render(
      <Dropdown defaultOpen size="lg">
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Large Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const item = screen.getByRole("menuitem");
    expect(item).toHaveClass("h-11");
    expect(item).toHaveClass("text-base");
  });
});

// ─── Alignment ──────────────────────────────────────────────────────
describe("Dropdown alignment", () => {
  it("renders end alignment by default", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("right-0");
  });

  it("renders start alignment", () => {
    render(
      <Dropdown defaultOpen align="start">
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("left-0");
  });

  it("renders center alignment", () => {
    render(
      <Dropdown defaultOpen align="center">
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("left-1/2");
    expect(menu).toHaveClass("-translate-x-1/2");
  });
});

// ─── Custom classes ─────────────────────────────────────────────────
describe("Dropdown custom classes", () => {
  it("applies custom className to trigger", () => {
    render(
      <Dropdown>
        <Dropdown.Trigger className="custom-trigger">Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toHaveClass("custom-trigger");
  });

  it("applies custom className to menu", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu className="custom-menu">
          <Dropdown.Item>Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("custom-menu");
  });

  it("applies custom className to item", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item className="custom-item">Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    const item = screen.getByRole("menuitem");
    expect(item).toHaveClass("custom-item");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Dropdown edge cases", () => {
  it("renders empty menu", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu aria-label="Empty menu" />
      </Dropdown>,
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("handles many items", () => {
    const items = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          {items.map((item) => (
            <Dropdown.Item key={item}>{item}</Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>,
    );
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBe(50);
  });

  it("throws error when sub-components used outside Dropdown", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(
        <Dropdown.Menu>
          <Dropdown.Item>Orphan</Dropdown.Item>
        </Dropdown.Menu>,
      );
    }).toThrow();

    spy.mockRestore();
  });

  it("handles undefined children gracefully", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Valid</Dropdown.Item>
          {undefined}
          <Dropdown.Item>Also Valid</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Also Valid")).toBeInTheDocument();
  });

  it("accepts custom data attributes on items", () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item data-testid="custom-data-item">Item</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );
    expect(screen.getByTestId("custom-data-item")).toBeInTheDocument();
  });

  it("closes on Escape even when focused on a submenu", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Submenu>
            <Dropdown.SubmenuTrigger>More</Dropdown.SubmenuTrigger>
            <Dropdown.SubmenuContent>
              <Dropdown.Item>Sub Item</Dropdown.Item>
            </Dropdown.SubmenuContent>
          </Dropdown.Submenu>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const subTrigger = screen.getByText("More").closest("button")!;
    await user.hover(subTrigger);

    await waitFor(() => {
      expect(screen.getByText("Sub Item")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});

// ─── Focus Management ───────────────────────────────────────────────
describe("Dropdown focus management", () => {
  it("returns focus to trigger after item click", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    const item = screen.getByText("Action").closest("button")!;
    await user.click(item);

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toHaveFocus();
  });

  it("returns focus to trigger on Escape", async () => {
    const { user } = userEvent.setup();
    render(
      <Dropdown>
        <Dropdown.Trigger>Options</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item>Action</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    );

    await openDropdown(user);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toHaveFocus();
  });
});
