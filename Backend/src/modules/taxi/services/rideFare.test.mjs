import assert from 'node:assert/strict';
import { computeRideFareFromPricingRule } from './rideFare.js';

// PREMIUM CAB live config: Rs 200 up to 10km, Rs 30/km after, 5% tax.
const premium = { base_price: 200, base_distance: 10, price_per_distance: 30, time_price: 0, service_tax: 5 };
const fare = (m, min = 0) => computeRideFareFromPricingRule({ pricingRule: premium, distanceMeters: m, durationMinutes: min });

assert.equal(fare(8000), 210);           // inside base distance -> base + tax only
assert.equal(fare(15000), 368);          // 200 + 5*30 = 350, +5%
assert.equal(fare(20000), 525);          // 200 + 10*30 = 500, +5%
assert.equal(fare(20000, 45), 525);      // time_price 0 -> duration must not inflate
assert.equal(computeRideFareFromPricingRule({ pricingRule: null, distanceMeters: 20000 }), null);
assert.equal(computeRideFareFromPricingRule({ pricingRule: { base_price: 0 }, distanceMeters: 20000 }), null);

// Guard the meters-vs-km mixup that produced five-figure quotes.
assert.ok(fare(20000) < 1000, 'a 20km city ride must not quote four figures');

console.log('rideFare ok');
