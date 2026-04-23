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

  it("blocks send when simulation returns error", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    simulateTransactionMock.mockResolvedValueOnce({
      value: {
        err: { InstructionError: [0, "Custom"] },
        logs: ["sim fail"],
      },
    });

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText(/Erro na simulacao:/)).toBeTruthy();

    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulacao e quero enviar esta transacao na Devnet.",
      }),
    );

    const sendButton = screen.getByRole("button", { name: "Assinar e Enviar" });
    expect(sendButton.getAttribute("disabled")).not.toBeNull();
    expect(sendRawTransactionMock).not.toHaveBeenCalled();
  });

  it("builds prepare payload using selected token decimals", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    await user.clear(screen.getByPlaceholderText("Quantidade USDC"));
    await user.type(screen.getByPlaceholderText("Quantidade USDC"), "1.5");

    await user.selectOptions(screen.getByLabelText("Token de entrada"), "So11111111111111111111111111111111111111112");
    await user.selectOptions(screen.getByLabelText("Token de saida"), "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    const fetchMock = vi.mocked(fetch);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string) as {
      amount_raw: number;
      input_mint: string;
      output_mint: string;
    };

    expect(body.amount_raw).toBe(1500000000);
    expect(body.input_mint).toBe("So11111111111111111111111111111111111111112");
    expect(body.output_mint).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  });

  it("shows API error when prepare endpoint fails", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        text: async () => "backend prepare error",
      })),
    );

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("backend prepare error")).toBeTruthy();
    expect(sendRawTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects prepare when input and output token are equal", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    await user.selectOptions(
      screen.getByLabelText("Token de saida"),
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Token de entrada e saida nao podem ser iguais.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects prepare when amount is zero", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    await user.clear(screen.getByPlaceholderText("Quantidade USDC"));
    await user.type(screen.getByPlaceholderText("Quantidade USDC"), "0");

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Informe um valor valido para o token de entrada.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects prepare when amount is non-numeric", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    await user.clear(screen.getByPlaceholderText("Quantidade USDC"));
    await user.type(screen.getByPlaceholderText("Quantidade USDC"), "abc");

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Informe um valor valido para o token de entrada.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("surfaces wallet signing rejection", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    (window as Window & { solana?: { signTransaction: (tx: unknown) => Promise<unknown> } }).solana = {
      ...(window as Window & { solana?: object }).solana as object,
      signTransaction: vi.fn(async () => {
        throw new Error("User rejected signature");
      }),
    };

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulacao e quero enviar esta transacao na Devnet.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Assinar e Enviar" }));

    expect(await screen.findByText("User rejected signature")).toBeTruthy();
    expect(screen.queryByText(/Tx Signature:/)).toBeNull();
  });

  it("surfaces network send failure", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    sendRawTransactionMock.mockRejectedValueOnce(new Error("RPC send failed"));

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));
    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulacao e quero enviar esta transacao na Devnet.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Assinar e Enviar" }));

    expect(await screen.findByText("RPC send failed")).toBeTruthy();
    expect(screen.queryByText(/Tx Signature:/)).toBeNull();
  });
});