import { render, screen, within } from '@testing-library/react'
import synthetic from '../../fixtures/synthetic-01.json'
import { fixtureItems, type Fixture } from '../stats/fixture'
import { confirmedOnly } from '../stats'
import { StatsView } from './StatsView'

const items = confirmedOnly(fixtureItems(synthetic as Fixture))

describe('StatsView', () => {
  it('shows every percentage with its sample and marks small samples (STA-2, STA-3)', () => {
    render(<StatsView items={items} />)
    const conversion = screen.getByText('conversion').closest('.kpi') as HTMLElement
    expect(conversion).toHaveTextContent('56% (5/9)')
    expect(within(conversion).getByText('small sample')).toBeInTheDocument()
    expect(screen.getByText(/Fewer than 30 attempts/)).toBeInTheDocument()
  })

  it('shows the headline numbers (STA-5)', () => {
    render(<StatsView items={items} />)
    expect(screen.getByText('possessions').previousSibling).toHaveTextContent('13')
    expect(screen.getByText('shots').previousSibling).toHaveTextContent('10')
    expect(screen.getByText(/median possession/).previousSibling).toHaveTextContent('7.0 s')
    expect(screen.getByText('no-shot possessions').previousSibling).toHaveTextContent('17% (2/12)')
  })

  it('lists shots and the execution note (STA-6, STA-7)', () => {
    render(<StatsView items={items} />)
    const firstShotRow = screen.getByText('Pin · Pull · Pull-side lane').closest('tr') as HTMLElement
    expect(firstShotRow).toHaveTextContent('67% (2/3)')
    expect(firstShotRow).toHaveTextContent('4.7 s')
    expect(screen.getByText(/point to the goalie reading you/)).toBeInTheDocument()
  })

  it('explains an empty selection', () => {
    render(<StatsView items={[]} />)
    expect(screen.getByText(/No confirmed possessions/)).toBeInTheDocument()
  })
})
