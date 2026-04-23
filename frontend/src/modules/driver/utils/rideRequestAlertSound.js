import rideRequestAlertUrl from '../../../assets/sounds/ride-request-alert.mp3';

let alertAudio;
let isUnlocked = false;
let shouldKeepPlaying = false;
let playInFlight = null;

const getAlertAudio = () => {
    if (!alertAudio) {
        alertAudio = new Audio(rideRequestAlertUrl);
        alertAudio.loop = true;
        alertAudio.preload = 'auto';
        alertAudio.volume = 0.85;
    }

    return alertAudio;
};

const tryPlayAlertAudio = () => {
    const audio = getAlertAudio();

    if (playInFlight) {
        return playInFlight;
    }

    playInFlight = audio.play()
        .then(() => {
            playInFlight = null;
            isUnlocked = true;
        })
        .catch(() => {
            playInFlight = null;
        });

    return playInFlight;
};

export const unlockRideRequestAlertSound = () => {
    const audio = getAlertAudio();
    const previousVolume = audio.volume;
    audio.volume = 0;

    audio.play()
        .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = previousVolume;
            isUnlocked = true;

            if (shouldKeepPlaying) {
                audio.currentTime = 0;
                tryPlayAlertAudio();
            }
        })
        .catch(() => {
            audio.volume = previousVolume;
        });
};

export const playRideRequestAlertSound = () => {
    const audio = getAlertAudio();
    shouldKeepPlaying = true;
    audio.currentTime = 0;
    tryPlayAlertAudio();
};

export const stopRideRequestAlertSound = () => {
    shouldKeepPlaying = false;

    if (!alertAudio) return;

    alertAudio.pause();
    alertAudio.currentTime = 0;
};
