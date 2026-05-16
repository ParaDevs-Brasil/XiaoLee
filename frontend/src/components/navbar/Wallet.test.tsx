// @vitest-environment jsdom

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Wallet from "./Wallet";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "pt",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const pt: Record<string, string> = {
        "wallet.title": "Minha Carteira",
        "wallet.subtitle": "Seu saldo de cripto",
        "wallet.total_balance": "Saldo Total",
        "wallet.network": "Solana Devnet",
        "wallet.your_tokens": "Seus Tokens",
        "wallet.no_tokens": "Sem tokens ainda!",
        "wallet.no_tokens_sub": "Comece a ganhar participando de campanhas",
        "wallet.swap_title": "Swap — Solana Devnet",
        "wallet.connect_phantom": "Conectar Phantom",
        "wallet.connected": "Conectada",
        "wallet.input_token": "Token de entrada",
        "wallet.output_token": "Token de saída",
        "wallet.qty": "Qtd.",
        "wallet.prepare": "Preparar e Simular",
        "wallet.preparing": "Preparando...",
        "wallet.sign_send": "Assinar e Enviar",
        "wallet.sending": "Enviando...",
        "wallet.confirm_text": "Confirmo que revisei a simulação e quero enviar na Devnet.",
        "wallet.exec_summary": "Resumo de execução",
        "wallet.route": "Rota:",
        "wallet.input": "Entrada:",
        "wallet.estimated_output": "Saída estimada:",
        "wallet.min_output": "Mínimo garantido:",
        "wallet.price_impact": "Impacto no preço:",
        "wallet.cluster": "Cluster:",
        "wallet.sim_logs": "Logs da simulação",
        "wallet.secured": "Protegido pela Xiaolee",
        "wallet.disconnect": "Desconectar carteira",
        "wallet.phantom_not_found": "Phantom Wallet não encontrada. Instale a extensão para continuar.",
        "wallet.connected_msg": "Carteira conectada na Solana Devnet.",
        "wallet.connect_error": "Não foi possível conectar a carteira.",
        "wallet.connect_first": "Conecte a carteira antes de preparar o swap.",
        "wallet.select_valid": "Selecione tokens válidos para o swap.",
        "wallet.same_token": "Token de entrada e saída não podem ser iguais.",
        "wallet.invalid_amount": "Informe um valor válido para o token de entrada.",
        "wallet.prepare_success": "Swap preparado e simulado. Revise antes de assinar.",
        "wallet.prepare_error": "Erro inesperado ao preparar swap.",
        "wallet.confirm_first": "Confirme que revisou a simulação antes de enviar.",
        "wallet.phantom_missing": "Phantom Wallet não encontrada.",
        "wallet.tx_success": "Transação enviada com sucesso na Devnet.",
        "wallet.tx_error": "Falha ao assinar/enviar transação.",
      };
      return pt[key] ?? key;
    },
  }),
}));

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
    localStorage.clear();

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
      // Reject onlyIfTrusted so auto-connect silently fails (wallet stays disconnected).
      // Manual connect (no opts) succeeds so tests can click "Conectar Phantom" themselves.
      connect: vi.fn(async (opts?: { onlyIfTrusted?: boolean }) => {
        if (opts?.onlyIfTrusted) throw new Error("Not trusted");
        return { publicKey: { toString: () => "Wallet111111111111111111111111111111111111" } };
      }),
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
      await screen.findByText("Phantom Wallet não encontrada. Instale a extensão para continuar."),
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

    expect(screen.getByText(/Saída estimada:/)).toBeTruthy();
    expect(screen.getByText(/Mínimo garantido:/)).toBeTruthy();
    expect(screen.getByText(/Impacto no preço:/)).toBeTruthy();

    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulação e quero enviar na Devnet.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Assinar e Enviar" }));

    expect(await screen.findByText("Transação enviada com sucesso na Devnet.")).toBeTruthy();
    expect(await screen.findByText(/Tx: tx-signature-123/)).toBeTruthy();
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

    expect(await screen.findByText(/InstructionError/)).toBeTruthy();

    await user.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que revisei a simulação e quero enviar na Devnet.",
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

    await user.clear(screen.getByPlaceholderText("Qtd. USDC"));
    await user.type(screen.getByPlaceholderText("Qtd. USDC"), "1.5");

    await user.selectOptions(screen.getByLabelText("Token de entrada"), "So11111111111111111111111111111111111111112");
    await user.selectOptions(screen.getByLabelText("Token de saída"), "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

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
      screen.getByLabelText("Token de saída"),
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Token de entrada e saída não podem ser iguais.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects prepare when amount is zero", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    await user.clear(screen.getByPlaceholderText("Qtd. USDC"));
    await user.type(screen.getByPlaceholderText("Qtd. USDC"), "0");

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Informe um valor válido para o token de entrada.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects prepare when amount is non-numeric", async () => {
    const user = userEvent.setup();
    const view = render(<Wallet shouldOpen balance={[]} />);
    const screen = within(view.container);

    await user.click(screen.getByRole("button", { name: "Conectar Phantom" }));

    await user.clear(screen.getByPlaceholderText("Qtd. USDC"));
    await user.type(screen.getByPlaceholderText("Qtd. USDC"), "abc");

    await user.click(screen.getByRole("button", { name: "Preparar e Simular" }));

    expect(await screen.findByText("Informe um valor válido para o token de entrada.")).toBeTruthy();
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
        name: "Confirmo que revisei a simulação e quero enviar na Devnet.",
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
        name: "Confirmo que revisei a simulação e quero enviar na Devnet.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Assinar e Enviar" }));

    expect(await screen.findByText("RPC send failed")).toBeTruthy();
    expect(screen.queryByText(/Tx Signature:/)).toBeNull();
  });
});