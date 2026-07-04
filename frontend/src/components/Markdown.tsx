'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-extrabold text-on-surface mt-6 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-on-surface mt-5 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold text-on-surface mt-4 mb-1.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-on-surface-variant mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm text-on-surface-variant leading-relaxed mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-3 last:mb-0 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1.5 mb-3 last:mb-0 text-sm text-on-surface-variant">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-2 text-sm text-on-surface-variant leading-relaxed">
      <span className="text-primary mt-0.5 flex-shrink-0 font-bold select-none">·</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-on-surface">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-on-surface-variant">{children}</em>
  ),
  hr: () => (
    <hr className="border-outline-variant/20 my-4" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 my-3 text-sm text-on-surface-variant italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-on-surface-variant bg-surface-container rounded-xl p-4 overflow-x-auto mb-3">
          {children}
        </code>
      );
    }
    return (
      <code className="text-xs font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="rounded-xl bg-surface-container border border-outline-variant/10 overflow-x-auto mb-3">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm text-on-surface-variant border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-container-high text-on-surface text-xs font-bold uppercase tracking-wider">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left border-b border-outline-variant/20">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-outline-variant/10">{children}</td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
};

interface MarkdownProps {
  children: string;
  className?: string;
}

export default function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
