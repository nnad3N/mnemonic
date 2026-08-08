import { T, useGT } from "gt-tanstack-start";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const StreamdownLinkSafety = ({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) => {
  const gt = useGT();
  const [copied, setCopied] = useState(false);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={isOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLinkIcon className="size-5" />
            <T>Open external link?</T>
          </DialogTitle>
          <DialogDescription>
            <T>You're about to visit an external website.</T>
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{url}</div>
        <DialogFooter className="gap-2 sm:justify-stretch">
          <Button
            className="flex-1"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            type="button"
            variant="outline"
          >
            {copied ? gt("Copied") : <T>Copy link</T>}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            type="button"
          >
            <T>Open link</T>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const streamdownLinkSafety: LinkSafetyConfig = {
  enabled: true,
  renderModal: (props) => <StreamdownLinkSafety {...props} />,
};

export const useExternalLinkSafety = () => {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const requestExternalLink = (url: string) => {
    setPendingUrl(url);
  };

  const externalLinkModal =
    pendingUrl === null ? null : (
      <StreamdownLinkSafety
        isOpen
        onClose={() => setPendingUrl(null)}
        onConfirm={() => window.open(pendingUrl, "_blank", "noreferrer")}
        url={pendingUrl}
      />
    );

  return { externalLinkModal, requestExternalLink };
};
