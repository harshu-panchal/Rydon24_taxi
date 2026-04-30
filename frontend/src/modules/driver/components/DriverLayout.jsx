import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearDriverAuthState, getCurrentDriver } from '../services/registrationService';
import DriverRideRequestListener from './DriverRideRequestListener';

const unwrapDriver = (response) => response?.data?.data || response?.data || response;

const isDriverApproved = (driver) => {
    if (!driver) {
        return false;
    }

    const role = String(driver?.onboarding?.role || localStorage.getItem('role') || 'driver').toLowerCase();
    if (role === 'service_center' || role === 'service_center_staff') {
        return driver.status !== 'inactive';
    }

    const approval = String(driver.approve ?? '').toLowerCase();
    const status = String(driver.status || '').toLowerCase();

    return (
        driver.approve === true ||
        driver.approve === 1 ||
        ['true', '1', 'yes', 'approved'].includes(approval) ||
        ['approved', 'active', 'verified'].includes(status)
    );
};

const onboardingRoutes = new Set([
    '/taxi/driver/lang-select',
    '/taxi/driver/welcome',
    '/taxi/driver/login',
    '/taxi/driver/reg-phone',
    '/taxi/driver/otp-verify',
    '/taxi/driver/step-personal',
    '/taxi/driver/step-referral',
    '/taxi/driver/step-vehicle',
    '/taxi/driver/step-documents',
    '/taxi/driver/registration-status',
    '/taxi/driver/status',
]);

const softEntryRoutes = new Set([
    '/taxi/driver/welcome',
    '/taxi/driver/login',
    '/taxi/driver/reg-phone',
]);

const redirectToDriverLogin = (navigate) => {
    clearDriverAuthState();
    navigate('/taxi/driver/login', { replace: true });
};

const getStoredRole = () => String(localStorage.getItem('role') || 'driver').toLowerCase();

const getAuthenticatedDriverHome = () => (
    getStoredRole() === 'owner'
        ? '/taxi/driver/profile'
        : getStoredRole() === 'service_center'
            ? '/taxi/driver/service-center'
        : getStoredRole() === 'service_center_staff'
            ? '/taxi/driver/service-center'
        : getStoredRole() === 'bus_driver'
            ? '/taxi/driver/bus-home'
            : '/taxi/driver/home'
);

const getPendingDriverRoute = () => '/taxi/driver/registration-status';

const DriverLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [isAllowed, setIsAllowed] = useState(true);
    const verifiedTokenRef = useRef('');

    useEffect(() => {
        const currentPath = location.pathname;
        const onboardingState = location.state || {};
        const token = localStorage.getItem('driverToken') || localStorage.getItem('token');
        const authenticatedHome = getAuthenticatedDriverHome();
        const shouldVerifyOnboardingRoute =
            Boolean(token)
            && (
                softEntryRoutes.has(currentPath)
                || (
                    currentPath === '/taxi/driver/lang-select'
                    && !onboardingState.registrationFlow
                    && !onboardingState.allowAuthenticated
                )
            );

        if (onboardingRoutes.has(currentPath) && !shouldVerifyOnboardingRoute) {
            setIsAllowed(true);
            setIsChecking(false);
            return;
        }

        if (!token) {
            setIsAllowed(false);
            verifiedTokenRef.current = '';
            redirectToDriverLogin(navigate);
            return;
        }

        if (verifiedTokenRef.current === token && isAllowed) {
            setIsChecking(false);
            return;
        }

        let active = true;

        const verifyDriver = async () => {
            setIsChecking(true);

            try {
                const response = await getCurrentDriver();
                const driver = unwrapDriver(response);
                const isApproved = isDriverApproved(driver);

                if (!active) {
                    return;
                }

                if (!isApproved) {
                    setIsAllowed(false);
                    navigate(getPendingDriverRoute(), { replace: true });
                    return;
                }

                setIsAllowed(true);
                verifiedTokenRef.current = token;

                if (softEntryRoutes.has(currentPath)) {
                    navigate(authenticatedHome, { replace: true });
                    return;
                }

                if (
                    currentPath === '/taxi/driver/lang-select'
                    && !onboardingState.registrationFlow
                    && !onboardingState.allowAuthenticated
                ) {
                    navigate(authenticatedHome, { replace: true });
                }
            } catch (error) {
                if (!active) {
                    return;
                }

                setIsAllowed(false);
                verifiedTokenRef.current = '';

                if (error?.status === 401) {
                    redirectToDriverLogin(navigate);
                    return;
                }

                if (error?.status === 404) {
                    redirectToDriverLogin(navigate);
                    return;
                }

                if (error?.status === 403) {
                    navigate(getPendingDriverRoute(), { replace: true });
                    return;
                }

                navigate(getPendingDriverRoute(), { replace: true });
            } finally {
                if (active) {
                    setIsChecking(false);
                }
            }
        };

        verifyDriver();

        return () => {
            active = false;
        };
    }, [isAllowed, location.pathname, navigate]);

    return (
        <div className="driver-theme min-h-screen">
            {isChecking && !onboardingRoutes.has(location.pathname) ? (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    <Outlet context={{ isAllowed }} />
                    {isAllowed && getStoredRole() === 'driver' && <DriverRideRequestListener />}
                </>
            )}
        </div>
    );
};

export default DriverLayout;
