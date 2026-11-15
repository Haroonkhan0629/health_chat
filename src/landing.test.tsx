import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Landing from './pages/index'

describe('workout landing page', () => {
  it('renders the landing page without exposing the form before auth resolves', () => {
    const html = renderToStaticMarkup(<Landing />)
    expect(html).toContain('body part or muscle groups')
    expect(html).not.toContain('Create my plan')
  })
})
