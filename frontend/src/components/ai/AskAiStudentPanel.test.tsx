import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AskAiStudentPanel } from "./AskAiStudentPanel";
import * as enquiryApi from "../../api/enquiry";
import * as conversationsApi from "../../api/conversations";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
      },
    })),
  },
  AxiosError: class AxiosError extends Error {},
  AxiosHeaders: function AxiosHeaders() {},
}));

jest.mock("../../api/enquiry");
jest.mock("../../api/conversations");

const mockPostEnquiry = enquiryApi.postEnquiry as jest.MockedFunction<typeof enquiryApi.postEnquiry>;
const mockCreateConversation = conversationsApi.createConversation as jest.MockedFunction<
  typeof conversationsApi.createConversation
>;
const mockGetConversation = conversationsApi.getConversation as jest.MockedFunction<
  typeof conversationsApi.getConversation
>;

const directAnswerResponse: enquiryApi.PostEnquiryResponse = {
  enquiryLogId: "enq-1",
  question: "Why are gametes important?",
  specKey: "edexcel-igcse-biology",
  topicKey: "edexcel-igcse-biology:reproduction/gametes-fertilisation",
  usedSources: [],
  answer: {
    explanation: "This is a simple Ask Sham test answer.",
    keyPoints: [],
    citations: [],
    practice: [],
    warnings: [],
  },
};

const SPEC = "edexcel-igcse-biology";
const TOPIC = "edexcel-igcse-biology:reproduction/gametes-fertilisation";
const LESSON_ID = "lesson-1";
const SESSION_KEY = `askai:conv:student:${SPEC}:${TOPIC}:${LESSON_ID}`;

function seedConversation() {
  sessionStorage.setItem(SESSION_KEY, "conv-test-1");
  mockGetConversation.mockResolvedValue({ messages: [] } as never);
}

describe("AskAiStudentPanel direct AI V1", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockCreateConversation.mockResolvedValue({ conversationId: "conv-test-1" });
    mockGetConversation.mockResolvedValue({ messages: [] } as never);
  });

  test("shows heading, subcopy, one textarea and one Ask Sham button", async () => {
    seedConversation();
    render(<AskAiStudentPanel specKey={SPEC} topicKey={TOPIC} lessonId={LESSON_ID} />);

    expect(screen.getAllByText("Ask Sham").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ask me anything.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask me anything…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask Sham" })).toBeInTheDocument();
  });

  test("has no mode, starter, follow-up, or evidence controls", async () => {
    seedConversation();
    render(<AskAiStudentPanel specKey={SPEC} topicKey={TOPIC} lessonId={LESSON_ID} />);

    expect(screen.queryByRole("button", { name: "Quick help" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explain" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revision" })).not.toBeInTheDocument();
    expect(screen.queryByText("About this lesson")).not.toBeInTheDocument();
    expect(screen.queryByText("Tutor actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Explain more simply")).not.toBeInTheDocument();
    expect(screen.queryByText("Give me an example")).not.toBeInTheDocument();
    expect(screen.queryByText("Test me")).not.toBeInTheDocument();
    expect(screen.queryByText("Where did this answer come from?")).not.toBeInTheDocument();
  });

  test("submits direct explain request and renders answer.explanation", async () => {
    seedConversation();
    mockPostEnquiry.mockResolvedValueOnce(directAnswerResponse);

    render(<AskAiStudentPanel specKey={SPEC} topicKey={TOPIC} lessonId={LESSON_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask me anything…")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText("Ask me anything…"), {
      target: { value: "Why are gametes important?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Sham" }));

    await waitFor(() => {
      expect(mockPostEnquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          responseMode: "explain",
          includePractice: false,
        })
      );
    });

    expect(await screen.findByTestId("ask-sham-answer")).toHaveTextContent(
      "This is a simple Ask Sham test answer."
    );
  });
});
