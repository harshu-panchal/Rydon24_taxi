import React, { useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CopyPlus,
  MapPin,
  Plus,
  Route,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BUS_BLUEPRINT_TEMPLATES,
  countTotalSeats,
  createBlueprintFromTemplate,
  createBusDraft,
  deleteAdminBus,
  getAdminBuses,
  upsertAdminBus,
} from '../../services/busService';

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AMENITY_OPTIONS = [
  'Charging Port',
  'Reading Light',
  'Live Tracking',
  'Blanket',
  'Water Bottle',
  'WiFi',
  'CCTV',
  'Emergency Exit',
];

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-400/5';

const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400';

const statusTone = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  paused: 'bg-slate-100 text-slate-600 border-slate-200',
};

const blankStop = () => ({
  id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  city: '',
  pointName: '',
  stopType: 'pickup',
  arrivalTime: '',
  departureTime: '',
});

const blankSchedule = () => ({
  id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  departureTime: '',
  arrivalTime: '',
  activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  status: 'active',
});

const SeatCell = ({ cell, onToggle }) => {
  if (!cell || cell.kind !== 'seat') {
    return <div className="h-10 rounded-xl bg-slate-100/80" />;
  }

  const isBlocked = cell.status === 'blocked';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex h-10 items-center justify-center rounded-xl border text-[10px] font-black tracking-wider transition ${
        isBlocked
          ? 'border-rose-200 bg-rose-50 text-rose-500'
          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
      }`}
      title={isBlocked ? 'Seat blocked for sale' : 'Seat available for sale'}
    >
      <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-slate-200" />
      <span>{cell.label}</span>
    </button>
  );
};

const SeatDeckPreview = ({ title, deckRows, onToggleSeat }) => {
  if (!deckRows?.length) return null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          <p className="text-[10px] font-medium text-slate-500">Click any seat to block or reopen it.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Coach View
        </div>
      </div>

      <div className="space-y-3">
        {deckRows.map((row, rowIndex) => (
          <div key={`${title}-${rowIndex}`} className="grid grid-cols-5 gap-2">
            {row.map((cell, cellIndex) => (
              <SeatCell
                key={`${title}-${rowIndex}-${cellIndex}-${cell?.id || 'aisle'}`}
                cell={cell}
                onToggle={() => cell?.kind === 'seat' && onToggleSeat(cell.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const BusServiceManager = () => {
  const [catalog, setCatalog] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [draft, setDraft] = useState(() => createBusDraft());
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const buses = await getAdminBuses();
        if (!active) return;

        setCatalog(buses);
        if (buses[0]) {
          setSelectedBusId((current) => current || buses[0].id);
          setDraft((current) =>
            current.id === buses[0].id ? current : JSON.parse(JSON.stringify(buses[0])),
          );
        } else {
          const nextDraft = createBusDraft();
          setSelectedBusId(nextDraft.id);
          setDraft(nextDraft);
        }
      } catch (error) {
        if (!active) return;
        toast.error(error?.message || 'Failed to load bus services');
      } finally {
        if (active) {
          setIsLoadingCatalog(false);
        }
      }
    };

    loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const selectedBus = catalog.find((item) => item.id === selectedBusId);
    if (selectedBus) {
      setDraft(JSON.parse(JSON.stringify(selectedBus)));
    }
  }, [catalog, selectedBusId]);

  const totalSeats = useMemo(() => countTotalSeats(draft.blueprint), [draft.blueprint]);
  const totalStops = draft.route?.stops?.length || 0;
  const totalSchedules = draft.schedules?.length || 0;

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateRouteField = (field, value) => {
    setDraft((current) => ({
      ...current,
      route: {
        ...current.route,
        [field]: value,
      },
    }));
  };

  const toggleAmenity = (amenity) => {
    setDraft((current) => {
      const nextAmenities = current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity];

      return { ...current, amenities: nextAmenities };
    });
  };

  const switchBlueprintTemplate = (templateKey) => {
    setDraft((current) => ({
      ...current,
      blueprint: createBlueprintFromTemplate(templateKey),
    }));
  };

  const toggleSeatStatus = (seatId) => {
    const nextBlueprint = JSON.parse(JSON.stringify(draft.blueprint));

    ['lowerDeck', 'upperDeck'].forEach((deckKey) => {
      nextBlueprint[deckKey] = nextBlueprint[deckKey].map((row) =>
        row.map((cell) => {
          if (cell?.kind === 'seat' && cell.id === seatId) {
            return {
              ...cell,
              status: cell.status === 'blocked' ? 'available' : 'blocked',
            };
          }
          return cell;
        }),
      );
    });

    setDraft((current) => ({ ...current, blueprint: nextBlueprint }));
  };

  const updateStop = (stopId, field, value) => {
    setDraft((current) => ({
      ...current,
      route: {
        ...current.route,
        stops: current.route.stops.map((stop) => (stop.id === stopId ? { ...stop, [field]: value } : stop)),
      },
    }));
  };

  const addStop = () => {
    setDraft((current) => ({
      ...current,
      route: {
        ...current.route,
        stops: [...current.route.stops, blankStop()],
      },
    }));
  };

  const removeStop = (stopId) => {
    setDraft((current) => ({
      ...current,
      route: {
        ...current.route,
        stops: current.route.stops.filter((stop) => stop.id !== stopId),
      },
    }));
  };

  const updateSchedule = (scheduleId, field, value) => {
    setDraft((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, [field]: value } : schedule,
      ),
    }));
  };

  const toggleScheduleDay = (scheduleId, day) => {
    setDraft((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => {
        if (schedule.id !== scheduleId) return schedule;
        const activeDays = schedule.activeDays.includes(day)
          ? schedule.activeDays.filter((item) => item !== day)
          : [...schedule.activeDays, day];
        return { ...schedule, activeDays };
      }),
    }));
  };

  const addSchedule = () => {
    setDraft((current) => ({
      ...current,
      schedules: [...current.schedules, blankSchedule()],
    }));
  };

  const removeSchedule = (scheduleId) => {
    setDraft((current) => ({
      ...current,
      schedules: current.schedules.filter((schedule) => schedule.id !== scheduleId),
    }));
  };

  const handleCreateNew = () => {
    const nextDraft = createBusDraft();
    setDraft(nextDraft);
    setSelectedBusId(nextDraft.id);
  };

  const handleDuplicate = () => {
    const copy = {
      ...JSON.parse(JSON.stringify(draft)),
      id: `bus-copy-${Date.now()}`,
      busName: `${draft.busName || 'New Bus'} Copy`,
      serviceNumber: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDraft(copy);
    setSelectedBusId(copy.id);
    toast.success('Bus duplicated as a new draft');
  };

  const handleSave = async () => {
    if (!draft.operatorName.trim() || !draft.busName.trim() || !draft.route.originCity.trim() || !draft.route.destinationCity.trim()) {
      toast.error('Add operator, bus name, origin and destination first.');
      return;
    }

    setIsSaving(true);
    try {
      const nextBus = await upsertAdminBus({
        ...draft,
        status: draft.status || 'draft',
        capacity: totalSeats,
      });

      setCatalog((current) => {
        const existingIndex = current.findIndex((item) => item.id === nextBus.id);

        if (existingIndex >= 0) {
          const nextCatalog = [...current];
          nextCatalog[existingIndex] = nextBus;
          return nextCatalog;
        }

        return [nextBus, ...current];
      });
      setSelectedBusId(nextBus.id);
      setDraft(nextBus);
      toast.success('Bus service saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save bus service');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!catalog.some((item) => item.id === draft.id)) {
      const nextDraft = createBusDraft();
      setSelectedBusId(nextDraft.id);
      setDraft(nextDraft);
      toast.success('Unsaved draft cleared');
      return;
    }

    setIsSaving(true);
    try {
      await deleteAdminBus(draft.id);
      const nextCatalog = catalog.filter((bus) => bus.id !== draft.id);
      setCatalog(nextCatalog);
      const fallback = nextCatalog[0] || createBusDraft();
      setSelectedBusId(fallback.id);
      setDraft(fallback);
      toast.success('Bus service removed');
    } catch (error) {
      toast.error(error?.message || 'Failed to remove bus service');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-900 p-8 text-white shadow-xl shadow-slate-200">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              <Bus size={14} />
              Bus Service Control
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Bus Fleet & Schedules</h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Define coaches, preview seat blueprints, manage inventory, and publish recurring departures with multi-stop routes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:-translate-y-0.5"
            >
              <Plus size={16} />
              New Bus
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              <CopyPlus size={16} />
              Duplicate
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Capacity</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold">{totalSeats}</p>
              <Armchair className="text-slate-500" size={24} />
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stops Configured</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold">{totalStops}</p>
              <Route className="text-slate-500" size={24} />
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedules</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold">{totalSchedules}</p>
              <CalendarDays className="text-slate-500" size={24} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Bus Catalog</h2>
                <p className="text-xs font-medium text-slate-500">Choose a coach to edit or publish.</p>
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {catalog.length} Active
              </div>
            </div>

            <div className="space-y-3">
              {isLoadingCatalog && (
                <div className="rounded-2xl border border-dashed border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                  Loading catalog...
                </div>
              )}

              {!isLoadingCatalog && catalog.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                  No buses found.
                </div>
              )}

              {catalog.map((bus) => (
                <button
                  key={bus.id}
                  type="button"
                  onClick={() => setSelectedBusId(bus.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedBusId === bus.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${selectedBusId === bus.id ? 'text-slate-400' : 'text-slate-400'}`}>
                        {bus.operatorName}
                      </p>
                      <h3 className={`mt-1 text-sm font-bold truncate ${selectedBusId === bus.id ? 'text-white' : 'text-slate-900'}`}>
                        {bus.busName}
                      </h3>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      selectedBusId === bus.id 
                        ? 'border-white/20 bg-white/10 text-white' 
                        : statusTone[bus.status] || statusTone.draft
                    }`}>
                      {bus.status}
                    </span>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className={`rounded-xl px-2 py-2 ${selectedBusId === bus.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${selectedBusId === bus.id ? 'text-slate-400' : 'text-slate-400'}`}>Seats</p>
                      <p className="mt-0.5 text-xs font-bold">{countTotalSeats(bus.blueprint)}</p>
                    </div>
                    <div className={`rounded-xl px-2 py-2 ${selectedBusId === bus.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${selectedBusId === bus.id ? 'text-slate-400' : 'text-slate-400'}`}>Stops</p>
                      <p className="mt-0.5 text-xs font-bold">{bus.route.stops.length}</p>
                    </div>
                    <div className={`rounded-xl px-2 py-2 ${selectedBusId === bus.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${selectedBusId === bus.id ? 'text-slate-400' : 'text-slate-400'}`}>Fare</p>
                      <p className="mt-0.5 text-xs font-bold">₹{bus.seatPrice}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Module Overview</h3>
            <div className="mt-4 space-y-4 text-xs font-medium text-slate-500">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                <p>Define vehicle specifications and policies.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                <p>Configure and preview seat blueprints.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                <p>Manage routes, stops and recurring schedules.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Bus Specification</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Define vehicle details, operator info and policies.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {['draft', 'active', 'paused'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateDraft('status', status)}
                    className={`rounded-full border px-4 py-2 text-[9px] font-bold uppercase tracking-wider transition-all ${
                      draft.status === status ? statusTone[status] : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Operator Name</label>
                <input className={fieldClassName} value={draft.operatorName} onChange={(event) => updateDraft('operatorName', event.target.value)} placeholder="Intercity Operator" />
              </div>
              <div>
                <label className={labelClassName}>Bus Name</label>
                <input className={fieldClassName} value={draft.busName} onChange={(event) => updateDraft('busName', event.target.value)} placeholder="Sleeper Express" />
              </div>
              <div>
                <label className={labelClassName}>Service Number</label>
                <input className={fieldClassName} value={draft.serviceNumber} onChange={(event) => updateDraft('serviceNumber', event.target.value)} placeholder="RYD-2401" />
              </div>
              <div>
                <label className={labelClassName}>Registration Number</label>
                <input className={fieldClassName} value={draft.registrationNumber} onChange={(event) => updateDraft('registrationNumber', event.target.value)} placeholder="MP09-AB-2401" />
              </div>
              <div>
                <label className={labelClassName}>Coach Type</label>
                <select className={fieldClassName} value={draft.coachType} onChange={(event) => updateDraft('coachType', event.target.value)}>
                  {['AC Sleeper', 'Non AC Sleeper', 'AC Seater', 'Volvo Multi Axle', 'Semi Sleeper'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Category</label>
                <select className={fieldClassName} value={draft.busCategory} onChange={(event) => updateDraft('busCategory', event.target.value)}>
                  {['Sleeper', 'Seater', 'Semi Sleeper', 'Electric Coach'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Seat Price</label>
                <input className={fieldClassName} value={draft.seatPrice} onChange={(event) => updateDraft('seatPrice', event.target.value)} placeholder="1199" />
              </div>
              <div>
                <label className={labelClassName}>Currency</label>
                <input className={fieldClassName} value={draft.fareCurrency} onChange={(event) => updateDraft('fareCurrency', event.target.value)} placeholder="INR" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClassName}>Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((amenity) => {
                    const active = draft.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelClassName}>Boarding Policy</label>
                <textarea className={`${fieldClassName} min-h-[92px]`} value={draft.boardingPolicy} onChange={(event) => updateDraft('boardingPolicy', event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Cancellation Policy</label>
                <textarea className={`${fieldClassName} min-h-[92px]`} value={draft.cancellationPolicy} onChange={(event) => updateDraft('cancellationPolicy', event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Luggage Policy</label>
                <textarea className={`${fieldClassName} min-h-[92px]`} value={draft.luggagePolicy} onChange={(event) => updateDraft('luggagePolicy', event.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Seat Blueprint</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Pick a layout and block seats for inventory control.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
                {totalSeats} Seats
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-3">
            {BUS_BLUEPRINT_TEMPLATES.map((template) => {
              const active = draft.blueprint.templateKey === template.key;
              return (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => switchBlueprintTemplate(template.key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                  }`}
                >
                  <p className="text-sm font-bold">{template.label}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-slate-400' : 'text-slate-400'}`}>
                    {template.category}
                  </p>
                </button>
              );
            })}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SeatDeckPreview title="Lower Deck" deckRows={draft.blueprint.lowerDeck} onToggleSeat={toggleSeatStatus} />
              <SeatDeckPreview title="Upper Deck" deckRows={draft.blueprint.upperDeck} onToggleSeat={toggleSeatStatus} />
            </div>

            <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-slate-200 bg-white" />
                Available seat
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-rose-200 bg-rose-50" />
                Blocked seat
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Route Assignment</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Manage stops, distance and route timings.</p>
              </div>
              <button
                type="button"
                onClick={addStop}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95"
              >
                <Plus size={16} />
                Add Stop
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Route Name</label>
                <input className={fieldClassName} value={draft.route.routeName} onChange={(event) => updateRouteField('routeName', event.target.value)} placeholder="Indore to Bhopal Night Corridor" />
              </div>
              <div>
                <label className={labelClassName}>Distance / Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  <input className={fieldClassName} value={draft.route.distanceKm} onChange={(event) => updateRouteField('distanceKm', event.target.value)} placeholder="195 km" />
                  <input className={fieldClassName} value={draft.route.durationHours} onChange={(event) => updateRouteField('durationHours', event.target.value)} placeholder="4h 45m" />
                </div>
              </div>
              <div>
                <label className={labelClassName}>Origin City</label>
                <input className={fieldClassName} value={draft.route.originCity} onChange={(event) => updateRouteField('originCity', event.target.value)} placeholder="Indore" />
              </div>
              <div>
                <label className={labelClassName}>Destination City</label>
                <input className={fieldClassName} value={draft.route.destinationCity} onChange={(event) => updateRouteField('destinationCity', event.target.value)} placeholder="Bhopal" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {draft.route.stops.map((stop, index) => (
                <div key={stop.id} className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Stop {index + 1}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pickup / drop configuration</p>
                      </div>
                    </div>
                    {draft.route.stops.length > 2 && (
                      <button type="button" onClick={() => removeStop(stop.id)} className="rounded-2xl border border-rose-200 bg-white p-2 text-rose-500 transition hover:bg-rose-50">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <input className={fieldClassName} value={stop.city} onChange={(event) => updateStop(stop.id, 'city', event.target.value)} placeholder="City" />
                    <input className={fieldClassName} value={stop.pointName} onChange={(event) => updateStop(stop.id, 'pointName', event.target.value)} placeholder="Pickup / Drop Point" />
                    <select className={fieldClassName} value={stop.stopType} onChange={(event) => updateStop(stop.id, 'stopType', event.target.value)}>
                      <option value="pickup">Pickup Only</option>
                      <option value="drop">Drop Only</option>
                      <option value="both">Pickup + Drop</option>
                    </select>
                    <input className={fieldClassName} type="time" value={stop.arrivalTime} onChange={(event) => updateStop(stop.id, 'arrivalTime', event.target.value)} />
                    <input className={fieldClassName} type="time" value={stop.departureTime} onChange={(event) => updateStop(stop.id, 'departureTime', event.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Departure Schedules</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Manage recurring service slots and availability.</p>
              </div>
              <button
                type="button"
                onClick={addSchedule}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95"
              >
                <Plus size={16} />
                Add Schedule
              </button>
            </div>

            <div className="space-y-4">
              {draft.schedules.map((schedule, index) => (
                <div key={schedule.id} className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                        <Clock3 size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Schedule {index + 1}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recurring service slot</p>
                      </div>
                    </div>
                    {draft.schedules.length > 1 && (
                      <button type="button" onClick={() => removeSchedule(schedule.id)} className="rounded-2xl border border-rose-200 bg-white p-2 text-rose-500 transition hover:bg-rose-50">
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <input className={fieldClassName} value={schedule.label} onChange={(event) => updateSchedule(schedule.id, 'label', event.target.value)} placeholder="Daily Evening Service" />
                    <input className={fieldClassName} type="time" value={schedule.departureTime} onChange={(event) => updateSchedule(schedule.id, 'departureTime', event.target.value)} />
                    <input className={fieldClassName} type="time" value={schedule.arrivalTime} onChange={(event) => updateSchedule(schedule.id, 'arrivalTime', event.target.value)} />
                    <select className={fieldClassName} value={schedule.status} onChange={(event) => updateSchedule(schedule.id, 'status', event.target.value)}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const active = schedule.activeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleScheduleDay(schedule.id, day)}
                          className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                              : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="sticky bottom-0 z-20 rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Route Snapshot</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {draft.route.originCity || 'Origin'} to {draft.route.destinationCity || 'Destination'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Inventory</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{totalSeats} seats | {draft.schedules.length} schedules</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-95 border border-slate-100"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Bus Service'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default BusServiceManager;
