import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextEncoder, TextDecoder });

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import Community from "./pages/Community";
import Learn from "./pages/Learn";
import PlayHub from "./arena/PlayHub";
import Navbar from "./components/Navbar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Stub scrollTo / matchMedia for jsdom
window.scrollTo = jest.fn();

function mount(ui, initialEntries = ["/"]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthProvider>
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("renders Community page without crashing", () => {
  const { container, unmount } = mount(<Community />);
  expect(container.textContent).toBeTruthy();
  unmount();
});

test("renders How to Play (/learn) guide with core rules and keywords", () => {
  const { container, unmount } = mount(<Learn />, ["/learn"]);
  expect(container.textContent).toContain("HOW TO PLAY");
  expect(container.textContent).toContain("Glimmer Nodes");
  expect(container.textContent).toContain("Guard");
  expect(container.textContent).toContain("Ranked Elo");
  unmount();
});

test("renders mobile-first PlayHub with Ranked, Casual, Private Lobby, and GlimmerBot modes", () => {
  const { container, unmount } = mount(
    <PlayHub onEnterMatch={() => {}} onEnterLobby={() => {}} />,
    ["/play"]
  );
  expect(container.textContent).toContain("Competitive Ladder");
  expect(container.textContent).toContain("Unranked Quickplay");
  expect(container.textContent).toContain("Private Lobby");
  expect(container.textContent).toContain("GlimmerBot");
  unmount();
});

test("renders Navbar with mobile bottom tab bar and Sign In CTA", () => {
  const { container, unmount } = mount(<Navbar />, ["/play"]);
  expect(container.querySelector('[data-testid="mobile-bottom-nav"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="nav-mobile-signin"]')).not.toBeNull();
  unmount();
});
