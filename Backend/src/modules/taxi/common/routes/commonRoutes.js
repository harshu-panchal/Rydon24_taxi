import { Router } from 'express';
import * as commonController from '../controllers/commonController.js';

export const commonRouter = Router();

// Universal image upload endpoint
commonRouter.post('/common/upload/image', commonController.uploadImage);
commonRouter.get('/common/referrals/translation', commonController.getReferralTranslation);
commonRouter.get('/common/referrals/settings', commonController.getReferralSettingsContent);
