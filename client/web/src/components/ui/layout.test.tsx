/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'

import { Cluster, Container, Stack } from './layout'

const classesOf = (el: Element) => Array.from(el.classList)

describe('layout primitives (A06 / ADR-0002)', () => {
  describe('Stack', () => {
    it('is a vertical flex column with the default gap', () => {
      render(<Stack data-testid="s">x</Stack>)
      expect(classesOf(screen.getByTestId('s'))).toEqual([
        'flex',
        'flex-col',
        'gap-4',
        'items-stretch',
      ])
    })

    it.each([
      ['0', 'gap-0'],
      ['1', 'gap-1'],
      ['2', 'gap-2'],
      ['3', 'gap-3'],
      ['4', 'gap-4'],
      ['5', 'gap-5'],
      ['6', 'gap-6'],
      ['8', 'gap-8'],
      ['10', 'gap-10'],
      ['12', 'gap-12'],
      ['16', 'gap-16'],
      ['24', 'gap-24'],
    ] as const)('maps gap step %s to %s', (step, cls) => {
      render(<Stack data-testid="s" gap={step} />)
      expect(classesOf(screen.getByTestId('s'))).toContain(cls)
    })

    it('forwards `as` and `className`', () => {
      render(
        <Stack as="section" className="bg-bg-subtle" aria-label="Facts">
          x
        </Stack>,
      )
      const el = screen.getByRole('region', { name: 'Facts' })
      expect(el.tagName).toBe('SECTION')
      expect(classesOf(el)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'bg-bg-subtle']))
    })

    it('lets a caller override alignment', () => {
      render(<Stack data-testid="s" align="center" />)
      const classes = classesOf(screen.getByTestId('s'))
      expect(classes).toContain('items-center')
      expect(classes).not.toContain('items-stretch')
    })
  })

  describe('Cluster', () => {
    it('wraps, centers items, and starts from the leading edge by default', () => {
      render(<Cluster data-testid="c" />)
      expect(classesOf(screen.getByTestId('c'))).toEqual([
        'flex',
        'flex-wrap',
        'gap-3',
        'items-center',
        'justify-start',
      ])
    })

    it('maps gap, align and justify props', () => {
      render(<Cluster data-testid="c" gap="8" align="end" justify="between" />)
      expect(classesOf(screen.getByTestId('c'))).toEqual(
        expect.arrayContaining(['gap-8', 'items-end', 'justify-between']),
      )
    })

    it('renders as a list when asked to', () => {
      render(
        <Cluster as="ul">
          <li>one</li>
        </Cluster>,
      )
      expect(screen.getByRole('list').tagName).toBe('UL')
    })
  })

  describe('Container', () => {
    it('is a centered page column with the default gutter', () => {
      render(<Container data-testid="k" />)
      expect(classesOf(screen.getByTestId('k'))).toEqual([
        'mx-auto',
        'w-full',
        'max-w-6xl',
        'px-4',
      ])
    })

    it.each([
      ['page', 'max-w-6xl'],
      ['prose', 'max-w-prose'],
      ['narrow', 'max-w-narrow'],
    ] as const)('maps width %s to %s', (width, cls) => {
      render(<Container data-testid="k" width={width} />)
      expect(classesOf(screen.getByTestId('k'))).toContain(cls)
    })

    it('maps the gutter step and forwards `as`', () => {
      render(<Container as="main" paddingX="6" />)
      expect(classesOf(screen.getByRole('main'))).toContain('px-6')
    })
  })

  it('never emits a pinned px dimension (ADR-0003)', () => {
    const { container } = render(
      <Container>
        <Stack gap="24">
          <Cluster gap="16">x</Cluster>
        </Stack>
      </Container>,
    )
    expect(container.innerHTML).not.toMatch(/\b(w|h)-\[\d+px\]/)
  })
})
