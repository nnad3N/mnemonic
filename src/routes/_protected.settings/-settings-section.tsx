import type * as React from "react";

import { cn } from "@/lib/utils";

type SettingsSectionProps = React.ComponentProps<"div">;

export const SettingsSection = ({ className, ...props }: SettingsSectionProps) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);

type SettingsSectionHeaderProps = React.ComponentProps<"div">;

export const SettingsSectionHeader = ({ className, ...props }: SettingsSectionHeaderProps) => (
  <div
    className={cn("flex items-center justify-between gap-3", className)}

    {...props}
  />
);

type SettingsSectionTitleProps = React.ComponentProps<"h2">;

export const SettingsSectionTitle = ({ className, ...props }: SettingsSectionTitleProps) => (
  // oxlint-disable-next-line jsx-a11y/heading-has-content
  <h2 className={cn("font-medium", className)} {...props} />
);
