import { createContext, type ReactNode, useContext } from "react";

type AddReferenceActions = {
  onUploadWorkbook?(): void;
};

const AddReferenceActionsContext = createContext<AddReferenceActions>({});

export function AddReferenceActionsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AddReferenceActions;
}) {
  return (
    <AddReferenceActionsContext.Provider value={value}>
      {children}
    </AddReferenceActionsContext.Provider>
  );
}

export function useAddReferenceActions() {
  return useContext(AddReferenceActionsContext);
}
