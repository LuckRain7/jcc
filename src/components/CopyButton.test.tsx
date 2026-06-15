/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
});

describe("CopyButton", () => {
  it("点击成功复制后显示已复制", async () => {
    // userEvent.setup() installs its own clipboard stub on navigator.clipboard
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<CopyButton code="ABC123" />);
    await user.click(screen.getByRole("button", { name: /复制/ }));
    expect(writeText).toHaveBeenCalledWith("ABC123");
    expect(await screen.findByText(/已复制/)).toBeInTheDocument();
  });

  it("剪贴板失败时显示降级文本框", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CopyButton code="ABC123" />);
    await user.click(screen.getByRole("button", { name: /复制/ }));
    const fallback = await screen.findByDisplayValue("ABC123");
    expect(fallback).toBeInTheDocument();
  });
});
