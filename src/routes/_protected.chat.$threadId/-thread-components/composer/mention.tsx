import { useRender } from "@base-ui/react/use-render";
import {
  FileIcon,
  LinkIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  TextIcon,
  XIcon,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export type MentionVariant = "error" | "neutral" | "teal";

type MentionRootProps = PropsWithChildren<{
  className?: string;
  render: useRender.ComponentProps<"span">["render"];
  variant?: MentionVariant;
}>;

export const MentionRoot = ({
  render,
  className,
  children,
  variant = "teal",
}: MentionRootProps) =>
  useRender({
    render,
    props: {
      className: cn(
        "mx-px inline-block translate-y-0.25 rounded-sm border px-1 py-0.5 align-baseline",
        variant === "teal" && "border-teal-200 bg-teal-100",
        variant === "error" && "border-destructive/15 bg-destructive/10",
        variant === "neutral" && "border-gray-300 bg-gray-200/50",
        className
      ),
      children,
    },
  });

type MentionContentProps = PropsWithChildren<{
  className?: string;
  render?: useRender.ComponentProps<"span">["render"];
}>;

export const MentionContent = ({
  render,
  className,
  children,
}: MentionContentProps) => {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      className: cn(
        "group/mention relative flex items-center gap-1 text-sm leading-none select-none",
        className
      ),
      children,
    },
  });
};

const mentionIconMap = {
  artifact: FileIcon,
  attachment: FileIcon,
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

  return <Icon className={cn("size-3.25 shrink-0", className)} />;
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
