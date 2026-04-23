import api from '../../../shared/api/axiosInstance';

const DEFAULT_AMENITIES = ['Charging Port', 'WiFi', 'Blanket', 'Water Bottle', 'Live Tracking'];

const createId = (prefix = 'item') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createSeatCell = (deckCode, rowNumber, seatCode, variant = 'seat') => ({
  kind: 'seat',
  id: `${deckCode}${rowNumber}${seatCode}`,
  label: `${rowNumber}${seatCode}`,
  variant,
  status: 'available',
});

const createEmptyCell = () => ({
  kind: 'aisle',
});

const createLowerDeckSeater = (rows = 10, deckCode = 'L') =>
  Array.from({ length: rows }, (_, index) => {
    const rowNumber = index + 1;
    return [
      createSeatCell(deckCode, rowNumber, 'A', 'window'),
      createSeatCell(deckCode, rowNumber, 'B', 'aisle'),
      createEmptyCell(),
      createSeatCell(deckCode, rowNumber, 'C', 'aisle'),
      createSeatCell(deckCode, rowNumber, 'D', 'window'),
    ];
  });

const createSleeperDeck = (rows = 6, deckCode = 'L') =>
  Array.from({ length: rows }, (_, index) => {
    const rowNumber = index + 1;
    return [
      createSeatCell(deckCode, rowNumber, 'LB', 'sleeper'),
      createEmptyCell(),
      createSeatCell(deckCode, rowNumber, 'UB', 'sleeper'),
    ];
  });

const createMixedDeck = () => [
  ...createLowerDeckSeater(5, 'L'),
  [
    createSeatCell('L', 6, 'SL', 'sleeper'),
    createEmptyCell(),
    createSeatCell('L', 6, 'SR', 'sleeper'),
  ],
  [
    createSeatCell('L', 7, 'SL', 'sleeper'),
    createEmptyCell(),
    createSeatCell('L', 7, 'SR', 'sleeper'),
  ],
];

export const BUS_BLUEPRINT_TEMPLATES = [
  {
    key: 'seater_2_2',
    label: 'Seater 2+2',
    category: 'Seater Coach',
    lowerDeck: createLowerDeckSeater(11, 'L'),
    upperDeck: [],
  },
  {
    key: 'sleeper_2_1',
    label: 'Sleeper 2+1',
    category: 'Sleeper Coach',
    lowerDeck: createSleeperDeck(6, 'L'),
    upperDeck: createSleeperDeck(6, 'U'),
  },
  {
    key: 'mixed_redbus',
    label: 'Semi Sleeper Mix',
    category: 'Hybrid Coach',
    lowerDeck: createMixedDeck(),
    upperDeck: createSleeperDeck(4, 'U'),
  },
];

export const createBlueprintFromTemplate = (templateKey = 'seater_2_2') => {
  const template = BUS_BLUEPRINT_TEMPLATES.find((item) => item.key === templateKey) || BUS_BLUEPRINT_TEMPLATES[0];

  return {
    templateKey: template.key,
    lowerDeck: JSON.parse(JSON.stringify(template.lowerDeck)),
    upperDeck: JSON.parse(JSON.stringify(template.upperDeck)),
  };
};

export const countSeatsInDeck = (deckRows = []) =>
  deckRows.flat().filter((cell) => cell?.kind === 'seat').length;

export const countTotalSeats = (blueprint = {}) =>
  countSeatsInDeck(blueprint.lowerDeck || []) + countSeatsInDeck(blueprint.upperDeck || []);

export const createBusDraft = () => ({
  id: createId('bus'),
  operatorName: '',
  busName: '',
  serviceNumber: '',
  coachType: 'AC Sleeper',
  busCategory: 'Sleeper',
  registrationNumber: '',
  busColor: '#1f2937',
  seatPrice: '899',
  fareCurrency: 'INR',
  boardingPolicy: 'Reach 15 minutes before departure.',
  cancellationPolicy: 'Cancellation allowed up to 6 hours before departure.',
  luggagePolicy: 'One cabin bag and one check-in bag per passenger.',
  amenities: [...DEFAULT_AMENITIES],
  blueprint: createBlueprintFromTemplate('sleeper_2_1'),
  route: {
    routeName: '',
    originCity: '',
    destinationCity: '',
    distanceKm: '',
    durationHours: '',
    stops: [
      {
        id: createId('stop'),
        city: '',
        pointName: '',
        stopType: 'pickup',
        arrivalTime: '',
        departureTime: '',
      },
      {
        id: createId('stop'),
        city: '',
        pointName: '',
        stopType: 'drop',
        arrivalTime: '',
        departureTime: '',
      },
    ],
  },
  schedules: [
    {
      id: createId('schedule'),
      label: 'Daily Evening Service',
      departureTime: '21:00',
      arrivalTime: '06:15',
      activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      status: 'active',
    },
  ],
  status: 'draft',
  capacity: countTotalSeats(createBlueprintFromTemplate('sleeper_2_1')),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const normalizeCatalog = (catalog = []) =>
  catalog.map((bus) => {
    const fallbackDraft = createBusDraft();
    const blueprint = bus.blueprint || createBlueprintFromTemplate(bus.blueprint?.templateKey);

    return {
      ...fallbackDraft,
      ...bus,
      blueprint,
      seatPrice:
        bus.seatPrice !== undefined && bus.seatPrice !== null ? String(bus.seatPrice) : fallbackDraft.seatPrice,
      route: {
        ...fallbackDraft.route,
        ...bus.route,
        stops:
          Array.isArray(bus.route?.stops) && bus.route.stops.length > 0
            ? bus.route.stops
            : fallbackDraft.route.stops,
      },
      schedules:
        Array.isArray(bus.schedules) && bus.schedules.length > 0 ? bus.schedules : fallbackDraft.schedules,
      amenities:
        Array.isArray(bus.amenities) && bus.amenities.length > 0 ? bus.amenities : fallbackDraft.amenities,
      capacity: bus.capacity || countTotalSeats(blueprint),
    };
  });

const getResultsArray = (response) => {
  if (Array.isArray(response?.data?.results)) {
    return response.data.results;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};

export const getAdminBuses = async () => {
  const response = await api.get('/admin/bus-services');
  return normalizeCatalog(getResultsArray(response));
};

export const upsertAdminBus = async (payload) => {
  const requestPayload = {
    ...payload,
    capacity: countTotalSeats(payload.blueprint || {}),
  };

  const response = payload.id?.startsWith('bus-')
    ? await api.post('/admin/bus-services', requestPayload)
    : await api.patch(`/admin/bus-services/${payload.id}`, requestPayload);

  return normalizeCatalog([response?.data || response])[0];
};

export const deleteAdminBus = async (busId) => {
  await api.delete(`/admin/bus-services/${busId}`);
  return true;
};
