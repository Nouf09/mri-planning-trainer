import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ClinicalCasePanel } from "@/components/ClinicalCasePanel";
import { DEFAULT_CASE_ID } from "@/features/training-cases/data/training-cases";

afterEach(cleanup);

function openCaseList(selectedCaseId: string | null = DEFAULT_CASE_ID) {
  const onSelectCase = vi.fn();
  render(
    createElement(ClinicalCasePanel, { selectedCaseId, onSelectCase })
  );
  // Radix opens its listbox on keyboard activation of the trigger.
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  return { onSelectCase };
}

describe("selected case", () => {
  it("shows the routine brain case as the current selection", () => {
    render(
      createElement(ClinicalCasePanel, {
        selectedCaseId: DEFAULT_CASE_ID,
        onSelectCase: vi.fn(),
      })
    );
    expect(screen.getAllByText("Adult Routine Brain MRI").length).toBeGreaterThan(0);
  });

  it("shows the details of the selected case", () => {
    render(
      createElement(ClinicalCasePanel, {
        selectedCaseId: DEFAULT_CASE_ID,
        onSelectCase: vi.fn(),
      })
    );
    expect(screen.getByText(/Adult training subject/)).toBeInTheDocument();
  });

  it("omits the sequence row when a case lists none", () => {
    render(
      createElement(ClinicalCasePanel, {
        selectedCaseId: DEFAULT_CASE_ID,
        onSelectCase: vi.fn(),
      })
    );
    expect(screen.queryByText("Sequences:")).toBeNull();
  });
});

describe("advanced cases are visible but unavailable", () => {
  it("groups them under an explicit coming-later label", () => {
    openCaseList();
    expect(screen.getByText("Advanced — Coming Later")).toBeInTheDocument();
  });

  it("keeps each original case title visible", () => {
    openCaseList();
    for (const title of [
      "Acute Stroke Evaluation",
      "Brain Tumor Assessment",
      "Multiple Sclerosis Evaluation",
    ]) {
      expect(screen.getByRole("option", { name: new RegExp(title) })).toBeInTheDocument();
    }
  });

  it("exposes disabled semantics, not colour alone", () => {
    openCaseList();
    const advanced = screen.getByRole("option", { name: /Acute Stroke Evaluation/ });
    expect(advanced).toHaveAttribute("aria-disabled", "true");
    // Text, so the state survives without colour perception.
    expect(advanced).toHaveTextContent(/coming later/i);
  });

  it("leaves the available case enabled", () => {
    openCaseList();
    const routine = screen.getByRole("option", { name: /Adult Routine Brain MRI/ });
    expect(routine).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("selection contract", () => {
  it("does not report a selection when an advanced case is clicked", () => {
    const { onSelectCase } = openCaseList();
    fireEvent.click(screen.getByRole("option", { name: /Acute Stroke Evaluation/ }));
    expect(onSelectCase).not.toHaveBeenCalled();
  });

  it("does not report a selection when an advanced case is activated by keyboard", () => {
    const { onSelectCase } = openCaseList();
    const advanced = screen.getByRole("option", { name: /Brain Tumor Assessment/ });
    fireEvent.keyDown(advanced, { key: "Enter" });
    fireEvent.keyDown(advanced, { key: " " });
    expect(onSelectCase).not.toHaveBeenCalled();
  });

  it("reports the case id when an available case is chosen", () => {
    const { onSelectCase } = openCaseList(null);
    fireEvent.click(screen.getByRole("option", { name: /Adult Routine Brain MRI/ }));
    expect(onSelectCase).toHaveBeenCalledWith(DEFAULT_CASE_ID);
  });
});
