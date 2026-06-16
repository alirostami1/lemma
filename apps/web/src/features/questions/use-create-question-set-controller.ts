import { useState } from "react";
import {
  type QuestionSet,
  useCreateQuestionSet,
} from "#/domains/questions";

export type CreateQuestionSetController = {
  name: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onNameChange(name: string): void;
  onSubmit(): Promise<QuestionSet | null>;
  reset(): void;
};

export function useCreateQuestionSetController(): CreateQuestionSetController {
  const createQuestionSet = useCreateQuestionSet();
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function reset() {
    setName("");
    setErrorMessage(null);
  }

  async function onSubmit() {
    setErrorMessage(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Name is required.");
      return null;
    }

    try {
      const result = await createQuestionSet.mutateAsync({ name: trimmedName });
      reset();
      return result.questionSet;
    } catch {
      setErrorMessage("Question set could not be created.");
      return null;
    }
  }

  return {
    name,
    errorMessage,
    isSubmitting: createQuestionSet.isPending,
    onNameChange: setName,
    onSubmit,
    reset,
  };
}
