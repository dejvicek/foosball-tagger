import { Link, useParams } from 'react-router'

/** Target of GAM-3 until the tagging screen arrives in build step 4. */
export function TaggingPlaceholder() {
  const { id = '' } = useParams()
  return (
    <section className="card">
      <p className="crumbs">
        <Link to={`/videos/${id}`}>← Back to the video</Link>
      </p>
      <h2>Tagging</h2>
      <p className="muted">The tagging screen for this game arrives in build step 4.</p>
    </section>
  )
}
