"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type EditorState,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from "lexical";
import { $createParagraphNode } from "lexical";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Type,
  Undo2,
} from "lucide-react";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const EDITOR_THEME = {
  paragraph: "mb-2 last:mb-0",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "rounded bg-muted px-1 py-0.5 font-mono text-sm",
  },
  list: {
    ul: "list-disc list-inside mb-2",
    ol: "list-decimal list-inside mb-2",
    listitem: "ml-2",
  },
  quote: "border-l-4 border-muted-foreground/30 pl-4 my-2 text-muted-foreground italic",
  code: "block rounded bg-muted p-2 font-mono text-sm my-2 overflow-x-auto",
  heading: {
    h1: "text-2xl font-bold mb-2",
    h2: "text-xl font-bold mb-2",
    h3: "text-lg font-semibold mb-2",
  },
};

const initialNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  CodeHighlightNode,
];

function InitialContentPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!html?.trim()) return;
    editor.update(
      () => {
        const root = $getRoot();
        if (root.getFirstChild()) return;
        const parser = new DOMParser();
        const dom = parser.parseFromString(html, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        if (nodes.length > 0) {
          root.clear();
          root.append(...nodes);
        }
      },
      { discrete: true }
    );
  }, [editor, html]);
  return null;
}

function BlurPlugin({ onBlur }: { onBlur?: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);
  useEffect(() => {
    if (!onBlurRef.current) return;
    const root = editor.getRootElement();
    if (!root) return;
    const handleBlur = () => {
      editor.getEditorState().read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        onBlurRef.current?.(html);
      });
    };
    root.addEventListener("blur", handleBlur, true);
    return () => root.removeEventListener("blur", handleBlur, true);
  }, [editor]);
  return null;
}

function GetHtmlRefPlugin({
  getHtmlRef,
}: {
  getHtmlRef?: MutableRefObject<(() => string) | null>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!getHtmlRef) return;
    getHtmlRef.current = () => {
      let out = "";
      editor.getEditorState().read(() => {
        out = $generateHtmlFromNodes(editor, null);
      });
      return out;
    };
    return () => {
      getHtmlRef.current = null;
    };
  }, [editor, getHtmlRef]);
  return null;
}

function ToolbarButtons() {
  const [editor] = useLexicalComposerContext();

  const formatBold = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
  const formatItalic = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
  const formatCode = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");

  const insertUnorderedList = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const list = $createListNode("bullet");
      const item = $createListItemNode();
      item.append($createParagraphNode());
      list.append(item);
      selection.insertNodes([list]);
    });
  };

  const insertOrderedList = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const list = $createListNode("number");
      const item = $createListItemNode();
      item.append($createParagraphNode());
      list.append(item);
      selection.insertNodes([list]);
    });
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const quote = $createQuoteNode();
      quote.append($createParagraphNode());
      selection.insertNodes([quote]);
    });
  };

  const insertHeading = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const heading = $createHeadingNode("h3");
      heading.append($createParagraphNode());
      selection.insertNodes([heading]);
    });
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  };

  const undo = () => editor.dispatchCommand("undo" as never, undefined as never);
  const redo = () => editor.dispatchCommand("redo" as never, undefined as never);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={formatBold}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={formatItalic}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={insertHeading}
        title="Heading"
      >
        <Type className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={insertUnorderedList}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={insertOrderedList}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={formatCode}
        title="Code"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={insertLink}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={insertQuote}
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={undo}
        title="Undo"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={redo}
        title="Redo"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export type GitHubStyleEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
  /** Ref to get current HTML from editor (e.g. before save when dialog closes). */
  getHtmlRef?: MutableRefObject<(() => string) | null>;
  placeholder?: string;
  minHeight?: string;
  editorKey?: string;
  className?: string;
};

export function GitHubStyleEditor({
  value,
  onChange,
  onBlur: onBlurProp,
  getHtmlRef,
  placeholder = "Type your description here...",
  minHeight = "120px",
  editorKey = "default",
  className,
}: GitHubStyleEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const handleChange = useCallback(
    (editorState: EditorState, editor: LexicalEditor) => {
      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        onChange(html);
      });
    },
    [onChange]
  );

  const initialConfig = useCallback(
    () => ({
      namespace: "GitHubStyleEditor",
      theme: EDITOR_THEME,
      nodes: initialNodes,
      onError: (err: Error) => console.error(err),
    }),
    []
  );

  return (
    <LexicalComposer key={editorKey} initialConfig={initialConfig()}>
      <InitialContentPlugin html={value} />
      <BlurPlugin onBlur={onBlurProp} />
      <GetHtmlRefPlugin getHtmlRef={getHtmlRef} />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
      <div
        className={cn(
          "flex flex-col rounded-md border border-[#0969da]/40 bg-background",
          className
        )}
      >
        <div className="flex items-center justify-between gap-1 border-b bg-muted/30 px-2 py-1">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "write" | "preview")}
            className="w-auto"
          >
            <TabsList className="h-8 gap-0 bg-transparent p-0">
              <TabsTrigger
                value="write"
                className="h-7 rounded px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Write
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="h-7 rounded px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {activeTab === "write" && <ToolbarButtons />}
        </div>
        {activeTab === "write" ? (
          <div className="relative" style={{ minHeight }}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="min-h-[80px] w-full resize-none rounded-b-md px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  style={{ minHeight }}
                />
              }
              placeholder={
                <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        ) : (
          <div
            className="min-h-[80px] rounded-b-md px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none"
            style={{ minHeight }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview renders editor-generated HTML from Lexical state
            dangerouslySetInnerHTML={{
              __html: value || "<p class='text-muted-foreground'>Nothing to preview.</p>",
            }}
          />
        )}
      </div>
    </LexicalComposer>
  );
}
