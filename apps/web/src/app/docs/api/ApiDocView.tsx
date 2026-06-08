"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders the API reference markdown with GitHub-flavored tables + code blocks. */
export function ApiDocView({ content }: { content: string }) {
  return (
    <article
      className="prose prose-zinc dark:prose-invert max-w-none
        prose-headings:scroll-mt-20
        prose-a:text-emerald-600 dark:prose-a:text-emerald-400
        prose-table:text-sm prose-th:text-left
        prose-code:before:content-none prose-code:after:content-none prose-code:font-normal
        prose-code:rounded prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5
        prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:border prose-pre:border-zinc-800 prose-pre:overflow-x-auto
        [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-zinc-100 [&_pre_code]:text-[13px]"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
