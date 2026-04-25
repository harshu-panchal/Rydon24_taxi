import rideRequestAlertUrl from '../../../assets/sounds/ride-request-alert.mp3';

let alertAudio;
let isUnlocked = false;
let shouldKeepPlaying = false;
let playInFlight = null;
let retryTimeoutId = null;
let lifecycleBound = false;

const clearRetryTimeout = () => {
    if (retryTimeoutId) {
        window.clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
    }
};

const getAlertAudio = () => {
    if (!alertAudio) {
        alertAudio = new Audio(rideRequestAlertUrl);
        alertAudio.loop = true;
        alertAudio.preload = 'auto';
        alertAudio.volume = 0.85;
        alertAudio.playsInline = true;
    }

    return alertAudio;
};

const scheduleRetry = (delay = 900) => {
    if (!shouldKeepPlaying) {
        return;
    }

    clearRetryTimeout();
    retryTimeoutId = window.setTimeout(() => {
        retryTimeoutId = null;
        tryPlayAlertAudio();
    }, delay);
};

const handleLifecycleResume = () => {
    if (!shouldKeepPlaying) {
        return;
    }

    const audio = getAlertAudio();
    if (audio.paused) {
        tryPlayAlertAudio();
    }
};

const bindLifecycleListeners = () => {
    if (lifecycleBound || typeof window === 'undefined') {
        return;
    }

    lifecycleBound = true;
    window.addEventListener('focus', handleLifecycleResume);
    window.addEventListener('pageshow', handleLifecycleResume);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleLifecycleResume();
        }
    });
};

const tryPlayAlertAudio = () => {
    const audio = getAlertAudio();
    bindLifecycleListeners();

    if (playInFlight) {
        return playInFlight;
    }

    playInFlight = audio.play()
        .then(() => {
            playInFlight = null;
            isUnlocked = true;
            clearRetryTimeout();
        })
        .catch(() => {
            playInFlight = null;
            scheduleRetry(isUnlocked ? 1200 : 500);
        });

    return playInFlight;
};

export const unlockRideRequestAlertSound = () => {
    const audio = getAlertAudio();
    const previousVolume = audio.volume;
    audio.volume = 0;
    bindLifecycleListeners();

    audio.play()
        .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = previousVolume;
            isUnlocked = true;
            clearRetryTimeout();

            if (shouldKeepPlaying) {
                audio.currentTime = 0;
                tryPlayAlertAudio();
            }
        })
        .catch(() => {
            audio.volume = previousVolume;
            scheduleRetry(500);
        });
};

export const playRideRequestAlertSound = () => {
    const audio = getAlertAudio();
    bindLifecycleListeners();
    shouldKeepPlaying = true;
    audio.currentTime = 0;
    tryPlayAlertAudio();

    if (navigator.vibrate) {
        navigator.vibrate([250, 150, 250]);
    }
};

export const stopRideRequestAlertSound = () => {
    shouldKeepPlaying = false;
    clearRetryTimeout();

    if (!alertAudio) return;

    alertAudio.pause();
    alertAudio.currentTime = 0;
};
