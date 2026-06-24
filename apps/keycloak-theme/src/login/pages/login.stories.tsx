import type { Meta, StoryObj } from "../../kc.gen";
import { createKcPageStory } from "../KcPageStory";

const { KcPageStory } = createKcPageStory({ pageId: "login.ftl" });

const meta = {
  component: KcPageStory,
  title: "keycloak/login",
} satisfies Meta<typeof KcPageStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const WithError = {
  args: {
    kcContext: {
      messagesPerField: {
        existsError: () => true,
        getFirstError: () => "Invalid username or password.",
      },
    },
  },
} satisfies Story;
