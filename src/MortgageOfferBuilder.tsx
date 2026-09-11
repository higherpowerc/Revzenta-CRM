import DealCalculatorModal from "./DealCalculatorModal";
import type { Client } from "./types";

interface Props {
  property?: Client | null;
  opportunities?: Client[];
  onUpdated?: (updated: Client) => void;
  onClose?: () => void;
  crmBusinessName?: string;
}

/**
 * MortgageOfferBuilder delegates directly to Revzenta Deal Underwriter (DealCalculatorModal)
 * in embedded mode, ensuring 100% field, calculation, and workflow parity across the Creative Hub.
 */
export default function MortgageOfferBuilder({
  property,
  opportunities = [],
  onUpdated,
  onClose,
  crmBusinessName,
}: Props) {
  return (
    <DealCalculatorModal
      property={property}
      allProperties={opportunities}
      onUpdated={onUpdated}
      onClose={onClose}
      crmBusinessName={crmBusinessName}
      embedded={true}
    />
  );
}
