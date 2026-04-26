export const MD_ORDERED_LIST = `\
1. First item
2. Second item
3. Third item`

export const MD_REPEATED_ONE_LIST = `\
1. Alpha
1. Beta
1. Gamma`

export const MD_LOOSE_ORDERED_LIST = `\
1. First loose item

2. Second loose item

3. Third loose item`

export const MD_NESTED_LISTS = `\
- Top level A
  - Nested A1
  - Nested A2
- Top level B
  1. Nested ordered B1
  2. Nested ordered B2`

export const MD_HEADINGS = `\
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`

export const MD_EMPHASIS = `\
**Bold text** and *italic text* and ~~strikethrough text~~ and **bold with _nested italic_**.`

export const MD_DIVIDER = `\
Above the divider.

---

Below the divider.`

export const MD_BLOCKQUOTE = `\
> This is a blockquote.
> It can span multiple lines.
>
>> Nested blockquote.`

export const MD_TABLE = `\
| Column A | Column B | Column C |
|---|---|---|
| Row 1 A | Row 1 B | Row 1 C |
| Row 2 A | Row 2 B | Row 2 C |
| A very long cell value that might cause horizontal overflow in a narrow panel | Short | Medium length |`

export const MD_TASK_LIST = `\
- [x] Completed task
- [ ] Uncompleted task
- [x] Another completed task
- [ ] Another uncompleted task`

export const MD_INLINE_CODE = `\
Use \`const x = 1\` for inline code. Also \`Array.from()\` and \`document.querySelector('div')\`.`

export const MD_RAW_HTML = `\
Before raw HTML.

<script>alert('xss')</script>

<div style="color: red">Raw div content</div>

<strong>Raw strong tag</strong>

After raw HTML.`

export const MD_IMAGE = `\
Safe image with alt: ![A diagram](https://example.com/image.png)

Safe image without alt: ![](https://example.com/no-alt.png)

Unsafe image with alt: ![Suspicious image](javascript:alert(1))

Unsafe image without alt: ![](javascript:void(0))`

export const MD_CODE_TS = `\
\`\`\`ts
const greet = (name: string): string => {
  return \`Hello, \${name}!\`
}
\`\`\``

export const MD_CODE_TSX = `\
\`\`\`tsx
const Button = ({ label }: { label: string }) => {
  return <button type="button">{label}</button>
}
\`\`\``

export const MD_CODE_JS = `\
\`\`\`js
function add(a, b) {
  return a + b
}
\`\`\``

export const MD_CODE_JSON = `\
\`\`\`json
{
  "name": "example",
  "version": "1.0.0",
  "dependencies": {
    "react": "^19.0.0"
  }
}
\`\`\``

export const MD_CODE_BASH = `\
\`\`\`bash
#!/bin/bash
echo "Hello, world!"
ls -la /tmp
\`\`\``

export const MD_CODE_UNKNOWN = `\
\`\`\`unknownlang
some code in an unknown language
should render as plain readable code
\`\`\``

export const MD_CODE_PLAIN = `\
\`\`\`
plain text without language tag
no highlighting expected
\`\`\``

export const MD_ANNOTATION_TARGET = `\
The model returned a structured answer with several key points.

1. First ordered item that can be selected for annotation
2. Second ordered item for offset testing
3. Third ordered item with enough text to select across

Here is a paragraph with **bold text** and *italic text* that can be selected for branching.

| Feature | Status | Notes |
|---|---|---|
| Markdown | Active | Rendering improvements |
| Annotations | Active | Selection and highlight |`
