jest.mock("../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpecSelector } from "./SpecSelector";

describe("SpecSelector", () => {
  it("includes Edexcel IGCSE Biology (4BI1)", () => {
    render(<SpecSelector value="aqa-gcse-biology" onChange={() => {}} />);
    expect(screen.getByRole("option", { name: "Edexcel IGCSE Biology (4BI1)" })).toBeInTheDocument();
  });

  it("includes existing AQA GCSE Biology", () => {
    render(<SpecSelector value="aqa-gcse-biology" onChange={() => {}} />);
    expect(screen.getByRole("option", { name: "AQA GCSE Biology (8461)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "AQA GCSE Chemistry" })).toBeInTheDocument();
  });

  it("calls onChange with edexcel-igcse-biology when selected", async () => {
    const onChange = jest.fn();
    render(<SpecSelector value="aqa-gcse-biology" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "edexcel-igcse-biology");
    expect(onChange).toHaveBeenCalledWith("edexcel-igcse-biology");
  });
});
