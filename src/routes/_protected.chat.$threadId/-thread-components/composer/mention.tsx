import { useRender } from "@base-ui/react/use-render";
import {
  FileIcon,
  FileTextIcon,
  LinkIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  TextIcon,
  XIcon,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export type MentionVariant = "error" | "neutral" | "cyan";

type MentionRootProps = PropsWithChildren<{
  className?: string;
  render: useRender.ComponentProps<"span">["render"];
  variant?: MentionVariant;
}>;

export const MentionRoot = ({ render, className, children, variant = "cyan" }: MentionRootProps) =>
  useRender({
    render,
    props: {
      className: cn(
        "mx-px inline-block translate-y-0.25 rounded-sm border px-1 py-0.5 align-baseline",
        variant === "cyan" &&
          "border-f-cyan-200 bg-f-cyan-100 dark:border-f-cyan-700 dark:bg-f-cyan-800",
        variant === "error" &&
          "border-f-red-200 bg-f-red-100 dark:border-f-red-700 dark:bg-f-red-800",
        variant === "neutral" &&
          "border-f-base-200 bg-f-base-100/50 dark:border-f-base-700 dark:bg-f-base-800/50",
        className,
      ),
      children,
    },
  });

type MentionContentProps = PropsWithChildren<{
  className?: string;
  render?: useRender.ComponentProps<"span">["render"];
}>;

export const MentionContent = ({ render, className, children }: MentionContentProps) => {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      className: cn(
        "group/mention relative flex items-center gap-1 text-sm leading-none select-none",
        className,
      ),
      children,
    },
  });
};

const mentionIconMap = {
  file: FileIcon,
  attachment: FileIcon,
  note: FileTextIcon,
  selection: TextIcon,
  thread: MessageSquareTextIcon,
  topic: MessagesSquareIcon,
  link: LinkIcon,
  pending: Loader2Icon,
  unknown: TextIcon,
};

type MentionIconProps = {
  className?: string;
  variant: keyof typeof mentionIconMap;
};

export const MentionIcon = ({ className, variant }: MentionIconProps) => {
  const Icon = mentionIconMap[variant];

  return (
    <Icon
      className={cn("size-3.25 shrink-0", variant === "pending" && "animate-spin", className)}
    />
  );
};

export const MentionRemoveIcon = ({ className }: { className?: string }) => {
  return <XIcon className={cn("size-3.25 shrink-0 scale-110", className)} />;
};

type MentionLabelProps = PropsWithChildren<{
  className?: string;
}>;

export const MentionLabel = ({ children, className }: MentionLabelProps) => (
  <span className={cn("max-w-60 truncate", className)}>{children}</span>
);
