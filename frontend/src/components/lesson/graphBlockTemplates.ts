import { createGraphSeriesId, type GraphBlockPayload } from "./graphBlockTypes";

export type GraphBlockTemplate = {
  id: string;
  label: string;
  description: string;
  payload: Omit<GraphBlockPayload, "type" | "content">;
};

export const GRAPH_BLOCK_TEMPLATES: GraphBlockTemplate[] = [
  {
    id: "photosynthesis-limiting",
    label: "Photosynthesis — limiting factors",
    description: "Light intensity vs rate (levels off)",
    payload: {
      title: "Effect of light intensity on photosynthesis rate",
      intro: "At low light intensity, rate increases linearly. At high intensity, another factor becomes limiting and the curve levels off.",
      graphType: "line",
      xAxisLabel: "Light intensity",
      yUnits: "arbitrary units",
      yAxisLabel: "Rate of photosynthesis",
      xUnits: "arbitrary units",
      graphSeries: [
        {
          id: createGraphSeriesId(),
          label: "Rate",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 2 },
            { x: 2, y: 4 },
            { x: 3, y: 5.5 },
            { x: 4, y: 6.2 },
            { x: 5, y: 6.5 },
            { x: 6, y: 6.6 },
          ],
        },
      ],
      graphAnnotations: [
        {
          id: "a1",
          kind: "trend",
          text: "Linear increase — light is the limiting factor.",
          pointIndex: 2,
        },
        {
          id: "a2",
          kind: "trend",
          text: "Plateau — temperature or CO₂ is now limiting.",
          pointIndex: 6,
        },
      ],
      examQuestion: "Describe the trend shown on the graph as light intensity increases.",
      markScheme:
        "Rate increases at low light intensity (1). Curve levels off at high intensity because another factor becomes limiting (1).",
      examinerTip: "Name the limiting factor at the plateau (e.g. CO₂ concentration or temperature).",
    },
  },
  {
    id: "enzyme-temperature",
    label: "Enzyme activity vs temperature",
    description: "Optimum then denaturation",
    payload: {
      title: "Effect of temperature on enzyme activity",
      intro: "Activity rises to an optimum, then falls sharply as the enzyme denatures.",
      graphType: "line",
      xAxisLabel: "Temperature",
      xUnits: "°C",
      yAxisLabel: "Enzyme activity",
      yUnits: "arbitrary units",
      graphSeries: [
        {
          id: createGraphSeriesId(),
          label: "Activity",
          points: [
            { x: 10, y: 20 },
            { x: 20, y: 45 },
            { x: 30, y: 70 },
            { x: 37, y: 100 },
            { x: 45, y: 85 },
            { x: 55, y: 40 },
            { x: 65, y: 10 },
          ],
        },
      ],
      graphAnnotations: [
        { id: "b1", text: "Optimum temperature — maximum collision frequency with substrate.", pointIndex: 3 },
        { id: "b2", kind: "trend", text: "Sharp decline — active site shape lost (denaturation).", pointIndex: 5 },
      ],
      examQuestion: "Explain why enzyme activity decreases after the optimum temperature.",
      markScheme: "Bonds holding enzyme shape break / active site changes (1); fewer successful enzyme–substrate complexes (1).",
      examinerTip: "Use the term denatured — do not say the enzyme dies.",
    },
  },
  {
    id: "distance-time",
    label: "Distance–time graph",
    description: "Uniform then stationary",
    payload: {
      title: "Distance–time graph",
      intro: "A straight diagonal section shows constant speed; a horizontal section shows the object is stationary.",
      graphType: "line",
      xAxisLabel: "Time",
      xUnits: "s",
      yAxisLabel: "Distance",
      yUnits: "m",
      graphSeries: [
        {
          id: createGraphSeriesId(),
          label: "Object A",
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 10 },
            { x: 4, y: 20 },
            { x: 6, y: 20 },
            { x: 8, y: 20 },
          ],
        },
      ],
      graphAnnotations: [
        { id: "c1", kind: "trend", text: "Constant gradient — constant speed.", pointIndex: 2 },
        { id: "c2", text: "Zero gradient — stationary.", pointIndex: 4 },
      ],
      examQuestion: "What does the horizontal section of the graph tell you about the motion?",
      markScheme: "Object is stationary / distance not changing with time (2).",
      examinerTip: "Gradient on a distance–time graph equals speed.",
    },
  },
];
