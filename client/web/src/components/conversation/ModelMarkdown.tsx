import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type ModelMarkdownProps = {
  content: string
}

const toSafeHref = (href: string): string | null => {
  const trimmed = href.trim()

  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed
  }

  return null
}

export const ModelMarkdown = ({ content }: ModelMarkdownProps) => {
  return (
    <div className="model-markdown flex flex-col gap-2.5" style={{ overflowWrap: 'anywhere' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          code: ({ className, children }) => {
            const text = String(children)
            const isBlock = text.includes('\n')
            if (isBlock) {
              return (
                <pre className="m-0 overflow-x-auto rounded-md border border-[#d0e5f2] bg-[#f4fafe] p-2.5">
                  <code className={className ? `font-mono text-[0.78rem] text-[#1b4f6c] ${className}` : 'font-mono text-[0.78rem] text-[#1b4f6c]'}>
                    {children}
                  </code>
                </pre>
              )
            }

            return (
              <code className="rounded bg-[#eef6fb] px-1 py-0.5 font-mono text-[0.8rem] text-[#1d4f68]">
                {children}
              </code>
            )
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
