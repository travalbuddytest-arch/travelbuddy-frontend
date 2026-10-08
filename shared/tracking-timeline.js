(function () {
  'use strict';

  const stages = [
    { key: 'posted', title: 'Parcel Posted' },
    { key: 'accepted', title: 'Traveler Accepted' },
    { key: 'pickup_point', title: 'Pickup Point' },
    { key: 'pickup_confirmed', title: 'Pickup Confirmed' },
    { key: 'in_transit', title: 'In Transit' },
    { key: 'delivery_point', title: 'Delivery Point Selection' },
    { key: 'delivered', title: 'Delivered Successfully' },
  ];

  const laterStatuses = {
    accepted: ['accepted', 'pickup_point_pending', 'pickup_point_selected', 'pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'],
    pickup_point: ['pickup_point_selected'],
    pickup_confirmed: ['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'],
    in_transit: ['in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'],
    delivery_point: ['delivery_point_selected'],
    delivered: ['delivered'],
  };

  const currentStage = {
    pending: 'accepted',
    accepted: 'pickup_point',
    pickup_point_pending: 'pickup_point',
    pickup_point_selected: 'pickup_confirmed',
    pickup_confirmed: 'in_transit',
    in_transit: 'delivery_point',
    delivery_point_pending: 'delivery_point',
    delivery_point_selected: 'delivered',
  };

  function resolve(parcel) {
    if (Array.isArray(parcel.trackingTimeline)) {
      return {
        stages: parcel.trackingTimeline,
        terminal: parcel.trackingTerminal || null,
      };
    }

    const status = String(parcel.status || '');
    const pickupPointSelected = Boolean(parcel.pickupPoint?.selectedAt || parcel.pickupPoint?.name);
    const deliveryPointSelected = Boolean(parcel.deliveryPoint?.selectedAt || parcel.deliveryPoint?.name);
    const dates = {
      posted: parcel.createdAt || null,
      accepted: parcel.acceptedAt || null,
      pickup_point: parcel.pickupPoint?.selectedAt || null,
      pickup_confirmed: parcel.pickupConfirmedAt || null,
      in_transit: parcel.inTransitAt || null,
      delivery_point: parcel.deliveryPoint?.selectedAt || null,
      delivered: parcel.deliveredAt || null,
    };
    const confirmed = {
      posted: true,
      accepted: Boolean(parcel.acceptedBy || parcel.travelerId || dates.accepted || (laterStatuses.accepted || []).includes(status)),
      pickup_point: pickupPointSelected || status === 'pickup_point_selected',
      pickup_confirmed: Boolean(dates.pickup_confirmed || laterStatuses.pickup_confirmed.includes(status)),
      in_transit: Boolean(dates.in_transit || laterStatuses.in_transit.includes(status)),
      delivery_point: deliveryPointSelected || status === 'delivery_point_selected',
      delivered: status === 'delivered' || Boolean(dates.delivered),
    };
    const skipped = {
      pickup_point: ['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'].includes(status) && !confirmed.pickup_point,
      delivery_point: status === 'delivered' && !confirmed.delivery_point,
    };

    return {
      stages: stages.map((stage) => ({
        ...stage,
        state: confirmed[stage.key]
          ? 'done'
          : (skipped[stage.key]
            ? 'skipped'
            : (currentStage[status] === stage.key ? 'current' : 'pending')),
        time: dates[stage.key],
      })),
      terminal: parcel.trackingTerminal || (
        status === 'disputed'
          ? { key: 'disputed', title: 'Disputed', state: 'current', time: null }
          : status.includes('cancel')
            ? { key: 'cancelled', title: 'Parcel Cancelled', state: 'failed', time: parcel.cancelledAt || null }
            : null
      ),
    };
  }

  window.CarryParcelTrackingTimeline = { resolve };
})();
