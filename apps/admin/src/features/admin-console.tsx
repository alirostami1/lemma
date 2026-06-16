import { Button } from "@lemma/ui/components/button";
import { PageHeader } from "@lemma/ui/components/page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@lemma/ui/components/tabs";
import { RefreshCw } from "lucide-react";
import { PageContainer } from "#/components/patterns";
import {
  NotificationsPanel,
  useNotificationsController,
} from "#/features/notifications";
import { OverviewStrip, useOverviewController } from "#/features/overview";
import { QueuePanel, useQueueController } from "#/features/queue";
import { RolesPanel } from "#/features/roles";
import {
  EditUserDialog,
  GrantRoleDialog,
  UsersPanel,
  useUsersController,
} from "#/features/users";

export function AdminConsole() {
  const overview = useOverviewController();
  const users = useUsersController();
  const notifications = useNotificationsController();
  const queue = useQueueController();

  function refreshAll() {
    overview.refresh();
    users.refresh();
    notifications.refresh();
    queue.refresh();
  }

  const isRefreshing =
    overview.isFetching ||
    users.isFetching ||
    notifications.isFetching ||
    queue.isFetching;

  return (
    <PageContainer variant="resource">
      <PageHeader
        title="Admin"
        description="Users, roles, notification delivery, and operational recovery."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={isRefreshing}
            onClick={refreshAll}
          >
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <OverviewStrip
        overview={overview.overview}
        userCount={users.users.length}
        roleCount={users.roles.length}
        notificationCount={notifications.events.length}
        isLoading={
          overview.isLoading || users.isLoading || users.rolesListLoading
        }
      />

      <Tabs defaultValue="users" className="gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersPanel
            users={users.users}
            roles={users.roles}
            selectedUser={users.selectedUser}
            selectedRoles={users.selectedRoles}
            search={users.search}
            status={users.status}
            isLoading={users.isLoading}
            rolesLoading={users.rolesLoading}
            errorMessage={users.errorMessage}
            rolesErrorMessage={users.rolesErrorMessage}
            isMutating={users.isMutating}
            onSearchChange={users.setSearch}
            onStatusChange={users.setStatus}
            onSelectUser={users.selectUser}
            onEditUser={users.editUser}
            onGrantRole={users.openGrantRole}
            onSetStatus={users.setUserStatus}
            onRevokeRole={users.revokeRole}
            onRetry={users.retryUsers}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesPanel
            roles={users.roles}
            isLoading={users.rolesListLoading}
            errorMessage={users.rolesListErrorMessage}
            onRetry={users.retryRoles}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsPanel
            events={notifications.events}
            failedEvents={notifications.failedEvents}
            status={notifications.status}
            reviewState={notifications.reviewState}
            isLoading={notifications.isLoading}
            errorMessage={notifications.errorMessage}
            isMutating={notifications.isMutating}
            onStatusChange={notifications.setStatus}
            onReviewStateChange={notifications.setReviewState}
            onRetry={notifications.refresh}
            onReplay={notifications.replay}
            onReview={notifications.review}
            onIgnore={notifications.ignore}
          />
        </TabsContent>

        <TabsContent value="queue">
          <QueuePanel
            jobs={queue.jobs}
            state={queue.state}
            isLoading={queue.isLoading}
            errorMessage={queue.errorMessage}
            onStateChange={queue.setState}
            onRetry={queue.refresh}
          />
        </TabsContent>
      </Tabs>

      <EditUserDialog
        user={users.editingUser}
        open={users.editingUser !== null}
        isSaving={users.isSavingUser}
        onOpenChange={(open) => {
          if (!open) {
            users.closeEditUser();
          }
        }}
        onSave={users.saveUser}
      />

      <GrantRoleDialog
        user={users.grantingUser}
        roles={users.roles}
        userRoles={users.grantingUserRoles}
        open={users.grantingUser !== null}
        rolesLoading={users.grantRolesLoading}
        isSaving={users.isGrantingRole}
        onOpenChange={(open) => {
          if (!open) {
            users.closeGrantRole();
          }
        }}
        onGrant={users.grantUserRole}
      />
    </PageContainer>
  );
}
