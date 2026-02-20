/**
 * MarketplaceDetailPage.tsx — single app detail view with install / uninstall and reviews.
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { marketplaceApi, reviewsApi, type IMiniApp, type IAppReview } from '../lib/api-client.js'
import { useMarketplaceStore } from '../store/marketplace-store.js'

// ── Reviews section ───────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange?: (n: number) => void }): React.JSX.Element {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={`text-lg leading-none transition-colors ${
            n <= value ? 'text-yellow-400' : 'text-[var(--color-border)]'
          } ${onChange ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

interface IReviewsSectionProps {
  appId: string
}

function ReviewsSection({ appId }: IReviewsSectionProps): React.JSX.Element {
  const [reviews, setReviews] = useState<IAppReview[]>([])
  const [loading, setLoading] = useState(true)
  const [myRating, setMyRating] = useState(0)
  const [myBody, setMyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    void loadReviews()
  }, [appId])

  const loadReviews = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await reviewsApi.list(appId)
      setReviews(data)
    } catch {
      // non-blocking
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (myRating === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const updated = await reviewsApi.upsert(appId, myRating, myBody)
      setReviews((prev) => {
        const existing = prev.findIndex((r) => r.user_id === updated.user_id)
        if (existing >= 0) {
          const copy = [...prev]
          copy[existing] = updated
          return copy
        }
        return [updated, ...prev]
      })
      setMyRating(0)
      setMyBody('')
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">Reviews</h2>

      {/* Write a review */}
      <form onSubmit={(e) => void handleSubmit(e)} className="mb-6 space-y-3 border-b border-[var(--color-border)] pb-6">
        <p className="text-xs font-medium text-[var(--color-text-secondary)]">Write a review</p>
        <StarRating value={myRating} onChange={setMyRating} />
        <textarea
          rows={3}
          maxLength={2000}
          placeholder="Share your experience…"
          value={myBody}
          onChange={(e) => setMyBody(e.target.value)}
          className="w-full resize-none rounded-lg border border-[var(--color-border)]
                     bg-[var(--color-surface-2)] px-3 py-2 text-sm
                     text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                     outline-none focus:border-[var(--color-accent)]"
        />
        {submitError && <p className="text-xs text-[var(--color-danger)]">{submitError}</p>}
        <button
          type="submit"
          disabled={submitting || myRating === 0}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white
                     transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </form>

      {/* Review list */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {review.user_name || 'Anonymous'}
                </span>
                <StarRating value={review.rating} />
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
              {review.body && (
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {review.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MarketplaceDetailPage(): React.JSX.Element {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const { install, uninstall } = useMarketplaceStore()

  const [app, setApp] = useState<IMiniApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!appId) return
    setLoading(true)
    marketplaceApi
      .get(appId)
      .then((a: IMiniApp) => setApp(a))
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [appId])

  const handleToggle = async (): Promise<void> => {
    if (!app) return
    setBusy(true)
    try {
      if (app.installed) {
        await uninstall(app.id)
        setApp({ ...app, installed: false })
      } else {
        await install(app.id)
        setApp({ ...app, installed: true })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--color-danger)]">{error ?? 'App not found.'}</p>
        <Link to="/marketplace" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Back to marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          ← Back
        </button>
      </div>

      {/* App header */}
      <div className="mb-6 flex items-start gap-5 rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl
                        bg-[var(--color-surface-2)] text-4xl">
          📦
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{app.name}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            by {app.developer} · v{app.version} ·{' '}
            <span className="capitalize">{app.category}</span>
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span>⭐ {app.rating.toFixed(1)}</span>
            <span>{app.install_count.toLocaleString()} installs</span>
            <span>{app.is_free ? 'Free' : `$${app.price_usd}`}</span>
          </div>
        </div>

        <button
          onClick={() => void handleToggle()}
          disabled={busy}
          className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50
            ${app.installed
              ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
            }`}
        >
          {busy ? '…' : app.installed ? 'Uninstall' : 'Install'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">About</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {app.description}
            </p>
          </div>

          {/* Changelog */}
          {app.changelog && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
                What&apos;s new in v{app.version}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {app.changelog}
              </p>
            </div>
          )}

          {/* Reviews */}
          <ReviewsSection appId={app.id} />
        </div>

        {/* Right column — permissions */}
        <div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
              Permissions
            </h2>
            {app.permissions.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">No special permissions required.</p>
            ) : (
              <ul className="space-y-2">
                {app.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="text-yellow-400">⚠️</span>
                    {perm}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
