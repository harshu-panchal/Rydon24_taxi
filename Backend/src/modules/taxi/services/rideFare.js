// Mirrors the rider-app quote (SelectVehicle.calculateEstimatedFare) so the server,
// not the client, decides what a ride costs.
export const computeRideFareFromPricingRule = ({ pricingRule, distanceMeters, durationMinutes }) => {
  if (!pricingRule) {
    return null;
  }

  const distanceKm = Math.max(0, Number(distanceMeters || 0) / 1000);
  const basePrice = Math.max(0, Number(pricingRule.base_price || 0));
  const baseDistance = Math.max(0, Number(pricingRule.base_distance || 0));
  const pricePerDistance = Math.max(0, Number(pricingRule.price_per_distance || 0));
  const timePrice = Math.max(0, Number(pricingRule.time_price || 0));
  const serviceTax = Math.max(0, Number(pricingRule.service_tax || 0));

  const subtotal = baseDistance > 0 && distanceKm <= baseDistance
    ? basePrice
    : basePrice
      + (Math.max(0, distanceKm - baseDistance) * pricePerDistance)
      + (Math.max(0, Number(durationMinutes || 0)) * timePrice);

  if (!(subtotal > 0)) {
    return null;
  }

  return Math.round(subtotal + ((subtotal * serviceTax) / 100));
};
