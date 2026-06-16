import type {
  CreateBlueprintListItem,
  CreateSourceListItem,
} from "./create-page-view-model";

export type CreateChooserController<TItem> = {
  open: boolean;
  items: TItem[];
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  errorMessage: string | null;
  loadMoreErrorMessage: string | null;
  hasMore: boolean;
  onOpenChange(open: boolean): void;
  onLoadMore(): void;
  onRetry(): void;
};

export type SavedBlueprintChooserController =
  CreateChooserController<CreateBlueprintListItem>;

export type SourceChooserController =
  CreateChooserController<CreateSourceListItem> & {
    onUploadSource(): void;
  };
