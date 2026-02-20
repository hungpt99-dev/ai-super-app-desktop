/**
 * SubscriptionPage.tsx — current plan info, feature comparison, and upgrade CTA.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'

interface IPlanFeature {
  label: string
  free: string | boolean
  pro: string | boolean
  enterprise: string | boolean
}

const PLAN_FEATURES: IPlanFeature[] = [
  { label: 'API requests / min',    free: '60',       pro: '600',       enterprise: '6,000' },
  { label: 'Workspaces',            free: '5',        pro: 'Unlimited',  enterprise: 'Unlimited' },
  { label: 'Bots',                  free: '2',        pro: 'Unlimited',  enterprise: 'Unlimited' },
  { label: 'Devices',               free: '1',        pro: '5',          enterprise: 'Unlimited' },
  { label: 'BYOK (provider keys)',  free: true,       pro: true,         enterprise: true },
  { label: 'Marketplace apps',      free: 'Free only', pro: 'All',       enterprise: 'All + early access' },
  { label: 'Bot run history',       free: '7 days',   pro: '90 days',   enterprise: '1 year' },
  { label: 'Priority support',      free: false,      pro: true,         enterprise: true },
  { label: 'SLA',                   free: false,      pro: false,        enterprise: '99.9%' },
]

type PlanName = 'free' | 'pro' | 'enterprise'

const PLAN_PRICES: Record<PlanName, string> = {
  free: '$0',
  pro: '$19',
  enterprise: 'Custom',
}

const PLAN_DESCRIPTIONS: Record<PlanName, string> = {
  free: 'Get started for free',
  pro: 'For power users',
  enterprise: 'For teams & orgs',
}

function FeatureValue({ value }: { value: string | boolean }): React.JSX.Element {
  if (value === true) {
    return <span className="font-semibold text-green-400">✓</span>
  }
  if (value === false) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }
  return <span className="text-sm text-[var(--color-text-primary)]">{value}</span>
}

export function SubscriptionPage(): React.JSX.Element {
  const { user } = useAuthStore()
  const currentPlan = (user?.plan ?? 'free') as PlanName

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Subscription</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Your current plan and available upgrades.
        </p>
      </div>

      {/* Current plan banner */}
      <div className="mb-8 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold capitalize text-[var(--color-text-primary)]">
              {currentPlan}
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {PLAN_DESCRIPTIONS[currentPlan]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[var(--color-accent)]">
              {PLAN_PRICES[currentPlan]}
            </p>
            {currentPlan !== 'enterprise' && (
              <p className="text-xs text-[var(--color-text-muted)]">/ month</p>
            )}
          </div>
        </div>
      </div>

      {/* Plan comparison table */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="grid grid-cols-4 border-b border-[var(--color-border)]">
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Feature
          </div>
          {(['free', 'pro', 'enterprise'] as PlanName[]).map((plan) => (
            <div
              key={plan}
              className={`px-5 py-3 text-center ${
                plan === currentPlan
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <p className="text-xs font-semibold tracking-wider uppercase capitalize">{plan}</p>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {PLAN_PRICES[plan]}
                {plan !== 'enterprise' && <span className="text-xs font-normal text-[var(--color-text-muted)]">/mo</span>}
              </p>
              {plan === currentPlan && (
                <span className="mt-1 inline-block rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-medium text-white">
                  Current
                </span>
              )}
            </div>
          ))}
        </div>

        {PLAN_FEATURES.map((feature, i) => (
          <div
            key={feature.label}
            className={`grid grid-cols-4 ${
              i % 2 === 0 ? '' : 'bg-[var(--color-surface-2)]/40'
            }`}
          >
            <div className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
              {feature.label}
            </div>
            <div className="px-5 py-3 text-center">
              <FeatureValue value={feature.free} />
            </div>
            <div className="px-5 py-3 text-center">
              <FeatureValue value={feature.pro} />
            </div>
            <div className="px-5 py-3 text-center">
              <FeatureValue value={feature.enterprise} />
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade CTAs */}
      {currentPlan === 'free' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-5">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Upgrade to Pro</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Unlock unlimited workspaces, bots, and 600 req/min.
            </p>
            <a
              href="https://app.aisuperapp.dev/billing/upgrade?plan=pro"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm
                         font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Upgrade to Pro — $19/mo
            </a>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Enterprise</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Custom limits, SLA, dedicated support for your team.
            </p>
            <a
              href="mailto:enterprise@aisuperapp.dev"
              className="mt-4 inline-block rounded-lg border border-[var(--color-border)] px-5 py-2.5
                         text-sm text-[var(--color-text-secondary)] transition-colors
                         hover:bg-[var(--color-surface-2)]"
            >
              Contact sales →
            </a>
          </div>
        </div>
      )}

      {currentPlan === 'pro' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Need more?</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Contact us about Enterprise for custom limits, SLA, and team management.
          </p>
          <a
            href="mailto:enterprise@aisuperapp.dev"
            className="mt-4 inline-block rounded-lg border border-[var(--color-border)] px-5 py-2.5
                       text-sm text-[var(--color-text-secondary)] transition-colors
                       hover:bg-[var(--color-surface-2)]"
          >
            Contact sales →
          </a>
        </div>
      )}

      {/* Billing history note */}
      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          Billing &amp; invoices
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Payments are processed securely via Stripe. To manage payment methods or download invoices,
          visit the{' '}
          <a
            href="https://billing.stripe.com/p/login"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Stripe billing portal
          </a>.
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link to="/settings" className="text-xs text-[var(--color-text-muted)] hover:underline">
          ← Back to Settings
        </Link>
      </div>
    </div>
  )
}
