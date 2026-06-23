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
        actions={
          <Button
            disabled={isRefreshing}
            onClick={refreshAll}
            type="button"
            variant="outline"
          >
            <RefreshCw />
            Refresh
          </Button>
        }
        description="Users, roles, notification delivery, and operational recovery."
        title="Admin"
      />

      <OverviewStrip
        isLoading={
          overview.isLoading || users.isLoading || users.rolesListLoading
        }
        notificationCount={notifications.events.length}
        overview={overview.overview}
        roleCount={users.roles.length}
        userCount={users.users.length}
      />

      <Tabs className="gap-4" defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersPanel
            errorMessage={users.errorMessage}
            isLoading={users.isLoading}
            isMutating={users.isMutating}
            onEditUser={users.editUser}
            onGrantRole={users.openGrantRole}
            onRetry={users.retryUsers}
            onRevokeRole={users.revokeRole}
            onSearchChange={users.setSearch}
            onSelectUser={users.selectUser}
            onSetStatus={users.setUserStatus}
            onStatusChange={users.setStatus}
            roles={users.roles}
            rolesErrorMessage={users.rolesErrorMessage}
            rolesLoading={users.rolesLoading}
            search={users.search}
            selectedRoles={users.selectedRoles}
            selectedUser={users.selectedUser}
            status={users.status}
            users={users.users}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesPanel
            errorMessage={users.rolesListErrorMessage}
            isLoading={users.rolesListLoading}
            onRetry={users.retryRoles}
            roles={users.roles}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsPanel
            errorMessage={notifications.errorMessage}
            events={notifications.events}
            failedEvents={notifications.failedEvents}
            isLoading={notifications.isLoading}
            isMutating={notifications.isMutating}
            onIgnore={notifications.ignore}
            onReplay={notifications.replay}
            onRetry={notifications.refresh}
            onReview={notifications.review}
            onReviewStateChange={notifications.setReviewState}
            onStatusChange={notifications.setStatus}
            reviewState={notifications.reviewState}
            status={notifications.status}
          />
        </TabsContent>

        <TabsContent value="queue">
          <QueuePanel
            errorMessage={queue.errorMessage}
            isLoading={queue.isLoading}
            jobs={queue.jobs}
            onRetry={queue.refresh}
            onStateChange={queue.setState}
            state={queue.state}
          />
        </TabsContent>
      </Tabs>

      <EditUserDialog
        isSaving={users.isSavingUser}
        onOpenChange={(open) => {
          if (!open) {
            users.closeEditUser();
          }
        }}
        onSave={users.saveUser}
        open={users.editingUser !== null}
        user={users.editingUser}
      />

      <GrantRoleDialog
        isSaving={users.isGrantingRole}
        onGrant={users.grantUserRole}
        onOpenChange={(open) => {
          if (!open) {
            users.closeGrantRole();
          }
        }}
        open={users.grantingUser !== null}
        roles={users.roles}
        rolesLoading={users.grantRolesLoading}
        user={users.grantingUser}
        userRoles={users.grantingUserRoles}
      />
    </PageContainer>
  );
}
