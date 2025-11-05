import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

type MarkdownSize = 'sm' | 'base' | 'lg';

type MarkdownProps = {
  content?: string;
  allowHtml?: boolean;
  className?: string;
  dir?: 'rtl' | 'ltr';
  justify?: boolean;
  size?: MarkdownSize;
};

export default function Markdown({
  content = '',
  allowHtml = false,
  className = '',
  dir = 'rtl',
  justify = false,
  size = 'sm',
}: MarkdownProps) {
  const rehypePlugins = allowHtml ? [rehypeRaw, rehypeSanitize] : [];

  const baseSizeClass =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base';

  const hScale =
    size === 'sm'
      ? { h1: 'text-xl', h2: 'text-lg', h3: 'text-base', h4: 'text-base' }
      : size === 'base'
      ? { h1: 'text-3xl', h2: 'text-2xl', h3: 'text-xl', h4: 'text-lg' }
      : { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl' };

return (
    <div
      dir={dir}
      className={`markdown-body ${baseSizeClass} text-right leading-7 break-words ${className}`}
      style={justify ? { textAlign: 'justify', textJustify: 'inter-word' as any } : undefined}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins as any}
        components={{
          h1: (p) => <h1 className={`mt-6 font-bold ${hScale.h1}`} {...p} />,
          h2: (p) => <h2 className={`mt-6 font-bold ${hScale.h2}`} {...p} />,
          h3: (p) => <h3 className={`mt-5 font-semibold ${hScale.h3}`} {...p} />,
          h4: (p) => <h4 className={`mt-4 font-semibold ${hScale.h4}`} {...p} />,
          p:  (p) => <p className="my-3" {...p} />,
          a:  (p) => <a className="underline decoration-primary hover:opacity-90 break-all" target="_blank" rel="noopener noreferrer" {...p} />,
          ul: (p) => <ul className="my-3 list-disc ps-6 space-y-1.5" {...p} />,
          ol: (p) => <ol className="my-3 list-decimal ps-6 space-y-1.5" {...p} />,
          li: (p) => <li className="[&>ul]:my-1.5 [&>ol]:my-1.5" {...p} />,
          hr: (p) => <hr className="my-5 border-muted" {...p} />,
          blockquote: (p) => (
            <blockquote className="my-3 border-r-4 pr-4 italic text-muted-foreground" {...p} />
          ),
          code: ({ inline, className, children, ...p }) =>
            inline ? (
              <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...p}>
                {children}
              </code>
            ) : (
              <pre className="my-4 overflow-x-auto rounded-md bg-muted p-4 text-[0.9em]">
                <code className={className} {...p}>
                  {children}
                </code>
              </pre>
            ),
          table: (p) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse" {...p} />
            </div>
          ),
          th: (p) => <th className="border-b p-2 text-right font-semibold" {...p} />,
          td: (p) => <td className="border-b p-2 align-top" {...p} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}