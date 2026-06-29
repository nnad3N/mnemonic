import { RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

import { useThreadChat } from "../-thread-chat-provider";

export const ThreadError = () => {
  const chat = useThreadChat();

  if (!chat.error) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-1 text-sm text-destructive">
      <p className="ml-2 min-w-0 flex-1">{m.chat_thread_error_unknown()}</p>
      <Button
        onClick={async () => {
          await chat.regenerate();
        }}
        size="icon-sm"
        variant="outline"
      >
        <RotateCwIcon />
      </Button>
    </div>
  );
};
