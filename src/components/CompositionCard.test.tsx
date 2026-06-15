/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompositionCard } from "./CompositionCard";

afterEach(() => cleanup());

const item = {
  id: "1", name: "娑娜炮台", note: "三星娑娜核心", code: "TFTSET",
  created_at: "t", updated_at: "t",
};

describe("CompositionCard", () => {
  it("渲染名称与备注", () => {
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("娑娜炮台")).toBeInTheDocument();
    expect(screen.getByText("三星娑娜核心")).toBeInTheDocument();
  });

  it("点编辑触发 onEdit", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={onEdit} onDelete={() => {}} />);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("点删除并确认后触发 onDelete", async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
