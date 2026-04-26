import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

type ModelMarkdownProps = {
  content: string
}

// Primary URL safety layer for anchor hrefs fed through react-markdown urlTransform.
// Allows http, https, and mailto. Returns null for relative URLs and all other protocols,
// which causes react-markdown to omit the href attribute from the rendered anchor.
// Image src safety is delegated to the custom img component so it can read the original
// URL for the safe/unsafe display policy without it having been nulled out first.
const markdownUrlTransform = (url: string, key: string): string | null => {
  if (key !== 'href') return url
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) ? trimmed : null
}

// Secondary guard reused in a and img component renderers.
const toSafeHref = (href: string): string | null => {
  const trimmed = href.trim()
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) ? trimmed : null
}

export const ModelMarkdown = ({ content }: ModelMarkdownProps) => {
  return (
    <div className="model-markdown flex flex-col gap-2.5" style={{ overflowWrap: 'anywhere' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={markdownUrlTransform}
        components={{
          h1: ({ children }) => <h1 className="m-0 text-[1.1rem] font-semibold leading-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="m-0 text-[1.02rem] font-semibold leading-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="m-0 text-[0.98rem] font-semibold leading-tight">{children}</h3>,
          h4: ({ children }) => <h4 className="m-0 text-[0.94rem] font-semibold leading-tight">{children}</h4>,
          h5: ({ children }) => <h5 className="m-0 text-[0.9rem] font-semibold leading-tight">{children}</h5>,
          h6: ({ children }) => <h6 className="m-0 text-[0.88rem] font-semibold leading-tight">{children}</h6>,
          p: ({ children }) => <p className="m-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="m-0 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="m-0 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="m-0 border-l-2 border-[#abd0e5] pl-3 text-[#2d617f]">{children}</blockquote>
          ),

          // pre wraps all fenced code blocks (both highlighted and plain).
          // Provides overflow containment; the inner code element handles font and color.
          pre: ({ children }) => (
            <pre className="m-0 overflow-x-auto rounded-md border border-[#d0e5f2] bg-[#f4fafe] p-2.5">
              {children}
            </pre>
          ),

          // code handles fenced code (inside pre) and inline code.
          // rehype-highlight adds "hljs" to className for all fenced code blocks — known languages
          // get highlighted span children, unknown languages get plain-text children but still carry
          // the "hljs" class. Inline code and no-language fences both have empty className; the
          // newline check safely distinguishes them because rehype-highlight never produces span
          // children for those cases (so String(children) is always a plain string there).
          code: ({ className, children }) => {
            const isFenced = typeof className === 'string' && className.includes('hljs')

            if (isFenced) {
              return (
                <code className={`font-mono text-[0.78rem] ${className}`}>
                  {children}
                </code>
              )
            }

            if (String(children).includes('\n')) {
              return (
                <code className="font-mono text-[0.78rem] text-[#1b4f6c]">
                  {children}
                </code>
              )
            }

            return (
              <code className="rounded bg-[#eef6fb] px-1 py-0.5 font-mono text-[0.8rem] text-[#1d4f68]">
                {children}
              </code>
            )
          },

          // a: urlTransform is the primary guard (nulls out unsafe hrefs before this runs).
          // toSafeHref is a secondary check; a null href renders as a non-clickable span.
          a: ({ href, children }) => {
            const safeHref = typeof href === 'string' ? toSafeHref(href) : null
            if (!safeHref) {
              return <span>{children}</span>
            }
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#1d5f83] underline decoration-[#6fa6c4] underline-offset-2"
              >
                {children}
              </a>
            )
          },

          // img: never renders an <img> element. Converts to an anchor (safe URL) or plain text
          // (unsafe URL). urlTransform is not used for src so the original URL is available here
          // for the safe/unsafe display decision.
          //
          // Policy:
          //   safe URL + alt  → <a>Image: {alt}</a>
          //   safe URL no alt → <a>Image</a>
          //   unsafe + alt    → <span>Image: {alt}</span>
          //   unsafe no alt   → null (omitted)
          img: ({ src, alt }) => {
            const safeHref = typeof src === 'string' ? toSafeHref(src) : null
            const label = alt ? `Image: ${alt}` : 'Image'

            if (safeHref) {
              return (
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[#1d5f83] underline decoration-[#6fa6c4] underline-offset-2"
                >
                  {label}
                </a>
              )
            }

            if (alt) {
              return <span>{`Image: ${alt}`}</span>
            }

            return null
          },

          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-[#c6deec] bg-[#f1f9ff] px-2 py-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-[#c6deec] px-2 py-1 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
