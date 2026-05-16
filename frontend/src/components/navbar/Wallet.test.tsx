// @vitest-environment jsdom
// Wallet.test.tsx — Stellar/Freighter tests (replaces Solana/Phantom suite)

import React from "react";
import { cleanup, render, act } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Wallet from "./Wallet";

vi.mock("@/hooks/useModal", () => ({
  useModal: () => ({ isOpen: true, animateIn: true, closeModal: vi.fn() }),
}));

const { connectFreighterMock, getStellarBalanceMock, isFreighterInstalledMock } = vi.hoisted(
  () => ({
    connectFreighterMock: vi.fn(),
    getStellarBalanceMock: vi.fn(),
    isFreighterInstalledMock: vi.fn(),
  }),
);

vi.mock("@/utils/stellar", () => ({
  connectFreighter: connectFreighterMock,
  getStellarBalance: getStellarBalanceMock,
  isFreighterInstalled: isFreighterInstalledMock,
}));

const MOCK_ACCOUNT = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL1FHNB39RSUVRGR";
const MOCK_BALANCE = {
  xlm: 100.5,
  assets: [{ asset_code: "USDC", asset_issuer: "GABC", balance: 25.0 }],
};

describe("Wallet — Stellar/Freighter", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    isFreighterInstalledMock.mockResolvedValue(true);
    connectFreighterMock.mockResolvedValue(MOCK_ACCOUNT);
    getStellarBalanceMock.mockResolvedValue(MOCK_BALANCE);
  });

  it("shows connect button when no account in localStorage", () => {
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    expect(within(container).getByRole("button", { name: /Conectar Freighter/i })).toBeTruthy();
  });

  it("shows Stellar Testnet label in header", () => {
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    expect(within(container).getByText(/Stellar Testnet/i)).toBeTruthy();
  });

  it("shows XLM and USDC in token strip", () => {
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(container);
    expect(screen.getAllByText("XLM").length).toBeGreaterThan(0);
    expect(screen.getByText("USDC")).toBeTruthy();
  });

  it("loads balance automatically when account already in localStorage", async () => {
    localStorage.setItem("stellar_account", MOCK_ACCOUNT);
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    expect(await within(container).findByText(/100\.5000 XLM/)).toBeTruthy();
  });

  it("connects Freighter and shows balance on button click", async () => {
    const user = userEvent.setup();
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(container);

    await user.click(screen.getByRole("button", { name: /Conectar Freighter/i }));

    expect(connectFreighterMock).toHaveBeenCalledOnce();
    expect(getStellarBalanceMock).toHaveBeenCalledWith(MOCK_ACCOUNT);
    expect(await screen.findByText(/100\.5000 XLM/)).toBeTruthy();
  });

  it("shows error when Freighter is not installed", async () => {
    isFreighterInstalledMock.mockResolvedValue(false);
    const user = userEvent.setup();
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(container);

    await user.click(screen.getByRole("button", { name: /Conectar Freighter/i }));

    expect(await screen.findByText(/Freighter não encontrado/)).toBeTruthy();
  });

  it("shows USDC balance when trust line exists", async () => {
    localStorage.setItem("stellar_account", MOCK_ACCOUNT);
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    expect(await within(container).findByText(/25\.00 USDC/)).toBeTruthy();
  });

  it("shows truncated address pill when connected", async () => {
    localStorage.setItem("stellar_account", MOCK_ACCOUNT);
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    await within(container).findByText(/100\.5000 XLM/);
    expect(within(container).getByText(/GBZXN7PI\.\.\.RSUVRGR/i)).toBeTruthy();
  });

  it("shows 'Freighter conectado!' status after connecting", async () => {
    const user = userEvent.setup();
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(container);

    await user.click(screen.getByRole("button", { name: /Conectar Freighter/i }));

    expect(await screen.findByText(/Freighter conectado/i)).toBeTruthy();
  });

  it("clears localStorage on disconnect", async () => {
    localStorage.setItem("stellar_account", MOCK_ACCOUNT);
    const user = userEvent.setup();
    const { container } = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(container);

    await screen.findByText(/100\.5000 XLM/);

    const disconnectBtn = container.querySelector("button svg.text-red-400")?.closest("button");
    if (disconnectBtn) await user.click(disconnectBtn);

    expect(localStorage.getItem("stellar_account")).toBeNull();
  });
});
