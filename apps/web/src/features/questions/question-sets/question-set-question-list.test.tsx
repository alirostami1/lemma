// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuestionSetQuestionList } from "./question-set-question-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params: { questionSetId: string; questionId: string };
  } & ComponentPropsWithoutRef<"a">) => (
    <a
      href={to
        .replace("$questionSetId", params.questionSetId)
        .replace("$questionId", params.questionId)}
      {...props}
    >
      {children}
    </a>
  ),
}));

describe("QuestionSetQuestionList", () => {
  it("renders compact question navigation rows", () => {
    render(
      <QuestionSetQuestionList
        questionSetId="set-1"
        items={[
          {
            id: "question-1",
            title: "Question 1",
            description: "What is 2 + 2?",
            metadata: "Generated Jun 14, 2026",
          },
        ]}
        isLoading={false}
      />,
    );

    const link = screen.getByRole("link", { name: "Open Question 1" });
    expect(link.getAttribute("href")).toBe(
      "/question-sets/set-1/questions/question-1",
    );
    expect(screen.getByText("What is 2 + 2?")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
