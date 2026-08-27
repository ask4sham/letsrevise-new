import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { AskAiStudentPanel } from "./AskAiStudentPanel";
import { ASK_SHAM_SUBCOPY } from "../../utils/askAiStudentLessonNative";
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

const ASK_SHAM_UNAVAILABLE =
  "Ask Sham isn't available right now. Please try again shortly.";

const directAnswerResponse: enquiryApi.PostEnquiryResponse = {
  enquiryLogId: "enq-1",
  question: "Why are gametes important?",
  specKey: "edexcel-igcse-biology",
  topicKey: "edexcel-igcse-biology:reproduction/gametes-fertilisation",
  usedSources: [],
  answer: {
    explanation: "Gametes carry half the genetic information for reproduction.",
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

function renderRichPanel(
  props: Partial<React.ComponentProps<typeof AskAiStudentPanel>> = {}
) {
  return render(
    <AskAiStudentPanel
      specKey={SPEC}
      topicKey={TOPIC}
      lessonId={LESSON_ID}
      lessonTitle="Gametes and Fertilisation"
      pageTitle="Learn"
      {...props}
    />
  );
}

describe("AskAiStudentPanel rich student UI", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockCreateConversation.mockResolvedValue({ conversationId: "conv-test-1" });
    mockGetConversation.mockResolvedValue({ messages: [] } as never);
  });

  test("renders rich Ask Sham shell with modes, textarea, Send, and truthful subcopy", async () => {
    seedConversation();
    renderRichPanel();

    expect(screen.getAllByText("Ask Sham").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(ASK_SHAM_SUBCOPY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quick help" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revision" })).toBeInTheDocument();
    expect(screen.getByText("About this lesson")).toBeInTheDocument();
    expect(screen.getByText("Tutor actions")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask Sham" })).not.toBeInTheDocument();
    expect(screen.queryByText(/trusted LetsRevise sources/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Searching trusted sources/i)).not.toBeInTheDocument();
  });

  test("submits direct student enquiry with lessonId, conversationId, includePractice false", async () => {
    seedConversation();
    mockPostEnquiry.mockResolvedValueOnce(directAnswerResponse);
    renderRichPanel();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Why are gametes important?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(mockPostEnquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          specKey: SPEC,
          topicKey: TOPIC,
          conversationId: "conv-test-1",
          lessonId: LESSON_ID,
          includePractice: false,
          mode: "lesson",
        })
      );
    });
  });

  test("shows Keep learning after answer and toggles Show/Hide explanation with green styling", async () => {
    seedConversation();
    mockPostEnquiry.mockResolvedValueOnce(directAnswerResponse);
    renderRichPanel();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Why are gametes important?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Keep learning")).toBeInTheDocument();
    expect(
      screen.queryByText("Gametes carry half the genetic information for reproduction.")
    ).not.toBeInTheDocument();

    const showBtn = screen.getByRole("button", { name: "Show explanation" });
    expect(showBtn).toHaveStyle({ background: "rgb(22, 163, 74)", color: "rgb(255, 255, 255)" });

    fireEvent.click(showBtn);
    expect(
      screen.getByText("Gametes carry half the genetic information for reproduction.")
    ).toBeInTheDocument();

    const hideBtn = screen.getByRole("button", { name: "Hide explanation" });
    expect(hideBtn).toHaveStyle({ background: "rgb(22, 163, 74)", color: "rgb(255, 255, 255)" });

    fireEvent.click(hideBtn);
    expect(
      screen.queryByText("Gametes carry half the genetic information for reproduction.")
    ).not.toBeInTheDocument();
  });

  test("shows Thinking… while loading, not trusted-source wording", async () => {
    seedConversation();
    let resolveEnquiry!: (value: enquiryApi.PostEnquiryResponse) => void;
    mockPostEnquiry.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEnquiry = resolve;
      })
    );
    renderRichPanel();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "What is mitosis?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Thinking…" })).toBeDisabled();
    expect(screen.getAllByText("Thinking…").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Searching trusted sources/i)).not.toBeInTheDocument();

    resolveEnquiry(directAnswerResponse);
    await waitFor(() => {
      expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    });
  });

  test("preserves ASK_SHAM_UNAVAILABLE handling and generic errors separately", async () => {
    seedConversation();
    mockPostEnquiry
      .mockRejectedValueOnce({ data: { error: ASK_SHAM_UNAVAILABLE } })
      .mockRejectedValueOnce({ data: { error: "Something else went wrong" } });

    renderRichPanel();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question one" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(ASK_SHAM_UNAVAILABLE)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question two" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Something else went wrong")).toBeInTheDocument();
  });

  test("About this lesson chips send follow-up prompts", async () => {
    seedConversation();
    mockPostEnquiry.mockResolvedValue(directAnswerResponse);
    renderRichPanel();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Explain this page" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Explain this page" }));

    await waitFor(() => {
      expect(mockPostEnquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.stringContaining('"Learn"'),
        })
      );
    });

    const tutorSection = screen.getByText("Tutor actions").closest("div");
    expect(tutorSection).toBeTruthy();
    expect(within(tutorSection!.parentElement!).getByRole("button", { name: "Explain again" })).toBeInTheDocument();
  });
});
