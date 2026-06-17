import type { Meta, StoryObj } from "../../kc.gen";
import { createKcPageStory } from "../KcPageStory";

const { KcPageStory } = createKcPageStory({ pageId: "login.ftl" });

const meta = {
  title: "keycloak/login",
  component: KcPageStory,
} satisfies Meta<typeof KcPageStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const WithError = {
  args: {
    kcContext: {
      messagesPerField: {
        getFirstError: () => "Invalid username or password.",
        existsError: () => true,
      },
    },
  },
} satisfies Story;
