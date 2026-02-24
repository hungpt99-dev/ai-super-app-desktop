/**
 * MarketplaceCard — displays a marketplace listing for an agent or skill.
 */

import type { IAgentMarketplaceListingDTO, ISkillMarketplaceListingDTO } from '@agenthub/contracts'

type ListingDTO = IAgentMarketplaceListingDTO | ISkillMarketplaceListingDTO

interface MarketplaceCardProps {
    listing: ListingDTO
    onViewDetail: (id: string) => void
    onInstall: (id: string) => void
}

export function MarketplaceCard({ listing, onViewDetail, onInstall }: MarketplaceCardProps) {
    const isAgent = listing.type === 'agent'

    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent)]/40 transition-colors">
            <div className="flex items-start gap-3">
                <span className="text-2xl">{listing.icon ?? (isAgent ? '🤖' : '🧩')}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{listing.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
                            v{listing.version}
                        </span>
                        {listing.verified && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/30 text-[var(--color-success)]">
                                Verified
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{listing.description}</p>

                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[var(--color-text-secondary)]">by {listing.author}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{listing.category}</span>
                        <span className="text-xs text-[var(--color-warning)]">★ {listing.rating.toFixed(1)}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{listing.downloadCount.toLocaleString()} downloads</span>
                    </div>

                    {/* Capabilities / Requirements */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {isAgent && (listing as IAgentMarketplaceListingDTO).capabilities.slice(0, 4).map((cap) => (
                            <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-info)]/20 text-[var(--color-info)] font-mono">{cap}</span>
                        ))}
                        {!isAgent && (listing as ISkillMarketplaceListingDTO).requiredCapabilities.slice(0, 4).map((cap) => (
                            <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400 font-mono">{cap}</span>
                        ))}
                        {isAgent && (listing as IAgentMarketplaceListingDTO).capabilities.length > 4 && (
                            <span className="text-[10px] text-[var(--color-text-secondary)]">
                                +{(listing as IAgentMarketplaceListingDTO).capabilities.length - 4} more
                            </span>
                        )}
                    </div>

                    {listing.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {listing.tags.map((tag) => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                <button
                    type="button"
                    onClick={() => onViewDetail(listing.id)}
                    className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg hover:border-[var(--color-accent)]"
                >
                    View Detail
                </button>
                <button
                    type="button"
                    onClick={() => onInstall(listing.id)}
                    className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
                >
                    Install
                </button>
            </div>
        </div>
    )
}
