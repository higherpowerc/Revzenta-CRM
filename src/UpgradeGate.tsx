import React from "react";
import { PackageTier, TIER_LABELS, TIER_SHORT_LABELS, TIER_BADGES } from "./types";

interface UpgradeGateProps {
  featureName: string;
  featureDescription?: string;
  requiredTier: "pro" | "scale";
  currentTier?: PackageTier;
  benefits?: string[];
  onUpgradeClick?: () => void;
}

const TIER_DESCRIPTIONS: Record<"pro" | "scale", { title: string; price: string; subtitle: string; highlights: string[] }> = {
  pro: {
    title: "Pro Dealmaker",
    price: "$199/mo",
    subtitle: "Full Transaction Hub, Offers Repository, and Automated Buy Box matching.",
    highlights: [
      "Complete Transaction Hub & Closing Milestone Pipeline",
      "Offers Repository with PDF generation & E-Sign dispatch",
      "AI Buy Box Matcher & instantaneous buyer ranking",
      "Full RentCast Comps integration & unlimited lookups",
      "Title & Closing Attorney collaboration tracking"
    ]
  },
  scale: {
    title: "Scale & Brokerage",
    price: "$399/mo",
    subtitle: "Multi-seat brokerage engine with granular permission control and dedicated workflows.",
    highlights: [
      "Multi-seat team accounts with granular tab permissions",
      "Acquisition vs. Disposition agent role specialization",
      "Brokerage-wide transaction reporting & leaderboards",
      "Multi-market expansion & priority API bandwidth",
      "Dedicated white-glove onboarding & account manager"
    ]
  }
};

export const UpgradeGate: React.FC<UpgradeGateProps> = ({
  featureName,
  featureDescription,
  requiredTier,
  currentTier = "starter",
  benefits,
  onUpgradeClick
}) => {
  const tierInfo = TIER_DESCRIPTIONS[requiredTier];
  const activeHighlights = benefits || tierInfo.highlights;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 sm:p-10 text-center animate-fadeIn">
      {/* Outer Glowing Card */}
      <div className="relative max-w-2xl w-full rounded-2xl bg-gradient-to-b from-[#18112e] via-[#120b24] to-[#0a0614] border border-[#a855f7]/30 shadow-[0_0_50px_rgba(168,85,247,0.15)] p-8 sm:p-10 overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-[#8b5cf6]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-[#06b6d4]/15 blur-3xl pointer-events-none" />

        {/* Lock / Plan Badge */}
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#a855f7]/15 border border-[#a855f7]/40 text-[#c084fc] text-xs font-semibold uppercase tracking-wider mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#a855f7] animate-pulse" />
          <span>Available on {tierInfo.title}</span>
          <span className="text-gray-400">({tierInfo.price})</span>
        </div>

        {/* Header Title */}
        <h2 className="relative z-10 text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
          Unlock {featureName}
        </h2>

        {/* Description */}
        <p className="relative z-10 text-sm sm:text-base text-gray-300 max-w-xl mx-auto mb-6 leading-relaxed">
          {featureDescription ||
            `Your current tier (${TIER_SHORT_LABELS[currentTier] || currentTier}) focuses on pipeline leads and underwriting. Upgrade to ${tierInfo.title} to unleash this automated workflow.`}
        </p>

        {/* Feature Highlights Box */}
        <div className="relative z-10 text-left bg-black/40 border border-white/10 rounded-xl p-5 mb-8 backdrop-blur-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            What you get with {tierInfo.title}:
          </p>
          <ul className="space-y-2.5 text-sm text-gray-200">
            {activeHighlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[#a855f7] shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Upgrade Action CTA */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              if (onUpgradeClick) {
                onUpgradeClick();
              } else {
                alert(`To upgrade to ${tierInfo.title} (${tierInfo.price}), please contact your Revzenta account administrator or sales at support@revzenta.com.`);
              }
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide text-white bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] hover:from-[#7c3aed] hover:via-[#9333ea] hover:to-[#db2777] shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            Upgrade to {tierInfo.title} ({tierInfo.price})
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeGate;
