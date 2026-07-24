import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceErrorBoundary } from "@/shared/errors/WorkspaceErrorBoundary";

/** Throws during render, the way an unexpected workspace defect would. */
function Bomb(): never {
  throw new Error("synthetic workspace defect");
}

// React itself reports caught errors through console.error, so silence it for
// clean test output and assert against the spy where the contract requires it.
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("normal operation", () => {
  it("renders children untouched when nothing throws", () => {
    render(
      <WorkspaceErrorBoundary>
        <p>planning workspace content</p>
      </WorkspaceErrorBoundary>
    );
    expect(screen.getByText("planning workspace content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("unexpected child render error", () => {
  it("shows the fallback instead of crashing the tree", () => {
    render(
      <WorkspaceErrorBoundary>
        <Bomb />
      </WorkspaceErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("contains the required heading and reload button", () => {
    render(
      <WorkspaceErrorBoundary>
        <Bomb />
      </WorkspaceErrorBoundary>
    );
    expect(
      screen.getByRole("heading", { name: "The workspace encountered an error" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload workspace" })).toBeInTheDocument();
  });

  it("does not expose the error message or stack in the visible UI", () => {
    render(
      <WorkspaceErrorBoundary>
        <Bomb />
      </WorkspaceErrorBoundary>
    );
    expect(screen.queryByText(/synthetic workspace defect/)).toBeNull();
    expect(screen.queryByText(/at Bomb/)).toBeNull();
  });

  it("logs the original error and component stack for developers", () => {
    render(
      <WorkspaceErrorBoundary>
        <Bomb />
      </WorkspaceErrorBoundary>
    );
    const boundaryLog = errorSpy.mock.calls.find(
      (call) => call[0] === "MRI workspace error:"
    );
    expect(boundaryLog).toBeDefined();
    expect(boundaryLog?.[1]).toBeInstanceOf(Error);
    expect((boundaryLog?.[1] as Error).message).toBe("synthetic workspace defect");
    expect(String(boundaryLog?.[2])).toContain("Bomb");
  });
});

describe("recovery action", () => {
  it("invokes the injected reload behavior when the button is clicked", () => {
    const onReload = vi.fn();
    render(
      <WorkspaceErrorBoundary onReload={onReload}>
        <Bomb />
      </WorkspaceErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload workspace" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
