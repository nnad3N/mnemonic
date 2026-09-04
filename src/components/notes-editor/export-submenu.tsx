import { T } from "gt-tanstack-start";
import { DownloadIcon } from "lucide-react";
import { useEditorRef } from "platejs/react";
import { useTransition } from "react";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { plateToMarkdown } from "@/lib/plate";

const PAGE_STYLE = "@page { margin: 0 } body { padding: 20mm 16mm }";

const downloadUrl = (url: string, filename: string) => {
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
};

type NoteExportSubmenuProps = {
  title: string;
};

export const NoteExportSubmenu = ({ title }: NoteExportSubmenuProps) => {
  const editor = useEditorRef();
  const [isExporting, startExport] = useTransition();

  const exportMarkdown = () => {
    const markdown = plateToMarkdown(editor);

    downloadUrl(`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`, `${title}.md`);
  };

  // Loaded on demand: the package pulls in `virtual-dom`, which does not resolve under SSR.
  const exportDocx = async () => {
    const { exportEditorToDocx } = await import("@platejs/docx-io");

    await exportEditorToDocx(editor.children, `${title}.docx`);
  };

  const printNote = async () =>
    new Promise<void>((resolve) => {
      const editorNode = editor.api.toDOMNode(editor);

      if (!editorNode) {
        resolve();
        return;
      }

      const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
        .map((node) => node.outerHTML)
        .join("");
      const frame = document.createElement("iframe");

      frame.setAttribute("aria-hidden", "true");
      frame.className = "pointer-events-none fixed inset-0 size-full opacity-0";
      // Styles go through `srcdoc` so that `load` waits for the stylesheets the note needs; a
      // zero page margin drops the browser's own header and footer, which live in that margin.
      frame.srcdoc = `<!doctype html><html><head>${styles}<style>${PAGE_STYLE}</style></head><body class="typeset"></body></html>`;
      frame.onload = () => {
        const printDocument = frame.contentDocument;
        const printWindow = frame.contentWindow;

        if (!printDocument || !printWindow) {
          frame.remove();
          resolve();
          return;
        }

        printDocument.body.append(printDocument.importNode(editorNode, true));

        // Chrome names the file after the top document, not the frame it prints.
        const previousTitle = document.title;

        document.title = title;
        printWindow.addEventListener("afterprint", () => {
          document.title = previousTitle;
          frame.remove();
          resolve();
        });
        printWindow.focus();
        printWindow.print();
      };

      document.body.append(frame);
    });

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <DownloadIcon />
        <T>Export</T>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-auto">
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => {
            startExport(exportMarkdown);
          }}
        >
          <T>Markdown</T>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => {
            startExport(exportDocx);
          }}
        >
          <T>Word</T>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => {
            startExport(printNote);
          }}
        >
          <T>PDF</T>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
