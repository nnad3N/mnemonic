import { ArrowUpIcon, SquareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { useThreadChat } from "../../-thread-chat-context";
import type { ThreadInputLocation } from "../../-thread-store";

type ComposerFooterProps = {
  location: ThreadInputLocation;
};

export const ComposerFooter = ({ location }: ComposerFooterProps) => {
  const chat = useThreadChat();

  return (
    <div className="flex w-full items-center justify-end">
      {chat.status === "streaming" ? (
        <Button
          onClick={async () => {
            await chat.stop();
          }}
          size="icon-xs"
          type="button"
        >
          <SquareIcon />
        </Button>
      ) : (
        <SendButton location={location} />
      )}
    </div>
  );
};

const SendButton = ({ location }: ComposerFooterProps) => {
  const { canSend, sendMessage } = useComposerActions(location);

  return (
    <Button
      disabled={!canSend}
      onClick={async () => {
        await sendMessage();
      }}
      size="icon-sm"
      type="button"
    >
      <ArrowUpIcon />
    </Button>
  );
};
