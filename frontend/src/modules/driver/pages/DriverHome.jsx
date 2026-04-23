import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, 
    Navigation, 
    Wallet, 
    Clock, 
    Bike, 
    Power, 
    Target, 
    Layers, 
    Zap,
    IndianRupee, 
    TrendingUp, 
    Star, 
    ChevronRight,
    MapPin,
    User,
    Menu,
    Search,
    Shield,
    Mail,
    BarChart2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import LowBalanceModal from './LowBalanceModal';


import MapGrid from '@/assets/premium_grid_map.png';
import DriverBottomNav from '../../shared/components/DriverBottomNav';
import IncomingRideRequest from './IncomingRideRequest';
import api from '../../../shared/api/axiosInstance';
import { useSettings } from '../../../shared/context/SettingsContext';

// Vehicle Icons for Map
import BikeIcon from '@/assets/icons/bike.png';
import CarIcon from '@/assets/icons/car.png';
import AutoIcon from '@/assets/icons/auto.png';
import TruckIcon from '@/assets/icons/truck.png';
import EhcvIcon from '@/assets/icons/ehcv.png';
import HcvIcon from '@/assets/icons/hcv.png';
import LcvIcon from '@/assets/icons/LCV.png';
import McvIcon from '@/assets/icons/mcv.png';
import LuxuryIcon from '@/assets/icons/Luxury.png';
import PremiumIcon from '@/assets/icons/Premium.png';
import SuvIcon from '@/assets/icons/SUV.png';

import { socketService } from '../../../shared/api/socket';
import { HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../admin/utils/googleMaps';
import { getCurrentDriver, getLocalDriverToken } from '../services/registrationService';
import {
    playRideRequestAlertSound,
    stopRideRequestAlertSound,
    unlockRideRequestAlertSound,
} from '../utils/rideRequestAlertSound';

const Motion = motion;

const containerStyle = {
    width: '100%',
    height: '100%'
};

const DEFAULT_MAP_CENTER = {
    lat: 22.7196,
    lng: 75.8577 
};

const DEFAULT_MAP_COORDS = [75.8577, 22.7196];

const getGeoLocationErrorMessage = (error, { purpose = 'generic' } = {}) => {
    const code = Number(error?.code);

    if (code === 1) {
        return purpose === 'online'
            ? 'Please allow location permission to go online.'
            : 'Live location updates are paused. Please allow location permission.';
    }

    if (code === 2) {
        return 'Could not detect your current location.';
    }

    if (code === 3) {
        return purpose === 'online'
            ? 'Timed out while fetching your location. Please try again.'
            : 'Live location refresh timed out.';
    }

    return purpose === 'online'
        ? 'Could not fetch your location to go online.'
        : 'Could not update live location.';
};

const getCurrentCoords = ({ purpose = 'generic' } = {}) => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
        reject(new Error('Location is not available on this device.'));
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        (error) => reject(new Error(getGeoLocationErrorMessage(error, { purpose }))),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 },
    );
});

const toLatLng = (coordinates) => {
    const [lng, lat] = coordinates || [];

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return DEFAULT_MAP_CENTER;
    }

    return { lat: Number(lat), lng: Number(lng) };
};

const getMapIconForVehicle = (iconType = '') => {
    const raw = String(iconType || '').trim();
    if (/^(https?:|data:image\/|blob:|\/uploads\/|\/images\/|\/[^/])/.test(raw)) {
        return raw;
    }

    const value = raw.toLowerCase();

    if (value.includes('bike')) return BikeIcon;
    if (value.includes('auto')) return AutoIcon;
    if (value.includes('ehc')) return EhcvIcon;
    if (value.includes('hcv')) return HcvIcon;
    if (value.includes('lcv')) return LcvIcon;
    if (value.includes('mcv')) return McvIcon;
    if (value.includes('truck')) return TruckIcon;
    if (value.includes('lux')) return LuxuryIcon;
    if (value.includes('premium')) return PremiumIcon;
    if (value.includes('suv')) return SuvIcon;

    return CarIcon;
};

const formatPoint = (point, fallback) => {
    const [lng, lat] = point?.coordinates || [];

    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
    }

    return fallback;
};

const normalizeJobType = (job = {}) => {
    const value = String(job.type || job.serviceType || 'ride').toLowerCase();
    if (value === 'parcel') return 'parcel';
    if (value === 'intercity') return 'intercity';
    return 'ride';
};

const getJobTitle = (type) => {
    if (type === 'parcel') return 'Delivery';
    if (type === 'intercity') return 'Intercity Ride';
    return 'Taxi Ride';
};

const formatTripDistance = (job = {}) => {
    const estimatedMeters = Number(job.estimatedDistanceMeters || job.raw?.estimatedDistanceMeters || 0);

    if (Number.isFinite(estimatedMeters) && estimatedMeters > 0) {
        return estimatedMeters < 1000
            ? `${Math.max(50, Math.round(estimatedMeters / 10) * 10)} m`
            : `${(estimatedMeters / 1000).toFixed(estimatedMeters >= 10000 ? 0 : 1)} km`;
    }

    if (job.intercity?.distance) {
        return `${job.intercity.distance} km`;
    }

    if (job.raw?.intercity?.distance) {
        return `${job.raw.intercity.distance} km`;
    }

    if (job.radius) {
        return `within ${(Number(job.radius) / 1000).toFixed(1)} km`;
    }

    if (job.raw?.radius) {
        return `within ${(Number(job.raw.radius) / 1000).toFixed(1)} km`;
    }

    return 'nearby';
};

const unwrapApiPayload = (response) => response?.data?.data || response?.data || response;
const withDriverAuthorization = (token) => (
    token
        ? {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
        : {}
);

const readStoredDriverInfo = () => {
    try {
        return JSON.parse(localStorage.getItem('driverInfo') || '{}');
    } catch {
        return {};
    }
};

const persistStoredDriverInfo = (updates = {}) => {
    const current = readStoredDriverInfo();
    const next = {
        ...current,
        ...updates,
    };
    localStorage.setItem('driverInfo', JSON.stringify(next));
    return next;
};

const readStoredDriverCoords = () => {
    const stored = readStoredDriverInfo();
    const coordinates = stored?.location?.coordinates || stored?.coordinates;

    if (Array.isArray(coordinates) && coordinates.length === 2) {
        const [lng, lat] = coordinates;
        if (Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
            return [Number(lng), Number(lat)];
        }
    }

    return null;
};

const mapStyles = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

const DriverHome = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings.general?.app_name || 'App';
    const appLogo = settings.general?.logo || settings.customization?.logo;
    const storedDriverInfo = useMemo(() => readStoredDriverInfo(), []);
    const [isOnline, setIsOnline] = useState(false);
    const [showRequest, setShowRequest] = useState(false);
    const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);

    const [currentRequest, setCurrentRequest] = useState(null);
    const [completedRides, setCompletedRides] = useState(0);
    const [dutySeconds, setDutySeconds] = useState(0);
    const [map, setMap] = useState(null);
    const [driverCoords, setDriverCoords] = useState(() => readStoredDriverCoords());
    const [statusMessage, setStatusMessage] = useState('');
    const [acceptingRideId, setAcceptingRideId] = useState('');
    const [isHydratingDriver, setIsHydratingDriver] = useState(true);
    const [isTogglingDuty, setIsTogglingDuty] = useState(false);
    const [vehicleIconType, setVehicleIconType] = useState(
        () => storedDriverInfo?.vehicleIconType || storedDriverInfo?.vehicleType || 'car',
    );
    const [vehicleIconUrl, setVehicleIconUrl] = useState(
        () => storedDriverInfo?.vehicleIconUrl || '',
    );
    const [walletSummary, setWalletSummary] = useState({ balance: 0, cashLimit: 500, isBlocked: false });
    const driverCoordsRef = useRef(readStoredDriverCoords());
    const acceptingRideIdRef = useRef('');
    const driverPosition = useMemo(() => toLatLng(driverCoords || DEFAULT_MAP_COORDS), [driverCoords]);
    const mapVehicleIcon = useMemo(
        () => getMapIconForVehicle(vehicleIconUrl || vehicleIconType),
        [vehicleIconType, vehicleIconUrl],
    );

    const isBalanceCritical = useMemo(() => {
        const balance = Number(walletSummary.balance || 0);
        const limit = Number(walletSummary.cashLimit || 500);
        return walletSummary.isBlocked || (balance <= -limit);
    }, [walletSummary]);

    const { isLoaded } = useAppGoogleMapsLoader();


    useEffect(() => {
        const unlock = () => unlockRideRequestAlertSound();

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock);

        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, []);

    useEffect(() => {
        // Automatically show modal if driver is blocked and tries to open the app
        if (isBalanceCritical && !isOnline && !isHydratingDriver) {
            setShowLowBalanceModal(true);
        }
    }, [isBalanceCritical, isOnline, isHydratingDriver]);


    const fetchActiveJob = useCallback(async (type = 'ride') => {
        const normalizedType = String(type || 'ride').toLowerCase();
        const endpoint = normalizedType === 'parcel' ? '/deliveries/active/me' : '/rides/active/me';
        const driverToken = getLocalDriverToken();
        const response = await api.get(endpoint, {
            ...withDriverAuthorization(driverToken),
            params: { t: Date.now(), type: normalizedType },
        });
        return unwrapApiPayload(response);
    }, []);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    const mapOptions = useMemo(() => ({
        styles: mapStyles,
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false
    }), []);

    const updateDriverLocation = useCallback(async ({ quiet = false } = {}) => {
        try {
            const coordinates = await getCurrentCoords({ purpose: 'online' });
            driverCoordsRef.current = coordinates;
            setDriverCoords(coordinates);
            persistStoredDriverInfo({
                location: {
                    coordinates,
                },
                coordinates,
            });
            map?.panTo(toLatLng(coordinates));
            if (!quiet) {
                setStatusMessage('Current location updated.');
            }
            return coordinates;
        } catch (error) {
            if (!quiet) {
                setStatusMessage(error.message || 'Could not fetch current location.');
            }
            throw error;
        }
    }, [map]);

    useEffect(() => {
        updateDriverLocation({ quiet: true }).catch(() => {});
    }, [updateDriverLocation]);

    const hydrateDriverState = useCallback(async () => {
        const response = await getCurrentDriver();
        const driver = response?.data?.data || response?.data || response;
        const savedCoords = driver?.location?.coordinates;

        setVehicleIconType(driver?.vehicleIconType || driver?.vehicleType || 'car');
        setVehicleIconUrl(driver?.vehicleIconUrl || '');
        setIsOnline(Boolean(driver?.isOnline));
        if (driver?.wallet) {
            setWalletSummary(driver.wallet);
        }

        const storedDriverInfoSnapshot = readStoredDriverInfo();
        persistStoredDriverInfo({
            vehicleIconType: driver?.vehicleIconType || storedDriverInfoSnapshot?.vehicleIconType || '',
            vehicleType: driver?.vehicleType || storedDriverInfoSnapshot?.vehicleType || '',
            vehicleIconUrl: driver?.vehicleIconUrl || storedDriverInfoSnapshot?.vehicleIconUrl || '',
        });

        if (Array.isArray(savedCoords) && savedCoords.length === 2) {
            driverCoordsRef.current = savedCoords;
            setDriverCoords(savedCoords);
            persistStoredDriverInfo({
                location: {
                    coordinates: savedCoords,
                },
                coordinates: savedCoords,
            });
        }

        return driver;
    }, []);

    useEffect(() => {
        let active = true;

        setIsHydratingDriver(true);

        (async () => {
            try {
                const [dRes, activeDelivery, activeRide] = await Promise.allSettled([
                    hydrateDriverState(),
                    fetchActiveJob('parcel'),
                    fetchActiveJob('ride')
                ]);







                if (!active) {
                    return;
                }

                const deliveryPayload =
                    activeDelivery.status === 'fulfilled' ? activeDelivery.value : null;
                const ridePayload =
                    activeRide.status === 'fulfilled' ? activeRide.value : null;

                const currentJob = deliveryPayload?.rideId
                    ? deliveryPayload
                    : ridePayload?.rideId
                        ? ridePayload
                        : null;

                if (currentJob?.rideId) {
                    const currentType = normalizeJobType(currentJob);

                    navigate('/taxi/driver/active-trip', {
                        replace: true,
                        state: {
                            type: currentType,
                            rideId: currentJob.rideId,
                            otp: currentJob.otp || '',
                            request: {
                                type: currentType,
                                title: getJobTitle(currentType),
                                fare: `Rs ${currentJob.fare || 0}`,
                                payment: currentJob.paymentMethod || 'Cash',
                                pickup: currentJob.pickupAddress || formatPoint(currentJob.pickupLocation, 'Pickup Location'),
                                drop: currentJob.dropAddress || formatPoint(currentJob.dropLocation, 'Drop Location'),
                                distance: formatTripDistance(currentJob),
                                requestId: currentJob.rideId,
                                rideId: currentJob.rideId,
                                otp: currentJob.otp || '',
                                raw: currentJob,
                            },
                            currentDriverCoords: driverCoordsRef.current || currentJob.lastDriverLocation?.coordinates || null,
                        },
                    });
                    return;
                }
            } catch {
                if (active) {
                    setStatusMessage('Could not restore driver status.');
                }
            } finally {
                if (active) {
                    setIsHydratingDriver(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [fetchActiveJob, hydrateDriverState, navigate]);

    useEffect(() => {
        if (map && driverCoords) {
            map.panTo(toLatLng(driverCoords));
        }
    }, [map, driverCoords]);

    const goOnline = useCallback(async () => {
        if (isBalanceCritical) {
            setShowLowBalanceModal(true);
            setStatusMessage('Please top up your wallet to go online.');
            return;
        }

        setIsTogglingDuty(true);
        try {
            console.info('[driver-home] goOnline requested');
            setStatusMessage('Going online...');
            
            // OPTIMIZATION: Use last known coords to speed up the transition
            // instead of waiting for a fresh GPS lock (which can take 2-6 seconds)
            let coordinates = driverCoordsRef.current;
            
            if (!coordinates) {
                // If we really don't have any coords yet, we MUST wait for them once
                coordinates = await updateDriverLocation({ quiet: true });
            } else {
                // Refresh location in background for better accuracy without blocking the UI
                updateDriverLocation({ quiet: true }).catch(() => {});
            }

            console.info('[driver-home] using coordinates for online status', coordinates);
            const socket = socketService.connect({ role: 'driver' });

            if (!socket) {
                console.warn('[driver-home] socket connect skipped because token was missing');
                setIsOnline(false);
                setStatusMessage('Driver session missing. Please login again.');
                return;
            }

            setIsOnline(true);
            const response = await api.patch('/drivers/online', { location: coordinates });
            const driver = response?.data?.data || response?.data || response;
            console.info('[driver-home] online API response', {
                isOnline: driver?.isOnline,
                zoneId: driver?.zoneId || null,
                vehicleTypeId: driver?.vehicleTypeId || null,
            });
            setIsOnline(Boolean(driver?.isOnline));
            setVehicleIconUrl((current) => driver?.vehicleIconUrl || current);
            
            // Sync current state with server response
            const finalCoords = (Array.isArray(driver?.location?.coordinates) && driver.location.coordinates.length === 2)
                ? driver.location.coordinates
                : coordinates;
            
            driverCoordsRef.current = finalCoords;
            setDriverCoords(finalCoords);
            persistStoredDriverInfo({
                location: {
                    coordinates: finalCoords,
                },
                coordinates: finalCoords,
            });
            socketService.emit('locationUpdate', { coordinates: finalCoords });
            
            setStatusMessage('You are online. Waiting for nearby bookings.');
        } catch (error) {
            console.error('[driver-home] goOnline failed', error);
            setIsOnline(false);
            socketService.disconnect();
            setStatusMessage(error.message || 'Could not go online.');
        } finally {
            setIsTogglingDuty(false);
        }
    }, [updateDriverLocation]);

    const goOffline = useCallback(async () => {
        setIsTogglingDuty(true);
        setIsOnline(false);
        try {
            setStatusMessage('Going offline...');
            const response = await api.patch('/drivers/offline');
            const driver = response?.data?.data || response?.data || response;
            setIsOnline(Boolean(driver?.isOnline));
            setIsOnline(false);
            setShowRequest(false);
            setCurrentRequest(null);
            setStatusMessage('You are offline.');
            socketService.disconnect();
        } catch (error) {
            setIsOnline(true);
            setStatusMessage(error.message || 'Could not go offline.');
        } finally {
            setIsTogglingDuty(false);
        }
    }, []);

    // Socket Integration
    useEffect(() => {
        if (isOnline) {
            console.info('[driver-home] socket effect starting for online driver');
            const socket = socketService.connect({ role: 'driver' });

            if (!socket) {
                console.warn('[driver-home] socket effect could not get a socket');
                setStatusMessage('Driver session missing. Please login again.');
                setIsOnline(false);
                return undefined;
            }

            if (driverCoordsRef.current) {
                socketService.emit('locationUpdate', { coordinates: driverCoordsRef.current });
                console.info('[driver-home] emitted initial locationUpdate from effect', driverCoordsRef.current);
            }

            const onRideRequest = (data) => {
                console.info('[driver-home] rideRequest received', data);
                const requestType = normalizeJobType(data);
                const request = {
                    type: requestType,
                    title: getJobTitle(requestType),
                    fare: `Rs ${data.fare || 0}`,
                    payment: data.paymentMethod || 'Cash',
                    pickup: data.pickupAddress || formatPoint(data.pickupLocation, 'Pickup Location'),
                    drop: data.dropAddress || formatPoint(data.dropLocation, 'Drop Location'),
                    distance: formatTripDistance(data),
                    requestId: data.rideId,
                    rideId: data.rideId,
                    acceptRejectDurationSeconds: data.acceptRejectDurationSeconds || data.expiresInSeconds,
                    raw: data,
                };
                setCurrentRequest(request);
                setShowRequest(true);
                playRideRequestAlertSound();
                setStatusMessage('New booking received.');
            };

            const onRideRequestClosed = ({ rideId, reason, message }) => {
                console.info('[driver-home] rideRequestClosed received', { rideId, reason, message });
                if (acceptingRideIdRef.current && acceptingRideIdRef.current === rideId) {
                    return;
                }
                if (!currentRequest?.rideId || currentRequest.rideId === rideId) {
                    setShowRequest(false);
                    setCurrentRequest(null);
                    stopRideRequestAlertSound();
                    if (reason === 'user-cancelled') {
                        setStatusMessage(message || 'User cancelled the ride.');
                    } else if (reason === 'deleted-by-admin') {
                        setStatusMessage('Ride was cancelled by admin.');
                    } else if (reason === 'unmatched') {
                        setStatusMessage('Ride request expired without a match.');
                    }
                }
            };

            const onSocketError = ({ message }) => {
                console.error('[driver-home] socket errorMessage received', message);
                setStatusMessage(message || 'Socket error.');
                if (String(message || '').toLowerCase().includes('no longer available')) {
                    setShowRequest(false);
                    setCurrentRequest(null);
                    stopRideRequestAlertSound();
                }
                acceptingRideIdRef.current = '';
                setAcceptingRideId('');
            };

            const openAcceptedRide = async (payload) => {
                if (!payload?.rideId || payload.rideId !== acceptingRideIdRef.current) {
                    return;
                }

                const nextType = currentRequest?.type || 'ride';
                let currentJob = null;

                try {
                    currentJob = await fetchActiveJob(nextType);
                } catch {
                    currentJob = null;
                }

                setShowRequest(false);
                stopRideRequestAlertSound();
                acceptingRideIdRef.current = '';
                setAcceptingRideId('');
                setCompletedRides(prev => prev + 1);
                navigate('/taxi/driver/active-trip', {
                    state: {
                        type: nextType,
                        rideId: currentJob?.rideId || payload.rideId,
                        otp: currentJob?.otp || payload?.otp || currentRequest?.raw?.otp || '',
                        request: {
                            ...currentRequest,
                            rideId: currentJob?.rideId || payload.rideId,
                            otp: currentJob?.otp || payload?.otp || currentRequest?.raw?.otp || '',
                            raw: currentJob || {
                                ...(currentRequest?.raw || {}),
                                otp: payload?.otp || currentRequest?.raw?.otp || '',
                                status: payload.status,
                                liveStatus: payload.liveStatus,
                                acceptedAt: payload.acceptedAt,
                            },
                        },
                        currentDriverCoords: driverCoordsRef.current || driverCoords || null,
                    },
                });
            };

            const onWalletUpdated = (payload) => {
                if (payload?.wallet) {
                    setWalletSummary(payload.wallet);
                }
            };

            socketService.on('rideRequest', onRideRequest);
            socketService.on('rideRequestClosed', onRideRequestClosed);
            socketService.on('errorMessage', onSocketError);
            socketService.on('rideAccepted', openAcceptedRide);
            socketService.on('driver:wallet:updated', onWalletUpdated);
            console.info('[driver-home] socket listeners registered');

            const locationInterval = setInterval(() => {
                getCurrentCoords({ purpose: 'background' })
                    .then((coordinates) => {
                        driverCoordsRef.current = coordinates;
                        setDriverCoords(coordinates);
                        persistStoredDriverInfo({
                            location: {
                                coordinates,
                            },
                            coordinates,
                        });
                        socketService.emit('locationUpdate', { coordinates });
                        console.info('[driver-home] periodic locationUpdate emitted', coordinates);
                    })
                    .catch((error) => {
                        console.warn('[driver-home] periodic location update skipped', error?.message || error);
                        setStatusMessage(error.message || 'Could not update live location.');
                    });
            }, 10000);

            return () => {
                console.info('[driver-home] cleaning up socket listeners');
                socketService.off('rideRequest', onRideRequest);
                socketService.off('rideRequestClosed', onRideRequestClosed);
                socketService.off('errorMessage', onSocketError);
                socketService.off('rideAccepted', openAcceptedRide);
                socketService.off('driver:wallet:updated', onWalletUpdated);
                clearInterval(locationInterval);
            };
        } else {
            console.info('[driver-home] driver offline, disconnecting socket');
            socketService.disconnect();
        }
        return undefined;
    }, [currentRequest, driverCoords, fetchActiveJob, isOnline, navigate]);
    
    useEffect(() => {
        let interval;
        if (isOnline) {
            interval = setInterval(() => setDutySeconds(s => s + 1), 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isOnline]);

    const dutyHours = Math.floor(dutySeconds / 3600);
    const dutyMins = Math.floor((dutySeconds % 3600) / 60);

    const handleAccept = () => {
        if (!currentRequest?.rideId || acceptingRideId) {
            return;
        }

        acceptingRideIdRef.current = currentRequest.rideId;
        setAcceptingRideId(currentRequest.rideId);
        setStatusMessage('Accepting ride...');
        stopRideRequestAlertSound();
        socketService.emit('acceptRide', { rideId: currentRequest.rideId });
    };

    const handleDecline = () => {
        if (currentRequest?.rideId) {
            socketService.emit('rejectRide', { rideId: currentRequest.rideId });
        }
        stopRideRequestAlertSound();
        setShowRequest(false);
    };

    return (
        <div className="h-screen w-full bg-[#E5E7EB] font-sans select-none overflow-hidden relative text-slate-900 border-x border-slate-200 shadow-2xl max-w-md mx-auto">
            {/* Overlay for Ride Request Modal */}
            <IncomingRideRequest 
                visible={showRequest && Boolean(currentRequest)}
                requestData={currentRequest}
                isAccepting={Boolean(acceptingRideId)}
                onAccept={handleAccept} 
                onDecline={handleDecline}
            />

            <LowBalanceModal 
                isOpen={showLowBalanceModal}
                onClose={() => setShowLowBalanceModal(false)}
                balance={Number(walletSummary.balance || 0)}
                cashLimit={Number(walletSummary.cashLimit || 500)}
                isBlocked={isBalanceCritical}
            />

            {/* --- TOP FLOATING UI --- */}
            <div className="fixed top-0 left-0 right-0 p-5 pt-12 flex items-start justify-between z-40 pointer-events-none max-w-md mx-auto">
                {/* Menu Button */}
                <button 
                    onClick={() => navigate('/taxi/driver/profile')}
                    className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900 active:scale-90 transition-all pointer-events-auto border border-slate-100 relative"
                >
                    <Menu size={24} />
                    <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full" />
                </button>

                {/* Earnings Pill */}
                <div 
                    onClick={() => navigate('/taxi/driver/wallet')}
                    className="bg-black text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition-all pointer-events-auto cursor-pointer"
                >
                    <span className="text-emerald-400 font-bold text-lg">₹</span>
                    <span className="text-xl font-black tracking-tight">
                        {Number(walletSummary.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                {/* Search Button */}
                <button 
                    onClick={() => navigate('/taxi/driver/notifications')}
                    className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900 active:scale-90 transition-all pointer-events-auto border border-slate-100"
                >
                    <Search size={22} />
                </button>
            </div>

            {/* --- MAP BACKGROUND --- */}
            <div className="absolute inset-0 z-0 w-full h-full">
                {HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                    <GoogleMap 
                        mapContainerStyle={containerStyle} 
                        center={driverPosition} 
                        zoom={15} 
                        onLoad={onLoad} 
                        onUnmount={onUnmount} 
                        options={mapOptions}
                    >
                        <Marker 
                            position={driverPosition} 
                            icon={{ 
                                url: mapVehicleIcon, 
                                scaledSize: new window.google.maps.Size(40, 40), 
                                anchor: new window.google.maps.Point(20, 20)
                            }} 
                        />
                    </GoogleMap>
                ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                        <div className="text-center px-10">
                            <div className="w-16 h-16 bg-slate-300 rounded-full animate-pulse mx-auto mb-4" />
                            <p className="text-slate-500 font-medium text-sm">Map unavailable. Configure Google Maps key.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* --- BOTTOM FLOATING UI --- */}
            <div className="fixed bottom-20 left-0 right-0 p-6 pb-4 z-40 flex flex-col pointer-events-none max-w-md mx-auto">
                
                {/* Status Message Overlay */}
                <AnimatePresence mode="wait">
                    {isOnline ? (
                        <motion.div 
                            key="online-status"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="self-center mb-6 bg-emerald-500 px-6 py-2 rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.3)] border border-emerald-400/30 flex items-center gap-2"
                        >
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-[12px] font-black text-white uppercase tracking-widest">Seeking Rides</span>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="offline-status"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="self-center mb-6 bg-white/90 backdrop-blur-md px-6 py-2 rounded-full shadow-lg border border-slate-200 flex items-center gap-2"
                        >
                            <span className="w-2 h-2 bg-slate-400 rounded-full" />
                            <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">You are Offline</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-end justify-center w-full">
                    {/* MAIN "GO" BUTTON */}
                    <motion.div 
                        layout
                        className="relative pointer-events-auto"
                    >
                        <AnimatePresence>
                            {isOnline && (
                                <>
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="absolute -inset-4 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"
                                    />
                                    {/* ROTATING RADAR RING */}
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                        className="absolute -inset-2 border-2 border-dashed border-white/30 rounded-full z-0 pointer-events-none"
                                    />
                                </>
                            )}
                        </AnimatePresence>
                        
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            disabled={isHydratingDriver || isTogglingDuty}
                            onClick={isOnline ? goOffline : goOnline}
                            className={`
                                relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10
                                ${isOnline 
                                    ? 'bg-rose-500 hover:bg-rose-600 ring-8 ring-rose-500/10 shadow-rose-200' 
                                    : 'bg-blue-600 hover:bg-blue-700 ring-8 ring-blue-600/10 shadow-blue-200'}
                                overflow-hidden
                                ${(isHydratingDriver || isTogglingDuty) ? 'opacity-90' : ''}
                            `}
                        >
                            <AnimatePresence mode="wait">
                                {isHydratingDriver ? (
                                    <motion.div
                                        key="loader"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <Zap className="text-white animate-pulse" size={32} />
                                    </motion.div>
                                ) : isOnline ? (
                                    <motion.span 
                                        key="off-text"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`text-white font-black text-2xl tracking-tighter ${isTogglingDuty ? 'animate-pulse' : ''}`}
                                    >
                                        OFF
                                    </motion.span>
                                ) : (
                                    <motion.span 
                                        key="go-text"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`text-white font-black text-2xl tracking-tighter ${isTogglingDuty ? 'animate-pulse' : ''}`}
                                    >
                                        GO
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* Ripples when online */}
                            {isOnline && (
                                <motion.div 
                                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="absolute inset-0 rounded-full border-2 border-white/50"
                                />
                            )}
                        </motion.button>
                    </motion.div>
                </div>
            </div>

            {/* Status Based Background Overlay */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent pointer-events-none z-10"
                    />
                )}
            </AnimatePresence>

            <DriverBottomNav />
        </div>
    );
};

export default DriverHome;
