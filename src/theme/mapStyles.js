// Google Maps JSON style for both iOS and Android.

export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b1020' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1020' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b93ad' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2038' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#c4cbe0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a5b4fc' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#7b869e' }] },

  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1f1c' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4b7c6a' }] },

  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1225' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0f1530' }] },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#171c30' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e2540' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7694' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1b2238' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a3358' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3a4478' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#c7d2fe' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05070f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5268' }] },
];

export const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f1f4fb' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a5268' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },

  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c8cfe2' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4f46e5' }] },

  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e4efe0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b8c63' }] },

  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f3f5fb' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eef1f9' }] },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dfe4f2' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a6478' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dfe4ff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#b4bfff' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#3730a3' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9dcff' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a6478' }] },
];
