import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastHost, useToast } from "./Toast";

function Trigger() {
  const { push } = useToast();
  return <button onClick={() => push({ title: "Saved", variant: "success" })}>fire</button>;
}

describe("Toast", () => {
  it("shows a pushed toast and auto-dismisses after the duration", () => {
    vi.useFakeTimers();
    render(
      <ToastHost>
        <Trigger />
      </ToastHost>,
    );
    act(() => screen.getByText("fire").click());
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("Saved")).toBeNull();
    vi.useRealTimers();
  });
});
