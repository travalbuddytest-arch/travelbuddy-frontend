(function () {
  'use strict';

  const API_ORIGIN = APP_CONFIG.API_BASE_URL;
  const { authHeaders } = window.TravelBuddy;

  const UNAVAILABLE_MESSAGE = 'QR verification service is currently unavailable. Please try again or use OTP.';

  const ERROR_MESSAGES = {
    INVALID_QR: 'This QR code is invalid.',
    EXPIRED_QR: 'This QR code has expired.',
    QR_ALREADY_USED: 'QR code has already been used.',
    WRONG_PARCEL: 'This QR code is for a different parcel.',
    WRONG_STAGE: 'This QR code is for a different verification stage.',
    UNAUTHORIZED: 'Please sign in again to continue.',
    FORBIDDEN: 'You are not authorized to verify this parcel.',
    PARCEL_NOT_FOUND: 'Parcel not found.',
    ALREADY_PICKED_UP: 'Pickup has already been verified.',
    ALREADY_DELIVERED: 'Delivery has already been verified.',
    SERVER_ERROR: 'QR verification failed on the server. Please try again or use OTP.',
  };

  function friendlyQrError(data, fallback) {
    const code = data?.code || data?.errorCode || data?.status;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    const raw = data?.message || data?.error;
    if (raw && !/stack|trace|exception|mongo|mongoose|syntax/i.test(String(raw))) return String(raw);
    return fallback || UNAVAILABLE_MESSAGE;
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (err) {
      return {};
    }
  }

  async function postQr(path, body) {
    let response;
    try {
      response = await fetch(`${API_ORIGIN}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const data = await readJson(response);
    if (!response.ok || data.success === false) {
      const statusCodeMap = {
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'PARCEL_NOT_FOUND',
        500: 'SERVER_ERROR',
      };
      const errorData = data && Object.keys(data).length
        ? data
        : { code: statusCodeMap[response.status] };
      throw new Error(friendlyQrError(errorData));
    }
    return data;
  }

  function createPickupQr(parcelId) {
    return postQr(`/api/parcels/${encodeURIComponent(parcelId)}/pickup-qr`);
  }

  function verifyPickupQr(parcelId, qrToken) {
    return postQr(`/api/parcels/${encodeURIComponent(parcelId)}/verify-pickup-qr`, { qrToken });
  }

  function createDeliveryQr(parcelId) {
    return postQr(`/api/parcels/${encodeURIComponent(parcelId)}/delivery-qr`);
  }

  function verifyDeliveryQr(parcelId, qrToken) {
    return postQr(`/api/parcels/${encodeURIComponent(parcelId)}/verify-delivery-qr`, { qrToken });
  }

  window.TravelBuddy.QRVerification = {
    UNAVAILABLE_MESSAGE,
    ERROR_MESSAGES,
    friendlyQrError,
    createPickupQr,
    verifyPickupQr,
    createDeliveryQr,
    verifyDeliveryQr,
  };
})();
