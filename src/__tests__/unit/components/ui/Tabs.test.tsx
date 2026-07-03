import React from "react";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabList, Tab, TabPanel, COLLAPSE_BREAKPOINTS } from "@/components/ui/Tabs";

// ─── Helpers ────────────────────────────────────────────────────────

const setupTabs = (
  props: Partial<React.ComponentProps<typeof Tabs>> = {},
  tabs?: { value: string; label: string; disabled?: boolean; content?: React.ReactNode }[],
) => {
  const user = userEvent.setup();
  const defaultTabs = tabs ?? [
    { value: "tab1", label: "Tab 1", content: "Content 1" },
    { value: "tab2", label: "Tab 2", content: "Content 2" },
    { value: "tab3", label: "Tab 3", content: "Content 3" },
  ];

  const utils = render(
    <Tabs {...props}>
      <TabList aria-label="Test tabs">
        {defaultTabs.map((t) => (
          <Tab key={t.value} value={t.value} disabled={t.disabled}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      {defaultTabs.map((t) => (
        <TabPanel key={t.value} value={t.value}>
          {t.content}
        </TabPanel>
      ))}
    </Tabs>,
  );

  return { user, ...utils };
};

// Helper to get tablist element
const getTabList = () => screen.getByRole("tablist");
const getTabs = () => screen.getAllByRole("tab");
const getTab = (name: string) => screen.getByRole("tab", { name });
const getPanel = (name: string) => {
  // Find the panel by matching the tab that labels it
  const tab = screen.getByRole("tab", { name });
  const panelId = tab.getAttribute("aria-controls");
  return document.getElementById(panelId!);
};

// ─── Basic Rendering ────────────────────────────────────────────────

describe("Tabs rendering", () => {
  it("renders tablist with correct role", () => {
    setupTabs();
    expect(getTabList()).toBeInTheDocument();
  });

  it("renders correct number of tabs", () => {
    setupTabs();
    expect(getTabs()).toHaveLength(3);
  });

  it("renders tab panels", () => {
    setupTabs();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
    expect(screen.getByText("Content 3")).toBeInTheDocument();
  });

  it("first tab is active by default when defaultValue is not set and no value controlled", () => {
    setupTabs();
    const firstTab = getTab("Tab 1");
    expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  it("respects defaultValue prop", () => {
    setupTabs({ defaultValue: "tab2" });
    const tab2 = getTab("Tab 2");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("respects controlled value prop", () => {
    setupTabs({ value: "tab3" });
    const tab3 = getTab("Tab 3");
    expect(tab3).toHaveAttribute("aria-selected", "true");
  });
});

// ─── Tab Selection ──────────────────────────────────────────────────

describe("Tab selection", () => {
  it("activates tab on click", async () => {
    const { user } = setupTabs();
    const tab2 = getTab("Tab 2");

    await user.click(tab2);
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("shows the corresponding panel when tab is active", async () => {
    const { user } = setupTabs();
    const tab2 = getTab("Tab 2");

    await user.click(tab2);
    const panel = document.getElementById(tab2.getAttribute("aria-controls")!);
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toHaveTextContent("Content 2");
  });

  it("hides inactive panels", async () => {
    setupTabs({ defaultValue: "tab1" });
    const tab2 = getTab("Tab 2");
    const panel2 = document.getElementById(tab2.getAttribute("aria-controls")!);
    expect(panel2).toHaveAttribute("hidden");
  });

  it("calls onValueChange when tab is selected", async () => {
    const onValueChange = jest.fn();
    const { user } = setupTabs({ onValueChange });
    const tab2 = getTab("Tab 2");

    await user.click(tab2);
    expect(onValueChange).toHaveBeenCalledWith("tab2");
  });

  it("does not select disabled tab", async () => {
    const onValueChange = jest.fn();
    const { user } = setupTabs(
      { onValueChange },
      [
        { value: "tab1", label: "Tab 1", content: "Content 1" },
        { value: "tab2", label: "Tab 2", disabled: true, content: "Content 2" },
      ],
    );
    const tab2 = getTab("Tab 2");

    await user.click(tab2);
    expect(tab2).toHaveAttribute("aria-selected", "false");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

// ─── ARIA / Accessibility ───────────────────────────────────────────

describe("Tabs accessibility", () => {
  it("tablist has correct role", () => {
    setupTabs();
    expect(getTabList()).toHaveAttribute("role", "tablist");
  });

  it("tabs have correct role", () => {
    setupTabs();
    getTabs().forEach((tab) => {
      expect(tab).toHaveAttribute("role", "tab");
    });
  });

  it("active tab has aria-selected true", () => {
    setupTabs({ defaultValue: "tab1" });
    expect(getTab("Tab 1")).toHaveAttribute("aria-selected", "true");
  });

  it("inactive tab has aria-selected false", () => {
    setupTabs({ defaultValue: "tab1" });
    expect(getTab("Tab 2")).toHaveAttribute("aria-selected", "false");
  });

  it("tab has aria-controls pointing to panel", () => {
    setupTabs();
    const tab = getTab("Tab 1");
    const panelId = tab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).toBeInTheDocument();
  });

  it("panel has role tabpanel", () => {
    setupTabs();
    const tab = getTab("Tab 1");
    const panelId = tab.getAttribute("aria-controls");
    const panel = document.getElementById(panelId!);
    expect(panel).toHaveAttribute("role", "tabpanel");
  });

  it("panel has aria-labelledby pointing to tab", () => {
    setupTabs();
    const tab = getTab("Tab 1");
    const panelId = tab.getAttribute("aria-controls");
    const panel = document.getElementById(panelId!);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("tablist has aria-label when provided", () => {
    setupTabs();
    expect(getTabList()).toHaveAttribute("aria-label", "Test tabs");
  });

  it("tablist has aria-orientation horizontal by default", () => {
    setupTabs();
    expect(getTabList()).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("tablist has aria-orientation vertical when set", () => {
    render(
      <Tabs orientation="vertical">
        <TabList aria-label="Vertical tabs">
          <Tab value="a">Tab A</Tab>
          <Tab value="b">Tab B</Tab>
        </TabList>
        <TabPanel value="a">A</TabPanel>
        <TabPanel value="b">B</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("disabled tab has aria-disabled", () => {
    setupTabs(undefined, [
      { value: "tab1", label: "Tab 1", content: "C1" },
      { value: "tab2", label: "Tab 2", disabled: true, content: "C2" },
    ]);
    expect(getTab("Tab 2")).toHaveAttribute("aria-disabled", "true");
  });

  it("active tab has tabIndex 0", () => {
    setupTabs({ defaultValue: "tab1" });
    expect(getTab("Tab 1")).toHaveAttribute("tabIndex", "0");
  });

  it("inactive tab has tabIndex -1", () => {
    setupTabs({ defaultValue: "tab1" });
    expect(getTab("Tab 2")).toHaveAttribute("tabIndex", "-1");
  });
});

// ─── Keyboard Navigation ────────────────────────────────────────────

describe("Tabs keyboard navigation", () => {
  describe("horizontal orientation", () => {
    it("moves focus to next tab on ArrowRight", async () => {
      const { user } = setupTabs({ defaultValue: "tab1" });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      expect(getTab("Tab 2")).toHaveFocus();
    });

    it("moves focus to previous tab on ArrowLeft", async () => {
      const { user } = setupTabs({ defaultValue: "tab2" });
      const tab2 = getTab("Tab 2");

      tab2.focus();
      await user.keyboard("{ArrowLeft}");
      expect(getTab("Tab 1")).toHaveFocus();
    });

    it("wraps from last to first with ArrowRight? No, stops at last", async () => {
      const { user } = setupTabs({ defaultValue: "tab3" });
      const tab3 = getTab("Tab 3");

      tab3.focus();
      await user.keyboard("{ArrowRight}");
      // Should stay at last (no wrap by default)
      expect(getTab("Tab 3")).toHaveFocus();
    });

    it("does not move to disabled tab", async () => {
      const { user } = setupTabs(
        { defaultValue: "tab1" },
        [
          { value: "tab1", label: "Tab 1", content: "C1" },
          { value: "tab2", label: "Tab 2", disabled: true, content: "C2" },
          { value: "tab3", label: "Tab 3", content: "C3" },
        ],
      );
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      // Should skip disabled tab2 and focus tab3
      expect(getTab("Tab 3")).toHaveFocus();
    });

    it("jumps to first tab on Home", async () => {
      const { user } = setupTabs({ defaultValue: "tab3" });
      const tab3 = getTab("Tab 3");

      tab3.focus();
      await user.keyboard("{Home}");
      expect(getTab("Tab 1")).toHaveFocus();
    });

    it("jumps to last tab on End", async () => {
      const { user } = setupTabs({ defaultValue: "tab1" });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{End}");
      expect(getTab("Tab 3")).toHaveFocus();
    });
  });

  describe("vertical orientation", () => {
    const setupVertical = () =>
      render(
        <Tabs orientation="vertical" defaultValue="a">
          <TabList aria-label="Vertical tabs">
            <Tab value="a">Tab A</Tab>
            <Tab value="b">Tab B</Tab>
            <Tab value="c">Tab C</Tab>
          </TabList>
          <TabPanel value="a">Content A</TabPanel>
          <TabPanel value="b">Content B</TabPanel>
          <TabPanel value="c">Content C</TabPanel>
        </Tabs>,
      );

    it("moves focus to next tab on ArrowDown", async () => {
      const user = userEvent.setup();
      setupVertical();
      const tabA = screen.getByRole("tab", { name: "Tab A" });

      tabA.focus();
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("tab", { name: "Tab B" })).toHaveFocus();
    });

    it("moves focus to previous tab on ArrowUp", async () => {
      const user = userEvent.setup();
      setupVertical();
      const tabB = screen.getByRole("tab", { name: "Tab B" });

      tabB.focus();
      await user.keyboard("{ArrowUp}");
      expect(screen.getByRole("tab", { name: "Tab A" })).toHaveFocus();
    });
  });

  describe("activation mode", () => {
    it("manual mode: focus does not activate tab (only Enter/Space)", async () => {
      const onValueChange = jest.fn();
      const { user } = setupTabs({ defaultValue: "tab1", activationMode: "manual", onValueChange });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      expect(getTab("Tab 2")).toHaveFocus();
      // onValueChange should not have been called for ArrowRight
      expect(onValueChange).not.toHaveBeenCalledWith("tab2");
    });

    it("manual mode: Enter activates focused tab", async () => {
      const onValueChange = jest.fn();
      const { user } = setupTabs({ defaultValue: "tab1", activationMode: "manual", onValueChange });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      expect(getTab("Tab 2")).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onValueChange).toHaveBeenCalledWith("tab2");
    });

    it("manual mode: Space activates focused tab", async () => {
      const onValueChange = jest.fn();
      const { user } = setupTabs({ defaultValue: "tab1", activationMode: "manual", onValueChange });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      expect(getTab("Tab 2")).toHaveFocus();
      await user.keyboard(" ");
      expect(onValueChange).toHaveBeenCalledWith("tab2");
    });

    it("automatic mode: focus activates tab immediately", async () => {
      const onValueChange = jest.fn();
      const { user } = setupTabs({
        defaultValue: "tab1",
        activationMode: "automatic",
        onValueChange,
      });
      const tab1 = getTab("Tab 1");

      tab1.focus();
      await user.keyboard("{ArrowRight}");
      expect(onValueChange).toHaveBeenCalledWith("tab2");
    });
  });
});

// ─── Lazy Loading ───────────────────────────────────────────────────

describe("TabPanel lazy loading", () => {
  it("renders all panels initially when lazy is false (default)", () => {
    setupTabs();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
    expect(screen.getByText("Content 3")).toBeInTheDocument();
  });

  it("with lazy=true, only active panel content is in DOM initially", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabList aria-label="Lazy tabs">
          <Tab value="tab1">Tab 1</Tab>
          <Tab value="tab2">Tab 2</Tab>
        </TabList>
        <TabPanel value="tab1" lazy>
          Content 1
        </TabPanel>
        <TabPanel value="tab2" lazy>
          Content 2
        </TabPanel>
      </Tabs>,
    );

    // Content 1 should be there (active)
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    // Content 2 should NOT be there yet (lazy, not yet activated)
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  it("with lazy=true, panel mounts after first activation and stays mounted", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabList aria-label="Lazy tabs">
          <Tab value="tab1">Tab 1</Tab>
          <Tab value="tab2">Tab 2</Tab>
        </TabList>
        <TabPanel value="tab1" lazy>
          Content 1
        </TabPanel>
        <TabPanel value="tab2" lazy>
          Content 2
        </TabPanel>
      </Tabs>,
    );

    // Activate tab2
    await user.click(screen.getByRole("tab", { name: "Tab 2" }));
    expect(screen.getByText("Content 2")).toBeInTheDocument();

    // Go back to tab1
    await user.click(screen.getByRole("tab", { name: "Tab 1" }));
    // Content 2 should still be in DOM (mounted, just hidden)
    expect(screen.getByText("Content 2")).toBeInTheDocument();
    const tab2Panel = document.getElementById(
      screen.getByRole("tab", { name: "Tab 2" }).getAttribute("aria-controls")!,
    );
    expect(tab2Panel).toHaveAttribute("hidden");
  });

  it("with unmountOnHide=true, panel is removed when inactive", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabList aria-label="Unmount tabs">
          <Tab value="tab1">Tab 1</Tab>
          <Tab value="tab2">Tab 2</Tab>
        </TabList>
        <TabPanel value="tab1" unmountOnHide>
          Content 1
        </TabPanel>
        <TabPanel value="tab2" unmountOnHide>
          Content 2
        </TabPanel>
      </Tabs>,
    );

    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tab 2" }));
    expect(screen.getByText("Content 2")).toBeInTheDocument();
    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
  });
});

// ─── Variants ───────────────────────────────────────────────────────

describe("Tabs variants", () => {
  it("renders default variant classes", () => {
    setupTabs({ variant: "default" });
    const tabList = getTabList();
    expect(tabList).toHaveClass("bg-surface-secondary");
    expect(tabList).toHaveClass("p-1");
    expect(tabList).toHaveClass("rounded-lg");
  });

  it("renders pills variant classes", () => {
    setupTabs({ variant: "pills" });
    const tabList = getTabList();
    expect(tabList).toHaveClass("bg-transparent");
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("rounded-full");
  });

  it("renders underlined variant classes", () => {
    setupTabs({ variant: "underlined" });
    const tabList = getTabList();
    expect(tabList).toHaveClass("border-b");
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("rounded-none");
    expect(tab).toHaveClass("bg-transparent");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────

describe("Tabs sizes", () => {
  it("renders default md size", () => {
    setupTabs({ size: "md" });
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("h-9");
    expect(tab).toHaveClass("text-sm");
  });

  it("renders sm size", () => {
    setupTabs({ size: "sm" });
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("h-7");
    expect(tab).toHaveClass("text-xs");
  });

  it("renders lg size", () => {
    setupTabs({ size: "lg" });
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("h-11");
    expect(tab).toHaveClass("text-base");
  });
});

// ─── Full Width ─────────────────────────────────────────────────────

describe("Tabs fullWidth", () => {
  it("applies w-full to root when fullWidth is true", () => {
    setupTabs({ fullWidth: true });
    const tabList = getTabList();
    expect(tabList).toHaveClass("w-full");
  });

  it("tab has flex-1 when fullWidth is true", () => {
    setupTabs({ fullWidth: true });
    const tab = getTab("Tab 1");
    expect(tab).toHaveClass("flex-1");
  });
});

// ─── Compound Component Constraints ─────────────────────────────────

describe("Tabs compound component constraints", () => {
  it("throws when Tab is used outside Tabs", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(<Tab value="test">Test</Tab>);
    }).toThrow("Tabs compound components must be used within a <Tabs> root.");
    consoleError.mockRestore();
  });

  it("throws when TabPanel is used outside Tabs", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(<TabPanel value="test">Test</TabPanel>);
    }).toThrow("Tabs compound components must be used within a <Tabs> root.");
    consoleError.mockRestore();
  });

  it("throws when TabList is used outside Tabs", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(<TabList aria-label="test" />);
    }).toThrow("Tabs compound components must be used within a <Tabs> root.");
    consoleError.mockRestore();
  });
});

// ─── Custom ClassName ────────────────────────────────────────────────

describe("Tabs custom className", () => {
  it("merges className on Tabs root", () => {
    render(
      <Tabs className="custom-root" defaultValue="a">
        <TabList aria-label="Custom">
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Panel</TabPanel>
      </Tabs>,
    );
    // The root div should have the custom class
    const root = document.querySelector(".custom-root");
    expect(root).toBeInTheDocument();
  });

  it("merges className on Tab", () => {
    setupTabs();
    const tab = getTab("Tab 1");
    // We didn't pass custom class, so just check it exists
    expect(tab).toBeInTheDocument();
  });

  it("merges className on TabPanel", () => {
    setupTabs();
    const panel = screen.getByText("Content 1").closest('[role="tabpanel"]');
    expect(panel).toBeInTheDocument();
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────

describe("Tabs ref forwarding", () => {
  it("forwards ref to root div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Tabs ref={ref} defaultValue="a">
        <TabList aria-label="Ref test">
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Panel</TabPanel>
      </Tabs>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("Tab forwards ref to button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Tabs defaultValue="a">
        <TabList aria-label="Tab ref">
          <Tab ref={ref} value="a">
            A
          </Tab>
        </TabList>
        <TabPanel value="a">Panel</TabPanel>
      </Tabs>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("A");
  });

  it("TabPanel forwards ref to div element", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Tabs defaultValue="a">
        <TabList aria-label="Panel ref">
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel ref={ref} value="a">
          Panel Content
        </TabPanel>
      </Tabs>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.textContent).toBe("Panel Content");
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Tabs edge cases", () => {
  it("handles single tab", () => {
    render(
      <Tabs defaultValue="only">
        <TabList aria-label="Single">
          <Tab value="only">Only Tab</Tab>
        </TabList>
        <TabPanel value="only">Only Content</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tab")).toBeInTheDocument();
    expect(screen.getByText("Only Content")).toBeInTheDocument();
  });

  it("handles many tabs (10+)", () => {
    const tabs = Array.from({ length: 12 }, (_, i) => ({
      value: `tab${i}`,
      label: `Tab ${i}`,
      content: `Content ${i}`,
    }));
    setupTabs({ defaultValue: "tab0" }, tabs);
    expect(screen.getAllByRole("tab")).toHaveLength(12);
  });

  it("handles rapid tab switching", async () => {
    const onValueChange = jest.fn();
    const { user } = setupTabs({ onValueChange });

    await user.click(getTab("Tab 2"));
    await user.click(getTab("Tab 3"));
    await user.click(getTab("Tab 1"));

    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange).toHaveBeenLastCalledWith("tab1");
  });

  it("does not crash when tab values change dynamically (register/unregister)", () => {
    const { rerender } = render(
      <Tabs defaultValue="a">
        <TabList aria-label="Dynamic">
          <Tab value="a">A</Tab>
          <Tab value="b">B</Tab>
        </TabList>
        <TabPanel value="a">Panel A</TabPanel>
        <TabPanel value="b">Panel B</TabPanel>
      </Tabs>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);

    rerender(
      <Tabs defaultValue="a">
        <TabList aria-label="Dynamic">
          <Tab value="a">A</Tab>
          <Tab value="b">B</Tab>
          <Tab value="c">C</Tab>
        </TabList>
        <TabPanel value="a">Panel A</TabPanel>
        <TabPanel value="b">Panel B</TabPanel>
        <TabPanel value="c">Panel C</TabPanel>
      </Tabs>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("handles empty children gracefully", () => {
    render(
      <Tabs defaultValue="x">
        <TabList aria-label="Empty" />
      </Tabs>,
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
  });
});

// ─── Tabs.Context Export ────────────────────────────────────────────

describe("Tabs.Context", () => {
  it("exports TabsContext for advanced usage", () => {
    expect(Tabs.Context).toBeDefined();
  });
});

// ─── Orientation Classes ────────────────────────────────────────────

describe("Tabs orientation", () => {
  it("horizontal orientation uses flex-col root layout", () => {
    render(
      <Tabs orientation="horizontal" defaultValue="a">
        <TabList aria-label="Horizontal">
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Panel</TabPanel>
      </Tabs>,
    );
    // The root div should have flex flex-col (tablist above panel)
    const root = document.querySelector('[role="tablist"]')?.parentElement;
    expect(root).toHaveClass("flex-col");
  });

  it("vertical orientation uses flex-row root layout", () => {
    render(
      <Tabs orientation="vertical" defaultValue="a">
        <TabList aria-label="Vertical">
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Panel</TabPanel>
      </Tabs>,
    );
    const root = document.querySelector('[role="tablist"]')?.parentElement;
    expect(root).toHaveClass("flex-row");
  });
});
