import { memo, type JSX } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  readonly content: string;
}

const remarkPlugins = [remarkGfm];

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: MarkdownContentProps): JSX.Element {
  return (
    <Markdown
      remarkPlugins={remarkPlugins}
      skipHtml
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        del: ({ children }) => <del className="text-muted-foreground">{children}</del>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className="text-[0.8125rem]">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-secondary px-1.5 py-0.5 text-[0.8125rem]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-1 overflow-x-auto rounded-md bg-secondary p-3 text-[0.8125rem]">
            {children}
          </pre>
        ),
        ul: ({ children }) => <ul className="my-1 list-disc pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-1 list-decimal pl-6">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-1 border-muted-foreground/40 border-l-2 pl-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <p className="mb-1 font-bold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-bold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold last:mb-0">{children}</p>,
        h4: ({ children }) => <p className="mb-1 font-semibold last:mb-0">{children}</p>,
        h5: ({ children }) => <p className="mb-1 font-medium last:mb-0">{children}</p>,
        h6: ({ children }) => <p className="mb-1 font-medium last:mb-0">{children}</p>,
        hr: () => <hr className="my-2 border-border" />,
      }}
    >
      {content}
    </Markdown>
  );
});
