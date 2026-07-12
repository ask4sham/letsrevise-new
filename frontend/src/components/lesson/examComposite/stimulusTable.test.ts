import { columnHeaderLabel, parseStimulusTable } from "./stimulusTable";

describe("stimulusTable helpers", () => {
  test("parseStimulusTable accepts valid shape", () => {
    const table = parseStimulusTable({
      title: "Results",
      columns: [
        { heading: "Temperature", unit: "°C" },
        { heading: "Rate", unit: "s⁻¹" },
      ],
      rows: [
        ["20", "0.01"],
        ["30", "0.02"],
        ["40", "0.03"],
      ],
    });
    expect(table?.columns).toHaveLength(2);
    expect(table?.rows[1][0]).toBe("30");
  });

  test("parseStimulusTable rejects empty/invalid", () => {
    expect(parseStimulusTable(null)).toBeNull();
    expect(parseStimulusTable({ columns: [], rows: [] })).toBeNull();
  });

  test("columnHeaderLabel includes unit when missing from heading", () => {
    expect(columnHeaderLabel({ heading: "Temperature", unit: "°C" })).toBe("Temperature (°C)");
    expect(columnHeaderLabel({ heading: "Temperature (°C)", unit: "°C" })).toBe("Temperature (°C)");
  });
});
