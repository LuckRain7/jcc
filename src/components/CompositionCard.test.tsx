/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompositionCard } from "./CompositionCard";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterEach(() => cleanup());

const item = {
  id: "1",
  name: "#6暗星卡莎【文姐】",
  note: "三星卡莎核心",
  code: "TFTSET",
  created_at: "t",
  updated_at: "t",
};

describe("CompositionCard", () => {
  it("展示清洗后的标题与作者，隐藏 # 前缀", () => {
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} onTogglePin={() => {}} />);
    expect(screen.getByText("6暗星卡莎")).toBeInTheDocument();
    expect(screen.getByText("文姐")).toBeInTheDocument();
    expect(screen.getByText("三星卡莎核心")).toBeInTheDocument();
  });

  it("点击卡片复制阵容码并提示已复制", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} onTogglePin={() => {}} />);
    await user.click(screen.getByRole("button", { name: /复制 6暗星卡莎 阵容码/ }));
    expect(writeText).toHaveBeenCalledWith("TFTSET");
    expect(await screen.findByText(/已复制/)).toBeInTheDocument();
  });

  it("剪贴板失败时显示降级文本框", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} onTogglePin={() => {}} />);
    await user.click(screen.getByRole("button", { name: /复制 6暗星卡莎 阵容码/ }));
    expect(await screen.findByDisplayValue("TFTSET")).toBeInTheDocument();
  });

  it("⋯ 菜单点编辑触发 onEdit", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={onEdit} onDelete={() => {}} onTogglePin={() => {}} />);
    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("未置顶时菜单显示「置顶」，点击触发 onTogglePin", async () => {
    const onTogglePin = vi.fn();
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} onTogglePin={onTogglePin} />);
    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("button", { name: "置顶" }));
    expect(onTogglePin).toHaveBeenCalledWith("1");
  });

  it("已置顶时菜单显示「取消置顶」并渲染角标", async () => {
    const user = userEvent.setup();
    render(
      <CompositionCard
        item={{ ...item, pinned_at: "2026-01-01T00:00:00Z" }}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
      />,
    );
    expect(screen.getByLabelText("已置顶")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多操作" }));
    expect(screen.getByRole("button", { name: "取消置顶" })).toBeInTheDocument();
  });

  it("⋯ 菜单点删除并确认后触发 onDelete", async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={onDelete} onTogglePin={() => {}} />);
    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
