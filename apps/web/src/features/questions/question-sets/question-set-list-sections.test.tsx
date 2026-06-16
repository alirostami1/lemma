// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuestionSetListSection } from "./question-set-list-sections";
import type { QuestionSetListController } from "./use-question-set-list-controller";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { questionSetId: string };
  } & ComponentPropsWithoutRef<"a">) => (
    <a
      href={params ? to.replace("$questionSetId", params.questionSetId) : to}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("../create-question-set-dialog", () => ({
  CreateQuestionSetDialogController: () => (
    <button type="button">Create question set</button>
  ),
}));

describe("QuestionSetListSection", () => {
  it("renders each question set as one navigation row", () => {
    render(<QuestionSetListSection controller={controller()} />);

    const link = screen.getByRole("link", { name: "Open Algebra review" });
    expect(link.getAttribute("href")).toBe("/question-sets/set-1");
    expect(link.className).toContain("px-3");
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create blueprint" }),
    ).toBeNull();
  });
});

function controller(): QuestionSetListController {
  return {
    viewModel: {
      title: "Question sets",
      description: "Organize generated questions by question set.",
      sectionTitle: "Question sets",
      sectionDescription: "1 question set",
      emptyDescription: "Question sets group generated questions for reuse.",
      items: [
        {
          id: "set-1",
          title: "Algebra review",
          metadata: "Updated Jun 14, 2026",
        },
      ],
    },
    questionSets: [
      {
        id: "set-1",
        ownerUserId: "owner",
        createdByUserId: "creator",
        name: "Algebra review",
        description: null,
        status: "active",
        createdAt: new Date("2026-06-14T00:00:00Z"),
        updatedAt: new Date("2026-06-14T00:00:00Z"),
      },
    ],
    pageError: null,
    isInitialLoading: false,
    initialErrorMessage: null,
    loadMoreErrorMessage: null,
    isLoadingMore: false,
    hasMore: false,
    onRetry: () => {},
    onLoadMore: () => {},
    onRetryLoadMore: () => {},
  };
}
