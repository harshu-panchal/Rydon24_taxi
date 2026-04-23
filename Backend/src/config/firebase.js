import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { env } from './env.js';

let firebaseDatabase = null;
let firebaseMessaging = null;
let firebaseInitAttempted = false;

const parseServiceAccountJson = (rawJson) => {
  if (!rawJson) {
    return null;
  }

  const parsed = JSON.parse(rawJson);

  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
};

const readServiceAccount = () => {
  if (env.firebase.serviceAccountJson) {
    return parseServiceAccountJson(env.firebase.serviceAccountJson);
  }

  if (!env.firebase.serviceAccountPath) {
    return null;
  }

  const credentialPath = path.isAbsolute(env.firebase.serviceAccountPath)
    ? env.firebase.serviceAccountPath
    : path.resolve(process.cwd(), env.firebase.serviceAccountPath);

  return parseServiceAccountJson(fs.readFileSync(credentialPath, 'utf8'));
};

const getFirebaseApp = () => {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount && !env.firebase.databaseURL) {
    return null;
  }

  try {
    return admin.initializeApp({
      ...(serviceAccount ? { credential: admin.credential.cert(serviceAccount) } : {}),
      ...(env.firebase.databaseURL ? { databaseURL: env.firebase.databaseURL } : {}),
    });
  } catch (error) {
    console.error('Firebase admin initialization failed:', error.message);
    return null;
  }
};

export const getFirebaseDatabase = () => {
  if (firebaseDatabase || firebaseInitAttempted) {
    return firebaseDatabase;
  }

  firebaseInitAttempted = true;

  if (!env.firebase.databaseURL) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    firebaseDatabase = admin.database(app);
    return firebaseDatabase;
  } catch (error) {
    console.error('Firebase database initialization failed:', error.message);
    return null;
  }
};

export const getFirebaseMessaging = () => {
  if (firebaseMessaging) {
    return firebaseMessaging;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    firebaseMessaging = admin.messaging(app);
    return firebaseMessaging;
  } catch (error) {
    console.error('Firebase messaging initialization failed:', error.message);
    return null;
  }
};

export const firebaseServerTimestamp = () => admin.database.ServerValue.TIMESTAMP;
