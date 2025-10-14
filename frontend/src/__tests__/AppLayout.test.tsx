import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from '../ui/AppLayout'

it('renders sidebar and header', () => {
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>
  )
  expect(screen.getByText(/App Palafeltre/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Apri menu/i })).toBeInTheDocument()
})
