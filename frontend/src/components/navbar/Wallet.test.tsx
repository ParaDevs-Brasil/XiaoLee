// @vitest-environment jsdom

import React from "react";
import { cleanup, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Wallet from "./Wallet";

vi.mock("@/hooks/useModal", () => ({
  useModal: () => ({
    isOpen: true,
    animateIn: true,
    closeModal: vi.fn(),
  }),
}));

const {
  simulateTransactionMock,
  sendRawTransactionMock,
  confirmTransactionMock,
  deserializeMock,
} = vi.hoisted(() => ({
  simulateTransactionMock: vi.fn(),
  sendRawTransactionMock: vi.fn(),
  confirmTransactionMock: vi.fn(),
  deserializeMock: vi.fn(),
}));

vi.mock("@solana/web3.js", () => ({
  clusterApiUrl: vi.fn(() => "https://api.devnet.solana.com"),
  Connection: vi.fn(() => ({
    simulateTransaction: simulateTransactionMock,
    sendRawTransaction: sendRawTransactionMock,
    confirmTransaction: confirmTransactionMock,
  })),
  VersionedTransaction: {
    deserialize: deserializeMock,
  },
}));

describe("Wallet swap flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    simulateTransactionMock.mockResolvedValue({
      value: {
        err: null,
        logs: ["sim ok"],
      },
    });
    sendRawTransactionMock.mockResolvedValue("tx-signature-123");
    confirmTransactionMock.mockResolvedValue({ value: { err: null } });

    deserializeMock.mockReturnValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          cluster: "devnet",
          quote: {
            outAmount: "2000000000",
            otherAmountThreshold: "1900000000",
            priceImpactPct: "0.01",
            slippageBps: 50,
            routePlan: [{}, {}],
          },
          swap_transaction_base64: "AQ==",
          disclaimer: "Transacao somente preparada.",
        }),
      })),
    );

    (window as Window & { solana?: unknown }).solana = {
      isPhantom: true,
      connect: vi.fn(async () => ({
        publicKey: { toString: () => "Wallet111111111111111111111111111111111111" },
      })),
      signTransaction: vi.fn(async (tx: unknown) => tx),
    };
  });

  it("shows guidance when Phantom is unavailable", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    (window as Window & { solana?: unknown }).solana = undefined;

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    expect(
      await screen.findByText("Phantom Wallet nao encontrada. Instale a extensao para continuar."),
    ).toBeTruthy();
  });

  it("connects, prepares, simulates and sends after explicit confirmation", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    expect(await screen.findByText("Carteira conectada na Solana Devnet.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));
    expect(await screen.findByText("Swap preparado e simulado. Revise antes de assinar.")).toBeTruthy();

    expect(screen.getByText(/Saida estimada:/)).toBeTruthy();
    expect(screen.getByText(/Minimo estimado:/)).toBeTruthy();
    expect(screen.getByText(/Slippage configurado:/)).toBeTruthy();

    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulacao e quero enviar esta transacao na Devnet.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Assinar e Enviar" }));

    expect(await screen.findByText("Transacao enviada com sucesso na Devnet.")).toBeTruthy();
    expect(await screen.findByText(/Tx Signature: tx-signature-123/)).toBeTruthy();
  });
});