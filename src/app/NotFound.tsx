import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="card">
      <h2>Page not found</h2>
      <p>
        <Link to="/">Back to videos</Link>
      </p>
    </section>
  )
}
