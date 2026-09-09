import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { uploadDataUrlToCloudinary } from '../../../../utils/cloudinaryUpload.js';
import { env } from '../../../../config/env.js';
import { getReferralSettings, getReferralTranslationContent } from '../../admin/services/adminService.js';
import { getPublicActivePaymentGateway } from '../../services/paymentGatewayService.js';
import { buildPaymentRequestContext, logPaymentDiagnostic } from '../../services/paymentDiagnostics.js';
import { Vehicle } from '../../admin/models/Vehicle.js';
import { ApiError } from '../../../../utils/ApiError.js';

/**
 * Common controller for shared utilities like file uploads
 */
export const uploadImage = asyncHandler(async (req, res) => {
    const { image, folder = 'general' } = req.body;
    
    if (!image) {
        return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    const uploadResult = await uploadDataUrlToCloudinary({
        dataUrl: image,
        folder: `${env.cloudinary.folder}/${folder}`,
        publicIdPrefix: `content-${folder}`
    });

    return res.json({
        success: true,
        data: {
            url: uploadResult.secureUrl,
            publicId: uploadResult.publicId,
            format: uploadResult.format
        }
    });
});

export const getReferralTranslation = asyncHandler(async (req, res) => {
    const languageCode = String(req.query?.language || req.query?.lang || '').trim().toLowerCase();
    const data = await getReferralTranslationContent(languageCode);

    return res.json({
        success: true,
        data,
    });
});

export const getReferralSettingsContent = asyncHandler(async (req, res) => {
    const type = String(req.query?.type || '').trim().toLowerCase();
    const data = await getReferralSettings(type || undefined);

    return res.json({
        success: true,
        data,
    });
});

export const getPaymentGatewayConfig = asyncHandler(async (_req, res) => {
    const data = await getPublicActivePaymentGateway();

    return res.json({
        success: true,
        data,
    });
});

export const acknowledgePhonePeCallback = asyncHandler(async (req, res) => {
    logPaymentDiagnostic({
        provider: 'phonepe',
        scope: 'callback',
        stage: 'received',
        request: buildPaymentRequestContext(req),
        query: req.query || {},
        body: req.body || {},
    });

    return res.json({
        success: true,
        message: 'Callback received',
    });
});

export const acknowledgeRechargeApiCallback = asyncHandler(async (req, res) => {
    return res.json({
        success: true,
        message: 'Recharge API callback received',
        data: {
            query: req.query || {},
            body: req.body || {},
            receivedAt: new Date().toISOString(),
        },
    });
});

// Vehicle type icons are stored in Mongo as base64 data URIs, some of them
// 450KB. They were being inlined into /drivers/me, which the app polls, so the
// same unchanging image was re-sent on every request. Serving them here instead
// keeps the polled payload small and lets the client cache the image, because
// the bytes never change for a given vehicle type.
const DATA_URI = /^data:([^;,]+)?(;base64)?,/i;

export const getVehicleTypeIcon = asyncHandler(async (req, res) => {
    const { vehicleTypeId } = req.params;

    if (!/^[a-f\d]{24}$/i.test(String(vehicleTypeId || ''))) {
        throw new ApiError(400, 'A valid vehicle type id is required');
    }

    const vehicle = await Vehicle.findById(vehicleTypeId).select('icon map_icon image updatedAt').lean();
    const source = vehicle?.map_icon || vehicle?.icon || vehicle?.image || '';

    if (!source) {
        throw new ApiError(404, 'Vehicle icon not found');
    }

    // Already hosted somewhere else - just point the caller at it.
    if (!DATA_URI.test(source)) {
        res.redirect(302, source);
        return;
    }

    const [meta, encoded] = source.split(',', 2);
    const contentType = (meta.match(/^data:([^;,]+)/i) || [])[1] || 'image/png';
    const body = /;base64/i.test(meta)
        ? Buffer.from(encoded || '', 'base64')
        : Buffer.from(decodeURIComponent(encoded || ''), 'utf8');

    // Content is immutable for a given id+updatedAt, so it can be cached hard.
    const etag = `W/"${vehicleTypeId}-${new Date(vehicle.updatedAt || 0).getTime()}-${body.length}"`;

    if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.send(body);
});
